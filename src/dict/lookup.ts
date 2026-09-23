/**
 * Local Jitendex lookup: a port of himotoki-web-ts `yomitan_search.ts`, `conj_engine.ts`,
 * `himotoki_conj.ts` and the per-token part of `analyze.ts`, running against a `term` table
 * through an injected synchronous query function (SQLite WebAssembly in the dictionary worker).
 */
import {
  CONJ_POS,
  GODAN_TE_SUFFIX,
  PARTICLE_LEMMAS,
  type ConjStep,
  conjStep,
  conjStepToDict,
  deconjugate_recursive,
  expected_pos_from_step,
  forward_conjugate,
  godan_dict_ending,
  PARADIGM_KEYS,
  pos_class,
  reconstruct_forms,
} from "./conj_rules";
import { fuzzyKanaExpansions, fuzzyKanaKey, kanaSearchVariants, toHiragana, toKatakana } from "./kana";

export type Query = (sql: string, params?: unknown[]) => Array<Record<string, unknown>>;

export type DictSense = {
  pos: string[];
  glosses: string[];
  lang: string;
  examples?: Array<{ jp: string; en: string; keyword?: string }>;
  notes?: string[];
};

export type DictEntry = {
  source: string;
  dict: string;
  seq: number;
  common: boolean;
  kanji: string[];
  readings: string[];
  senses: DictSense[];
  score: number;
  forms?: string[];
  pitch?: number[];
  pitch_display?: string;
  freq?: number;
  jlpt?: string[];
  examples?: Array<Record<string, unknown>>;
  _vs_compound?: boolean;
  _vs_lemma?: string;
};

export type ConjugationTree = {
  root_text: string;
  root_reading: string;
  root_seq: number;
  steps: Array<Record<string, unknown>>;
};

export type LookupResult = {
  surface: string;
  entries: DictEntry[];
  best: DictEntry | null;
  source_text?: string;
  conj_type?: string | null;
  conjugation?: ConjugationTree;
};

type TermRow = Record<string, unknown>;

const SOURCE_ID = "jitendex";
const SOURCE_TITLE = "Jitendex";
const JAPANESE_RE = /[぀-ヿ一-鿿]/;
const KANJI_RE = /[一-鿿]/;
const KANA_CHAR_RE = /[぀-ヿァ-ヶー・っッ]/;
const TRAILING_KANA_RE = /[぀-ヿ]+$/;
const FUNCTION_POS = new Set(["aux", "aux-v", "aux-adj", "cop", "conj"]);
const PARTICLE_SURFACES = new Set([..."をにがはのとでもへやかねよなやらんでば"]);
const COMPOUND_TAILS = new Set([
  "焼き", "焼", "丼", "揚げ", "揚", "物", "屋", "語", "腐", "汁", "粉", "麺", "飯", "芋", "酒", "茶",
]);
const MAX_COMPOUND_MERGE_WINDOW = 6;

const ORDERED_CONJ_TYPES = [
  "Desire (〜たい)", "Causative", "Causative-Passive", "Passive", "Potential", "Potential/Passive",
  "Conjunctive (~te)", "Conjunctive (~te, progressive)", "Progressive (ている)", "Completion (しまう)",
  "Preparatory (おく)", "Attempt (みる)", "Benefactive (くれる)", "Benefactive (もらう)",
  "Benefactive (あげる)", "Desiderative (ほしい)", "Directional (ていく)", "Directional (てくる)",
  "Obligation", "While (~ながら)", "Easy to (~やすい)", "Hard to (~にくい)", "Evidential (そう)",
  "Negative", "Polite", "Conditional (ば)", "Provisional (たら)", "Provisional (なら)", "Volitional",
  "Imperative", "Negative imperative", "Past (~ta)",
] as const;
const CONJ_STEP_PRIORITY: Record<string, number> = Object.fromEntries(
  ORDERED_CONJ_TYPES.map((ct, i) => [ct, i]),
);

const TERM_COLUMNS =
  "id, expression, reading, def_tags, rules, score, sequence, term_tags, glossary_json, expression_raw";

/* ---------------- kana / query variants ---------------- */

function isKanaHeavy(text: string): boolean {
  if (!text) return false;
  let kanaChars = 0;
  for (const ch of text) if (KANA_CHAR_RE.test(ch)) kanaChars += 1;
  return kanaChars >= 2 && kanaChars >= text.length / 2;
}

function japaneseQueryVariants(text: string): string[] {
  if (!text) return [];
  const variants = [...kanaSearchVariants(text)];
  if (isKanaHeavy(text)) {
    for (const form of fuzzyKanaExpansions(text, 24)) {
      if (!variants.includes(form)) variants.push(form);
    }
  }
  return variants;
}

/* ---------------- term rows → entries ---------------- */

function tagsToPos(defTags: string, termTags: string, rules = ""): string[] {
  const tags: string[] = [];
  for (const raw of `${rules} ${defTags} ${termTags}`.split(/\s+/)) {
    const t = raw.trim();
    if (!t || t === "★" || t === "priority\xa0form" || t === "non-lemma") continue;
    if (!tags.includes(t)) tags.push(t);
  }
  return tags.slice(0, 8);
}

function loadPayload(row: TermRow): Record<string, unknown> {
  try {
    const raw = JSON.parse(String(row.glossary_json));
    if (Array.isArray(raw)) return { v: 1, glosses: raw.filter(Boolean).map(String), senses: [] };
    if (raw && typeof raw === "object" && (raw as { v?: number }).v === 2) return raw as Record<string, unknown>;
    return { v: 1, glosses: [String(raw)], senses: [] };
  } catch {
    return { v: 1, glosses: [String(row.glossary_json)], senses: [] };
  }
}

function termToSenses(row: TermRow): [DictSense[], string[]] {
  const payload = loadPayload(row);
  const forms = ((payload.forms as unknown[]) ?? []).filter(Boolean).map(String);
  const senses = payload.senses;
  if (Array.isArray(senses) && senses.length) {
    const out: DictSense[] = [];
    for (const sense of senses) {
      if (!sense || typeof sense !== "object") continue;
      const item = { ...(sense as Record<string, unknown>) };
      const glosses = ((item.glosses as unknown[]) ?? []).filter(Boolean).map(String);
      let pos = ((item.pos as unknown[]) ?? []).filter(Boolean).map(String);
      if (!pos.length) {
        pos = tagsToPos(String(row.def_tags || ""), String(row.term_tags || ""), String(row.rules || ""));
      }
      out.push({
        ...(item as object),
        pos,
        glosses,
        lang: String(item.lang || "eng"),
      } as DictSense);
    }
    if (out.length) return [out, forms];
  }
  const glosses = ((payload.glosses as unknown[]) ?? []).filter(Boolean).map(String);
  return [
    [
      {
        pos: tagsToPos(String(row.def_tags || ""), String(row.term_tags || ""), String(row.rules || "")),
        glosses,
        lang: "eng",
      },
    ],
    forms,
  ];
}

function pitchFromRaw(expressionRaw: string): number[] {
  const raw = expressionRaw || "";
  if (!raw.includes("%")) return [];
  return [...raw.matchAll(/%+/g)].map((m) => m[0]!.length);
}

function isCommon(row: TermRow): boolean {
  const tags = `${row.def_tags || ""} ${row.term_tags || ""}`;
  if (tags.includes("★")) return true;
  return Number(row.score || 0) > 0;
}

function entryKey(row: TermRow): string {
  const seq = Number(row.sequence || 0);
  if (seq > 0) return `seq:${seq}`;
  return `er:${row.expression}|${row.reading || ""}`;
}

function publicId(row: TermRow): number {
  const seq = Number(row.sequence || 0);
  return seq > 0 ? seq : Number(row.id);
}

function groupTermsToEntry(rows: TermRow[], entryKeyNum: number): DictEntry | null {
  if (!rows.length) return null;
  const expressions: string[] = [];
  const readings: string[] = [];
  let maxScore = 0;
  let common = false;
  const bestRow = rows.reduce((a, b) => {
    const pa = loadPayload(a);
    const pb = loadPayload(b);
    const sa = ((pa.senses as unknown[]) ?? []).length;
    const sb = ((pb.senses as unknown[]) ?? []).length;
    const ga = ((pa.glosses as unknown[]) ?? []).length;
    const gb = ((pb.glosses as unknown[]) ?? []).length;
    if (sb !== sa) return sb > sa ? b : a;
    if (gb !== ga) return gb > ga ? b : a;
    return Number(b.score || 0) > Number(a.score || 0) ? b : a;
  });
  const [senses, forms] = termToSenses(bestRow);
  const payload = loadPayload(bestRow);
  let pitch: number[] = [];
  for (const row of rows) pitch.push(...pitchFromRaw(String(row.expression_raw || "")));
  pitch = [...new Set(pitch)];

  for (const row of rows) {
    const expr = String(row.expression);
    const reading = String(row.reading || expr);
    if (KANJI_RE.test(expr)) {
      // Negative-score rows are rarely-used or stub spellings (為る under する, 言った
      // redirects); keep their reading but don't offer them as display headwords.
      if (Number(row.score || 0) >= 0 && !expressions.includes(expr)) expressions.push(expr);
      if (reading && !readings.includes(reading)) readings.push(reading);
    } else {
      if (!readings.includes(expr)) readings.push(expr);
      if (reading && reading !== expr && !readings.includes(reading)) readings.push(reading);
    }
    maxScore = Math.max(maxScore, Number(row.score || 0));
    common = common || isCommon(row);
  }

  const headForms = [...new Set([...expressions, ...readings].filter(Boolean))];
  const guessKeyword = (jp: string): string => {
    let best = "";
    for (const form of headForms) {
      if (form && jp.includes(form) && form.length > best.length) best = form;
    }
    if (best) return best;
    for (const form of headForms) {
      for (let n = form.length - 1; n > 0; n--) {
        const prefix = form.slice(0, n);
        if (prefix.length >= 1 && jp.includes(prefix) && prefix.length > best.length) best = prefix;
      }
    }
    return best;
  };

  const examples: Array<Record<string, unknown>> = [];
  for (let i = 0; i < senses.length; i++) {
    const sense = senses[i]!;
    for (let j = 0; j < (sense.examples ?? []).length; j++) {
      const ex = sense.examples![j]!;
      const jp = ex.jp || "";
      const keyword = (ex.keyword || "").trim() || guessKeyword(jp);
      examples.push({ id: `${entryKeyNum}-${i}-${j}`, jp, en: ex.en || "", ex_text: keyword, source: SOURCE_ID });
    }
  }

  const entry: DictEntry = {
    source: SOURCE_ID,
    dict: SOURCE_TITLE,
    seq: entryKeyNum,
    common,
    kanji: expressions,
    readings,
    senses,
    score: maxScore,
  };
  if (forms.length) entry.forms = forms;
  if (pitch.length) {
    entry.pitch = pitch;
    entry.pitch_display = pitch.map(String).join("/");
  }
  if (examples.length) entry.examples = examples;

  // Pitch accent, frequency rank and JLPT level folded into the term table at build time.
  const pitchCol = rows.map((r) => r.pitch).find((v) => v != null && v !== "");
  if (pitchCol != null && !entry.pitch_display) entry.pitch_display = String(pitchCol);
  const freqs = rows.map((r) => Number(r.freq)).filter((n) => Number.isFinite(n) && n > 0);
  if (freqs.length) entry.freq = Math.min(...freqs);
  const jlptCol = rows.map((r) => r.jlpt).find((v) => v != null && v !== "");
  if (jlptCol != null) entry.jlpt = [String(jlptCol)];

  void payload;
  return entry;
}

function rowsToUniqueEntries(rows: TermRow[], limit: number): DictEntry[] {
  const groups = new Map<string, TermRow[]>();
  const order: string[] = [];
  for (const row of rows) {
    const key = entryKey(row);
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(row);
  }
  const results: DictEntry[] = [];
  for (const key of order) {
    const group = groups.get(key)!;
    const entry = groupTermsToEntry(group, publicId(group[0]!));
    if (entry) results.push(entry);
    if (results.length >= limit) break;
  }
  return results;
}

/* ---------------- entry helpers (conj engine) ---------------- */

export function entryPosTags(entry: DictEntry): string[] {
  const tags: string[] = [];
  for (const sense of entry.senses ?? []) tags.push(...(sense.pos ?? []));
  return tags;
}

function entryReading(entry: DictEntry): string {
  return entry.readings?.[0] ?? "";
}

function entryLemmaText(entry: DictEntry): string {
  if (entry.kanji?.length) return entry.kanji[0]!;
  return entry.readings?.[0] ?? "";
}

function entryGodanPos(entry: DictEntry): string | null {
  for (const tag of entryPosTags(entry)) if (tag.startsWith("v5")) return tag;
  return null;
}

function rankSuruEntries(entries: DictEntry[]): DictEntry[] {
  return [...entries].sort((a, b) => {
    const ar = a.readings?.[0];
    const br = b.readings?.[0];
    const ak = a.kanji;
    const bk = b.kanji;
    return (
      (ar === "する" ? 0 : 1) - (br === "する" ? 0 : 1) ||
      (!ak?.length || (ak.length === 1 && ak[0] === "する") ? 0 : 1) -
        (!bk?.length || (bk.length === 1 && bk[0] === "する") ? 0 : 1) ||
      (a.common ? 0 : 1) - (b.common ? 0 : 1)
    );
  });
}

function withVsCompounds(text: string, entries: DictEntry[], prefixEntries: DictEntry[]): DictEntry[] {
  if (entries.length || !text.endsWith("する") || text.length <= 2) return entries;
  const out = [...entries];
  for (const e of prefixEntries) {
    const tags = entryPosTags(e);
    if (tags.some((t) => t.startsWith("vs") || t === "n")) {
      out.push({ ...e, _vs_compound: true, _vs_lemma: text });
    }
  }
  return out;
}

function validLemma(lemma: string): boolean {
  if (!lemma || lemma.endsWith("るる") || lemma.endsWith("するする")) return false;
  if (lemma.length === 1 && !PARTICLE_LEMMAS.has(lemma)) {
    if ([...lemma].every((c) => (c >= "぀" && c <= "ゟ") || (c >= "゠" && c <= "ヿ"))) {
      return false;
    }
  }
  if (lemma.includes("るる") && !lemma.endsWith("走る")) return false;
  return true;
}

function normalizeStepOrder(steps: ConjStep[]): ConjStep[] {
  return [...steps].sort(
    (a, b) =>
      (CONJ_STEP_PRIORITY[a.conj_type] ?? ORDERED_CONJ_TYPES.length) -
      (CONJ_STEP_PRIORITY[b.conj_type] ?? ORDERED_CONJ_TYPES.length),
  );
}

function scoreCandidate(lemma: string, steps: ConjStep[], entries: DictEntry[], surface: string): number {
  if (!entries.length) return -1;
  const best = entries[0]!;
  let score = 0;
  if (best.common) score += 2;
  const lemmaText = entryLemmaText(best);
  if (lemmaText === lemma) score += 5;
  else if ((best.kanji ?? []).includes(lemma) || (best.readings ?? []).includes(lemma)) score += 3;
  const cls = pos_class(entryPosTags(best)) as string | null;
  if (cls) score += 1;
  const godanPos = entryGodanPos(best);
  for (const step of steps) {
    const hint = expected_pos_from_step(step) as string | null;
    if (hint && godanPos) {
      if (hint === godanPos) score += 3;
      else if (hint === "v5u" && ["v5u", "v5r", "v5t"].includes(godanPos)) score += 1.5;
      else if (hint.startsWith("v5") && godanPos.startsWith("v5")) score += 1;
    }
  }
  if (godanPos && cls === "godan") {
    const ending = godan_dict_ending(lemma);
    if (ending) {
      const teSuf = (GODAN_TE_SUFFIX as Record<string, string>)[ending] ?? "";
      if (teSuf && surface.endsWith(teSuf.slice(-1))) score += 2;
      if (ending === "く" && (surface.includes("いた") || surface.includes("いて"))) score += 2;
      if (["ぶ", "む", "ぬ"].includes(ending) && (surface.includes("んだ") || surface.includes("んで"))) score += 2;
      if (["う", "つ", "る"].includes(ending) && surface.includes("った")) score += 2;
    }
  }
  if (
    [
      "したら", "すれば", "しない", "して", "した", "します", "しました",
      "しなかった", "しなくて", "しないで", "しなければ", "しよう",
    ].includes(surface) ||
    surface.startsWith("しちゃ") ||
    surface.startsWith("され")
  ) {
    if (lemma === "する" || lemmaText === "する") score += 15;
    if (["汁", "知る", "為れる"].includes(lemmaText) || ["しる", "汁"].includes(lemma)) score -= 15;
  }
  if (surface.startsWith("行っ") || surface.startsWith("行き")) {
    if (lemmaText === "行く" || lemma === "行く") score += 10;
    if (lemmaText === "行う" || lemma === "行う") score -= 8;
  }
  if (surface.startsWith("いき")) {
    if (lemmaText === "行く" || ["いく", "行く"].includes(lemma)) score += 10;
    if (lemmaText === "来る" || ["くる", "来る", "く"].includes(lemma)) score -= 8;
  }
  if (lemma === "する" || lemma.endsWith("する")) {
    if (lemmaText === "する" || (!best.kanji?.length && (best.readings ?? []).includes("する"))) score += 5;
    if ((best.kanji ?? []).some((k) => k.includes("為"))) score -= 6;
    if (lemma === "して") score -= 10;
  }
  if (steps.some((s) => s.conj_type === "Past (~ta)" && ["かった", "くなかった"].includes(s.suffix || ""))) {
    if (cls === "i_adj") score += 6;
    if (["良い", "いい", "よい"].includes(lemmaText) || ["良い", "いい", "よい"].includes(lemma)) score += 8;
    if ((best.kanji ?? []).some((k) => ["宵", "酔い"].includes(k))) score -= 12;
  }
  if (steps.some((s) => s.conj_type === "Negative" && s.neg) && cls === "i_adj") score += 2;
  if (
    steps.some(
      (s) =>
        s.conj_type.startsWith("Conjunctive") ||
        ["Polite", "Desire", "Completion", "Benefactive", "Preparatory"].some((p) => s.conj_type.startsWith(p)),
    )
  ) {
    if (["godan", "ichidan", "suru", "kuru"].includes(cls ?? "")) score += 3;
    if (best._vs_compound) score += 4;
  }
  if (steps.some((s) => s.conj_type === "Imperative")) {
    if (["godan", "ichidan", "suru", "kuru"].includes(cls ?? "")) score += 2;
  }
  if (steps.some((s) => s.conj_type === "Negative imperative")) {
    if (["godan", "ichidan", "suru", "kuru"].includes(cls ?? "")) score += 3;
  }
  score -= steps.length * 0.05;
  // Extra steps beyond the first are speculative derivations (e.g. reading 見合わせた as
  // past-of-potential of 見合わす); the direct parse should win unless bonuses justify it.
  if (steps.length > 1) score -= (steps.length - 1) * 1.5;
  if (lemma === surface && steps.length) score -= 10;
  return score;
}

function stepsCompatibleWithPos(steps: ConjStep[], posTags: string[]): boolean {
  const cls = pos_class(posTags) as string | null;
  if (cls == null) {
    if (steps.some((s) => ["Past (~ta)", "Negative", "Polite", "Desire (〜たい)"].includes(s.conj_type))) {
      return posTags.some((t) => t.startsWith("v") || t.startsWith("adj"));
    }
    return true;
  }
  if (cls === "i_adj") {
    return steps.every((s) => !["Causative", "Passive", "Potential"].includes(s.conj_type));
  }
  const adjSuffixes = new Set(["かった", "くない", "くなかった", "くて", "くありません", "くありませんでした"]);
  if (steps.some((s) => adjSuffixes.has(s.suffix || ""))) return cls === "i_adj";
  return true;
}

function looksLikePotentialSurface(surface: string, posTags: string[]): boolean {
  const cls = pos_class(posTags) as string | null;
  if (cls === "ichidan" && (surface.endsWith("られる") || surface.endsWith("える"))) return true;
  if (cls === "godan") {
    const ending = godan_dict_ending(surface);
    if (ending && surface.endsWith(ending + "る") && surface.length > ending.length + 1) return true;
    if (["ける", "げる", "せる", "てる", "ねる", "べる", "める", "える", "れる"].some((s) => surface.endsWith(s))) {
      return true;
    }
  }
  return false;
}

function kanjiPrefix(surface: string): string | null {
  if (!KANJI_RE.test(surface)) return null;
  const prefix = surface.replace(TRAILING_KANA_RE, "");
  if (prefix && prefix !== surface && prefix.length > 1 && KANJI_RE.test(prefix)) return prefix;
  return null;
}

/** Frequency rank for ordering; missing data sorts last. Lower freq = more frequent word. */
function freqKey(entry: DictEntry): number {
  const f = Number(entry.freq);
  return Number.isFinite(f) && f > 0 ? f : Number.MAX_SAFE_INTEGER;
}

function entrySortKey(entry: DictEntry, surface: string): number[] {
  const seq = Number(entry.seq) || 0;
  const kanjiList = entry.kanji ?? [];
  const readings = entry.readings ?? [];
  if (KANJI_RE.test(surface)) {
    return [kanjiList.length && kanjiList[0] === surface ? 0 : 1, entry.common ? 0 : 1, freqKey(entry), seq];
  }
  const posTags = entryPosTags(entry);
  const isParticle = posTags.some((tag) => tag === "prt" || tag.includes("prt"));
  const primaryExact =
    (readings.length > 0 && readings[0] === surface) || (kanjiList.length > 0 && kanjiList[0] === surface);
  const isFunctionPos = posTags.some((tag) => FUNCTION_POS.has(tag));
  return [
    isParticle ? 0 : 1,
    entry.common ? 0 : 1,
    primaryExact ? 0 : 1,
    isFunctionPos && surface.length <= 2 ? 0 : 1,
    freqKey(entry),
    seq,
  ];
}

/** Jitendex cross-reference stubs ("⟶ 朝飯") should never outrank a real entry in a popup. */
function isRedirectEntry(entry: DictEntry): boolean {
  const first = entry.senses?.[0]?.glosses?.[0] ?? "";
  return first.startsWith("⟶") || first.startsWith("→");
}

function rankEntries(entries: DictEntry[], surface: string): DictEntry[] {
  return [...entries].sort((a, b) => {
    const ra = isRedirectEntry(a) ? 1 : 0;
    const rb = isRedirectEntry(b) ? 1 : 0;
    if (ra !== rb) return ra - rb;
    const ka = entrySortKey(a, surface);
    const kb = entrySortKey(b, surface);
    for (let i = 0; i < Math.min(ka.length, kb.length); i++) {
      if (ka[i]! < kb[i]!) return -1;
      if (ka[i]! > kb[i]!) return 1;
    }
    return 0;
  });
}

function conjugationQuerySurfaces(surface: string): string[] {
  const text = (surface || "").trim();
  if (!text) return [];
  const out: string[] = [];
  if (JAPANESE_RE.test(text)) {
    for (const s of [toHiragana(text), text]) if (!out.includes(s)) out.push(s);
  }
  return out.length ? out : [text];
}

/* ---------------- Dictionary ---------------- */

export class Dictionary {
  private entryCache = new Map<number, DictEntry | null>();
  private treeCache = new Map<string, ConjugationTree | null>();
  private exactCache = new Map<string, boolean>();

  private termColumns: string;

  constructor(private query: Query) {
    // Older installed dictionaries do not have the optional enrichment columns.
    const columns = new Set(query("PRAGMA table_info(term)").map((row) => row.name));
    this.termColumns = [TERM_COLUMNS, ...["pitch", "freq", "jlpt"].map(
      (column) => columns.has(column) ? column : `NULL AS ${column}`,
    )].join(", ");
  }

  clearCaches(): void {
    this.entryCache.clear();
    this.treeCache.clear();
    this.exactCache.clear();
  }

  private termRows(sql: string, params: unknown[]): TermRow[] {
    return this.query(sql, params);
  }

  private fuzzyKanaTermRows(text: string, limit = 200): TermRow[] {
    if (!isKanaHeavy(text)) return [];
    const key = fuzzyKanaKey(text);
    if (key.length < 2) return [];
    const prefixH = key.slice(0, 2);
    const prefixK = toKatakana(prefixH);
    const kataCount = [...text].filter((ch) => (ch >= "ァ" && ch <= "ヶ") || "ー・".includes(ch)).length;
    const prefixes = kataCount >= text.length / 2 ? [prefixK] : [prefixH, prefixK];
    const rows: TermRow[] = [];
    const seenIds = new Set<number>();
    for (const prefix of prefixes) {
      const chunk = this.termRows(
        `SELECT ${this.termColumns} FROM term
         WHERE expression LIKE ? OR reading LIKE ?
         ORDER BY score DESC, id LIMIT 400`,
        [`${prefix}%`, `${prefix}%`],
      );
      for (const row of chunk) {
        const rid = Number(row.id);
        if (seenIds.has(rid)) continue;
        for (const field of [row.expression, row.reading]) {
          if (field && fuzzyKanaKey(String(field)) === key) {
            seenIds.add(rid);
            rows.push(row);
            break;
          }
        }
        if (rows.length >= limit) return rows;
      }
    }
    return rows;
  }

  /** Exact (plus kana-variant and fuzzy-kana) surface lookup. */
  lookupSurface(text: string, limit = 20): DictEntry[] {
    if (!text) return [];
    let variants = JAPANESE_RE.test(text) ? japaneseQueryVariants(text) : [text];
    variants = [...new Set(variants)];
    const placeholders = variants.map(() => "?").join(",");
    let rows = this.termRows(
      `SELECT ${this.termColumns} FROM term
       WHERE expression IN (${placeholders}) OR reading IN (${placeholders})
       ORDER BY score DESC, id LIMIT ?`,
      [...variants, ...variants, limit * 8],
    );
    if (!rows.length && JAPANESE_RE.test(text)) rows = this.fuzzyKanaTermRows(text, limit * 5);
    return rowsToUniqueEntries(rows, limit);
  }

  /**
   * Strict surface lookup: exact expression/reading equality on kana-script variants only.
   * Subtitle text is exact, so spelling-tolerant fuzzy variants are left to the last-resort
   * path in lookupSegment — otherwise inflected kana forms resolve to look-alike nouns.
   */
  private lookupSurfaceStrict(text: string, limit = 20): DictEntry[] {
    if (!text) return [];
    const variants = [...new Set(JAPANESE_RE.test(text) ? kanaSearchVariants(text) : [text])];
    const placeholders = variants.map(() => "?").join(",");
    const rows = this.termRows(
      `SELECT ${this.termColumns} FROM term
       WHERE expression IN (${placeholders}) OR reading IN (${placeholders})
       ORDER BY score DESC, id LIMIT ?`,
      [...variants, ...variants, limit * 8],
    );
    return rowsToUniqueEntries(rows, limit);
  }

  /** Strict equality on expression/reading (kana variants only), used by segment repair. */
  isExactHeadword(surface: string): boolean {
    if (!surface || surface.length < 2) return false;
    const cached = this.exactCache.get(surface);
    if (cached !== undefined) return cached;
    const variants = [...new Set(kanaSearchVariants(surface))];
    const placeholders = variants.map(() => "?").join(",");
    const rows = this.termRows(
      `SELECT id FROM term WHERE expression IN (${placeholders}) OR reading IN (${placeholders}) LIMIT 1`,
      [...variants, ...variants],
    );
    const hit = rows.length > 0;
    if (this.exactCache.size > 5000) this.exactCache.clear();
    this.exactCache.set(surface, hit);
    return hit;
  }

  getEntry(seq: number): DictEntry | null {
    if (this.entryCache.has(seq)) return this.entryCache.get(seq) ?? null;
    let rows = this.termRows(`SELECT ${this.termColumns} FROM term WHERE sequence = ? ORDER BY id`, [seq]);
    let entryKeyNum: number;
    if (!rows.length) {
      const seed = this.termRows(`SELECT ${this.termColumns} FROM term WHERE id = ?`, [seq])[0];
      if (!seed) {
        this.entryCache.set(seq, null);
        return null;
      }
      rows = this.termRows(
        `SELECT ${this.termColumns} FROM term WHERE expression = ? AND reading = ? ORDER BY score DESC, id`,
        [seed.expression, seed.reading],
      );
      entryKeyNum = Number(seed.id);
    } else {
      entryKeyNum = seq;
    }
    const entry = groupTermsToEntry(rows, entryKeyNum);
    if (this.entryCache.size > 2000) this.entryCache.clear();
    this.entryCache.set(seq, entry);
    return entry;
  }

  private lookupForConj(text: string): DictEntry[] {
    let entries = this.lookupSurfaceStrict(text, 20);
    if (text === "する") entries = rankSuruEntries(entries);
    if (!entries.length && text.endsWith("する") && text.length > 2) {
      entries = withVsCompounds(text, entries, this.lookupSurfaceStrict(text.slice(0, -2), 20));
    }
    return entries;
  }

  private buildTreeResult(
    lemma: string,
    steps: ConjStep[],
    entry: DictEntry,
    surface: string,
    posTags: string[],
  ): ConjugationTree {
    steps = normalizeStepOrder(steps);
    let rootText = entry._vs_lemma || entryLemmaText(entry);
    if (entry._vs_compound && !rootText.endsWith("する")) rootText = `${entryLemmaText(entry)}する`;
    if ((entry.readings ?? [])[0] === "する" && ["為る", "刷る", "擦る", "掏る", "剃る"].includes(rootText)) {
      rootText = "する";
    }
    let tags = posTags;
    if (entry._vs_compound && !tags.includes("vs")) tags = [...tags, "vs"];
    void lemma;
    return {
      root_text: rootText,
      root_reading: entryReading(entry),
      root_seq: entry.seq,
      steps: reconstruct_forms(rootText, steps, tags, surface),
    };
  }

  private treeFromPeels(surface: string): ConjugationTree | null {
    const raw = deconjugate_recursive(surface);
    if (!raw.length) return null;
    let best: [string, ConjStep[], DictEntry] | null = null;
    let bestScore = -1;
    const seen = new Set<string>();
    for (const [lemma, steps] of raw) {
      if (!lemma || !steps.length || !validLemma(lemma)) continue;
      if ((lemma.endsWith("て") || lemma.endsWith("で") || lemma.endsWith("して")) && lemma.length <= 3) continue;
      // A te-auxiliary peel that produced a non-te stem (待てる → 待て) can chain into an
      // imperative peel (待て → 待つ); "imperative of a progressive" is not a real derivation.
      if (
        steps.some(
          (s, i) =>
            i > 0 &&
            (s.conj_type === "Imperative" || s.conj_type === "Negative imperative") &&
            (steps[i - 1]!.conj_type.startsWith("Conjunctive") ||
              steps[i - 1]!.conj_type === "Progressive (ている)"),
        )
      )
        continue;
      const key = `${lemma}|${steps.map((s) => s.conj_type).join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const entries = this.lookupForConj(lemma);
      if (!entries.length) continue;
      const compatible = rankEntries(
        entries.filter((e) => stepsCompatibleWithPos(steps, entryPosTags(e))),
        lemma,
      );
      if (!compatible.length) continue;
      const entry = compatible[0]!;
      const score = scoreCandidate(lemma, steps, [entry], surface);
      // On a score tie or near-tie a much more frequent lemma wins
      // (分かる over 分かつ, ある over 合う for あって).
      const nearTie =
        best !== null && score <= bestScore && score >= bestScore - 2 &&
        freqKey(entry) * 3 < freqKey(best[2]);
      if (score > bestScore || nearTie) {
        bestScore = score;
        best = [lemma, steps, entry];
      }
    }
    if (!best) return null;
    const [lemma, steps, entry] = best;
    return this.buildTreeResult(lemma, [...steps].reverse(), entry, surface, entryPosTags(entry));
  }

  private treeFromDictionaryPotential(surface: string): ConjugationTree | null {
    const entries = this.lookupForConj(surface);
    if (!entries.length) return null;
    const entry = entries[0]!;
    const posTags = entryPosTags(entry);
    if (!looksLikePotentialSurface(surface, posTags)) return null;
    const peelTree = this.treeFromPeels(surface);
    if (peelTree && peelTree.root_text !== surface) {
      const peelEntry = peelTree.root_seq != null ? this.getEntry(Number(peelTree.root_seq)) : null;
      if (peelEntry?.common) return peelTree;
    }
    const step = conjStep({ conj_type: "Potential", suffix: surface, gloss: "ability" });
    return this.buildTreeResult(surface, [step], entry, surface, posTags);
  }

  private getConjugationTreeRules(surface: string): ConjugationTree | null {
    if (!surface) return null;
    if (this.treeCache.has(surface)) return this.treeCache.get(surface) ?? null;
    let tree = this.treeFromPeels(surface);
    if (!tree) tree = this.treeFromDictionaryPotential(surface);
    if (this.treeCache.size > 2000) this.treeCache.clear();
    this.treeCache.set(surface, tree);
    return tree;
  }

  getConjugationTree(surface: string): ConjugationTree | null {
    for (const form of conjugationQuerySurfaces(surface)) {
      const tree = this.getConjugationTreeRules(form);
      if (tree && tree.root_seq && tree.steps?.length) return tree;
    }
    return null;
  }

  /**
   * Full conjugation paradigm for a dictionary entry (Dictionary/Polite/Past/Te/Negative/...),
   * generated forward from the lemma with the rules engine. Null for non-conjugable entries.
   */
  getEntryConjugations(seq: number): Array<{ label: string; form: string; reading: string }> | null {
    const entry = this.getEntry(seq);
    if (!entry) return null;
    const posTags = entryPosTags(entry);
    if (pos_class(posTags) == null) return null;
    const lemma = entryLemmaText(entry);
    const reading = entryReading(entry);
    const forms = forward_conjugate(lemma, posTags) as Record<string, string> | null;
    if (!forms || !Object.keys(forms).length) return null;
    const readingForms =
      reading && reading !== lemma ? (forward_conjugate(reading, posTags) as Record<string, string> | null) : null;
    const out: Array<{ label: string; form: string; reading: string }> = [];
    for (const label of PARADIGM_KEYS) {
      const form = forms[label];
      if (!form) continue;
      // Paradigm cells the rules engine cannot derive are filled with the lemma itself
      // (e.g. i-adjective Potential/Passive/Imperative); don't show those as real forms.
      if (label !== "Dictionary" && form === lemma) continue;
      const formReading = readingForms?.[label] ?? (reading && form === lemma ? reading : "");
      out.push({ label, form, reading: formReading || "" });
    }
    return out.length ? out : null;
  }

  /**
   * Per-token resolution: strict exact → deconjugation → kanji prefix → fuzzy kana.
   * Deinflection beats exact hits that are only stubs/non-common rows, and beats
   * reading-only matches for kana surfaces (kana verb forms like した, いない).
   */
  lookupSegment(surface: string): LookupResult {
    const result: LookupResult = { surface, entries: [], best: null };
    if (!surface) return result;

    const variants = new Set(kanaSearchVariants(surface));
    const exact = rankEntries(
      this.lookupSurfaceStrict(surface, 20).filter((e) => !isRedirectEntry(e) && e.score >= 0),
      surface,
    );

    const tree = this.getConjugationTree(surface);
    const treeEntry = tree?.root_seq ? this.getEntry(Number(tree.root_seq)) : null;

    const kanaSurface = !KANJI_RE.test(surface);
    const isKanaPrimary = (e: DictEntry) =>
      !(e.kanji ?? []).length && (e.readings ?? []).some((r) => variants.has(r));
    const exactCommon = exact.some((e) => e.common);
    const commonKanaPrimary = exact.some((e) => e.common && isKanaPrimary(e));

    const treeFirst =
      !!tree &&
      !!treeEntry &&
      (!exact.length ||
        (treeEntry.common && !exactCommon) ||
        (kanaSurface && treeEntry.common && !commonKanaPrimary));

    if (treeFirst && tree && treeEntry) {
      const steps = tree.steps ?? [];
      result.entries = [treeEntry, ...exact.filter((e) => e.seq !== treeEntry.seq)];
      result.best = treeEntry;
      result.source_text = tree.root_text;
      result.conj_type = steps.length ? String(steps[steps.length - 1]!.conjType ?? "") || null : null;
      result.conjugation = tree;
      return result;
    }

    if (exact.length) {
      result.entries = exact;
      result.best = exact[0] ?? null;
      return result;
    }

    // Kanji-prefix fallback: only when deinflection found nothing (思い出した must reach
    // 思い出す via the tree before the stem 思い出 wins as a noun).
    const prefix = kanjiPrefix(surface);
    if (prefix) {
      const entries = rankEntries(
        this.lookupSurfaceStrict(prefix, 20).filter((e) => !isRedirectEntry(e) && e.score >= 0),
        prefix,
      );
      if (entries.length) {
        result.entries = entries;
        result.best = entries[0] ?? null;
        return result;
      }
    }

    // Last resort: spelling-tolerant kana matching (variant forms the strict pass missed).
    if (JAPANESE_RE.test(surface)) {
      const fuzzy = rankEntries(
        rowsToUniqueEntries(this.fuzzyKanaTermRows(surface, 100), 20).filter((e) => !isRedirectEntry(e)),
        surface,
      );
      if (fuzzy.length) {
        result.entries = fuzzy;
        result.best = fuzzy[0] ?? null;
      }
    }
    return result;
  }

  /* ---------------- segment repair (analyze.ts) ---------------- */

  private peelOvermergedCompound(left: string, tail: string): [string, string] | null {
    if (!COMPOUND_TAILS.has(tail) || left.length < 2) return null;
    if (this.isExactHeadword(left + tail)) return null;
    let best: [string, string] | null = null;
    for (let k = 1; k < left.length; k++) {
      const head = left.slice(0, k);
      const rest = left.slice(k);
      const compound = rest + tail;
      if (this.isExactHeadword(head) && this.isExactHeadword(compound)) {
        if (best == null || compound.length > best[1].length) best = [head, compound];
      }
    }
    return best;
  }

  private allowCompoundSpan(segments: string[], start: number, end: number): boolean {
    if (end <= start) return false;
    const combo = segments.slice(start, end + 1).join("");
    if (!this.isExactHeadword(combo)) return false;
    const first = segments[start]!;
    const last = segments[end]!;
    if (PARTICLE_SURFACES.has(last) && end === start + 1) return false;
    if (PARTICLE_SURFACES.has(first) && end === start + 1) return false;
    return true;
  }

  /** Peel over-merged compounds and merge adjacent segments that form a dictionary headword. */
  repairSplitSegments(segments: string[]): string[] {
    if (segments.length < 2) return segments;
    let segs = [...segments];
    let i = 0;
    while (i < segs.length - 1) {
      const peeled = this.peelOvermergedCompound(segs[i]!, segs[i + 1]!);
      if (peeled) {
        segs = [...segs.slice(0, i), peeled[0], peeled[1], ...segs.slice(i + 2)];
        continue;
      }
      i += 1;
    }
    i = 0;
    while (i < segs.length) {
      let bestJ = i;
      const upper = Math.min(segs.length, i + MAX_COMPOUND_MERGE_WINDOW);
      for (let j = i + 1; j < upper; j++) if (this.allowCompoundSpan(segs, i, j)) bestJ = j;
      if (bestJ > i) segs = [...segs.slice(0, i), segs.slice(i, bestJ + 1).join(""), ...segs.slice(bestJ + 1)];
      i += 1;
    }
    return segs;
  }
}

export { conjStepToDict, CONJ_POS };
