import { describe, it, expect } from "vitest";
import { Dictionary, type DictEntry } from "./lookup";

// Regression tests for the subtitle lookup path (GitHub issues #56, #57, #62, #64,
// #65, #79, #83, #87, #88): inflected kana forms must deinflect to their verb
// instead of resolving to look-alike nouns, rare/redirect rows must not outrank
// or block common entries, and frequency decides homograph ties.
//
// The Dictionary takes an injected synchronous query function; the shim below
// emulates the handful of SQL shapes lookup.ts issues against the `term` table.

type Row = Record<string, unknown>;

const COLUMNS = [
  "id", "expression", "reading", "def_tags", "rules", "score", "sequence",
  "term_tags", "glossary_json", "expression_raw", "pitch", "freq", "jlpt",
];

function makeQuery(rows: Row[]) {
  const byScoreId = (a: Row, b: Row) =>
    Number(b.score || 0) - Number(a.score || 0) || Number(a.id) - Number(b.id);
  return (sql: string, params: unknown[] = []): Row[] => {
    if (sql.includes("PRAGMA")) return COLUMNS.map((name) => ({ name }));
    if (sql.includes("expression IN (")) {
      const variants = params.slice(0, (params.length - 1) / 2);
      const limit = Number(params[params.length - 1]);
      return rows
        .filter((r) => variants.includes(r.expression) || variants.includes(r.reading))
        .sort(byScoreId)
        .slice(0, limit);
    }
    if (sql.includes("LIKE ?")) {
      const prefix = String(params[0]).replace(/%$/, "");
      return rows
        .filter((r) => String(r.expression).startsWith(prefix) || String(r.reading).startsWith(prefix))
        .sort(byScoreId);
    }
    if (sql.includes("sequence = ?"))
      return rows.filter((r) => r.sequence === params[0]).sort((a, b) => Number(a.id) - Number(b.id));
    if (sql.includes("expression = ?"))
      return rows.filter((r) => r.expression === params[0] && r.reading === params[1]).sort(byScoreId);
    if (sql.includes("id = ?")) return rows.filter((r) => r.id === params[0]);
    return [];
  };
}

let nextId = 1;
const T = (
  expression: string,
  reading: string,
  rules: string,
  score: number,
  sequence: number,
  gloss: string,
  freq?: number,
): Row => ({
  id: nextId++,
  expression,
  reading,
  def_tags: "",
  rules,
  score,
  sequence,
  term_tags: "",
  glossary_json: JSON.stringify([gloss]),
  expression_raw: "",
  pitch: "",
  freq: freq ?? null,
  jlpt: "",
});

const ROWS: Row[] = [
  T("書く", "かく", "v5k", 200, 1, "to write", 263),
  T("思い出", "おもいで", "n", 200, 2, "memory"),
  T("思い出す", "おもいだす", "v5s", 200, 3, "to recall", 502),
  T("成る", "なる", "v5r", 200, 4, "to become", 16),
  T("鉈", "なた", "n", 200, 5, "hatchet", 50000),
  T("板", "いた", "n", 200, 6, "board", 3948),
  T("いる", "いる", "v1", 200, 7, "to be (animate)", 18),
  T("見る", "みる", "v1", 200, 8, "to see", 36),
  // #88: 為る is a rarely-used spelling grouped under する's sequence; it must not
  // become the entry's headword.
  T("する", "する", "vs-i", 200, 9, "to do", 11),
  T("為る", "する", "vs-i", -101, 9, "to do", 11),
  T("知る", "しる", "v5r", 200, 10, "to know", 63),
  T("勝つ", "かつ", "v5t", 200, 11, "to win", 624),
  T("勝る", "まさる", "v5r", 200, 12, "to excel", 7152),
  T("帰る", "かえる", "v5r", 200, 13, "to return", 177),
  T("待つ", "まつ", "v5t", 200, 14, "to wait", 102),
  T("分かる", "わかる", "v5r", 200, 15, "to understand", 455),
  T("分かつ", "わかつ", "v5t", 200, 16, "to divide", 18689),
  T("言う", "いう", "v5u", 200, 17, "to say", 27),
  // #65: redirect stub rows (negative score, ⟶ gloss) must not block deinflection.
  T("言った", "いった", "exp", -106, 18, "⟶ 言う"),
  T("来る", "くる", "vk", 200, 19, "to come", 38),
  T("有る", "ある", "v5r-i", 200, 20, "to exist", 14),
  T("合う", "あう", "v5u", 200, 21, "to fit", 408),
  T("会う", "あう", "v5u", 200, 22, "to meet", 172),
  T("入る", "はいる", "v5r", 200, 23, "to enter", 113),
  T("入る", "いる", "v5r", 200, 24, "to put in", 7401),
  T("下手", "へた", "adj-na", 200, 25, "unskillful", 2048),
  T("下手", "したて", "n", 100, 26, "humble position"),
  T("如何", "どう", "adv", 200, 27, "how;in what way", 85),
  T("どう", "どう", "int", 200, 28, "whoa"),
  T("何で", "なんで", "adv", 200, 29, "why", 484),
  T("なんで", "なんで", "exp conj", -1, 30, "because"),
  T("高い", "たかい", "adj-i", 200, 31, "high", 265),
  T("泳ぐ", "およぐ", "v5g", 200, 32, "to swim", 2091),
  T("話す", "はなす", "v5s", 200, 33, "to talk", 163),
  T("気付く", "きづく", "v5k", 200, 34, "to notice", 571),
  T("気付", "きづき", "n", 200, 35, "awareness"),
  T("走る", "はしる", "v5r", 200, 36, "to run", 306),
  T("思う", "おもう", "v5u", 200, 37, "to think", 20),
  T("見合わせる", "みあわせる", "v1", 200, 38, "to postpone;to exchange glances", 3396),
  T("見合わす", "みあわす", "v5s", 0, 39, "to exchange glances", 52230),
  T("出会う", "であう", "v5u", 200, 40, "to meet by chance", 858),
  T("仕上げる", "しあげる", "v1", 200, 41, "to finish up", 6960),
  T("知り合う", "しりあう", "v5u", 200, 42, "to get acquainted", 4316),
  T("消す", "けす", "v5s", 200, 43, "to erase", 1075),
  T("買う", "かう", "v5u", 200, 44, "to buy", 309),
  T("切る", "きる", "v5r", 200, 45, "to cut", 412),
  T("打つ", "うつ", "v5t", 200, 46, "to hit", 922),
  T("持つ", "もつ", "v5t", 200, 47, "to hold", 109),
  T("洗う", "あらう", "v5u", 200, 48, "to wash", 1703),
  T("死ぬ", "しぬ", "v5n", 200, 49, "to die", 166),
  T("遊ぶ", "あそぶ", "v5b", 200, 50, "to play", 731),
  T("読む", "よむ", "v5m", 200, 51, "to read", 312),
  T("飲む", "のむ", "v5m", 200, 52, "to drink", 305),
  T("行く", "いく", "v5k-s", 200, 53, "to go", 44),
  T("食べる", "たべる", "v1", 200, 54, "to eat", 184),
  T("寒い", "さむい", "adj-i", 200, 55, "cold", 1174),
  T("良い", "よい", "adj-i", 200, 56, "good", 139),
  T("下", "した", "n", 200, 57, "below", 308),
  T("三田", "みた", "n", 100, 58, "Mita (name)"),
];

const dict = new Dictionary(makeQuery(ROWS));
const headword = (e: DictEntry | null | undefined) => e?.kanji?.[0] ?? e?.readings?.[0] ?? null;

describe("lookupSegment — godan past forms (#56)", () => {
  it.each([
    ["書いた", "書く"],
    ["泳いだ", "泳ぐ"],
    ["話した", "話す"],
    ["消した", "消す"],
    ["読んだ", "読む"],
    ["死んだ", "死ぬ"],
    ["遊んだ", "遊ぶ"],
  ])("deinflects %s → %s", (surface, lemma) => {
    const r = dict.lookupSegment(surface);
    expect(headword(r.best)).toBe(lemma);
    expect(r.conj_type).toBe("Past (~ta)");
  });
});

describe("lookupSegment — deinflection beats kanji-prefix noun (#57)", () => {
  it.each([
    ["思い出した", "思い出す"],
    ["気付いた", "気付く"],
    ["出会った", "出会う"],
    ["仕上げた", "仕上げる"],
    ["知り合った", "知り合う"],
  ])("deinflects %s → %s", (surface, lemma) => {
    expect(headword(dict.lookupSegment(surface).best)).toBe(lemma);
  });

  it("見合わせた prefers the direct past of 見合わせる over a potential+past chain", () => {
    const r = dict.lookupSegment("見合わせた");
    expect(headword(r.best)).toBe("見合わせる");
    expect(r.conjugation?.steps?.length).toBe(1);
  });
});

describe("lookupSegment — kana past forms don't fuzzy-match nouns (#62)", () => {
  it.each([
    ["なった", "成る"],
    ["あった", "有る"],
    ["いった", "言う"],
    ["かった", "買う"],
    ["きった", "切る"],
    ["うった", "打つ"],
    ["もった", "持つ"],
    ["あらった", "洗う"],
  ])("deinflects %s → %s", (surface, lemma) => {
    const r = dict.lookupSegment(surface);
    expect(headword(r.best)).toBe(lemma);
    expect(r.conj_type).toBe("Past (~ta)");
  });

  it("does not surface the fuzzy look-alike noun 鉈 for なった", () => {
    const r = dict.lookupSegment("なった");
    expect(r.entries.map((e) => e.seq)).not.toContain(5);
  });
});

describe("lookupSegment — frequency decides homographs (#64)", () => {
  it("わかった resolves to 分かる, not 分かつ", () => {
    const r = dict.lookupSegment("わかった");
    expect(headword(r.best)).toBe("分かる");
  });
  it("入る prefers the common はいる reading", () => {
    const r = dict.lookupSegment("入る");
    expect(r.best?.readings?.[0]).toBe("はいる");
  });
  it("入って deinflects to はいる 入る", () => {
    const r = dict.lookupSegment("入って");
    expect(r.best?.readings?.[0]).toBe("はいる");
    expect(r.conj_type).toBe("Conjunctive (~te)");
  });
  it("下手 prefers へた over したて", () => {
    expect(dict.lookupSegment("下手").best?.readings?.[0]).toBe("へた");
  });
});

describe("lookupSegment — redirect stubs don't block deinflection (#65)", () => {
  it.each([
    ["言った", "言う"],
    ["来た", "来る"],
  ])("deinflects %s → %s", (surface, lemma) => {
    expect(headword(dict.lookupSegment(surface).best)).toBe(lemma);
  });
});

describe("lookupSegment — common entries outrank rare kana ones (#79)", () => {
  it("どう resolves to the common 'how' entry", () => {
    const r = dict.lookupSegment("どう");
    expect(r.best?.seq).toBe(27);
  });
  it("なんで resolves to 何で", () => {
    expect(headword(dict.lookupSegment("なんで").best)).toBe("何で");
  });
});

describe("lookupSegment — kana verb forms beat noun readings (#83)", () => {
  it.each([
    ["した", "する", "Past (~ta)"],
    ["しない", "する", "Negative"],
    ["しよう", "する", "Volitional"],
    ["しなかった", "する", "Past (~ta)"],
    ["きた", "来る", "Past (~ta)"],
    ["いない", "いる", "Negative"],
    ["いた", "いる", "Past (~ta)"],
    ["みた", "見る", "Past (~ta)"],
    ["あって", "有る", "Conjunctive (~te)"],
  ])("deinflects %s → %s (%s)", (surface, lemma, conj) => {
    const r = dict.lookupSegment(surface);
    expect(headword(r.best)).toBe(lemma);
    expect(r.conj_type).toBe(conj);
  });

  it("keeps exact noun hits as alternatives for した", () => {
    const r = dict.lookupSegment("した");
    expect(r.entries.some((e) => e.kanji?.includes("下"))).toBe(true);
  });
});

describe("lookupSegment — godan potential isn't a fake chain (#87)", () => {
  it.each([
    ["帰れる", "帰る"],
    ["待てる", "待つ"],
    ["走れる", "走る"],
    ["勝てる", "勝つ"],
  ])("deinflects %s → %s as Potential", (surface, lemma) => {
    const r = dict.lookupSegment(surface);
    expect(headword(r.best)).toBe(lemma);
    expect(r.conj_type).toBe("Potential");
    expect(r.conjugation?.steps?.length).toBe(1);
  });
});

describe("lookupSegment — rare spellings don't become headwords (#88)", () => {
  it("した shows する, not the rare 為る spelling", () => {
    const r = dict.lookupSegment("した");
    expect(r.best?.kanji ?? []).not.toContain("為る");
    expect(headword(r.best)).toBe("する");
  });
});

describe("getEntryConjugations", () => {
  it("generates kana readings for 来る (#88)", () => {
    const rows = dict.getEntryConjugations(19) ?? [];
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r]));
    expect(byLabel["Polite"]).toMatchObject({ form: "来ます", reading: "きます" });
    expect(byLabel["Past"]).toMatchObject({ form: "来た", reading: "きた" });
    expect(byLabel["Negative"]).toMatchObject({ form: "来ない", reading: "こない" });
    expect(byLabel["Imperative"]).toMatchObject({ form: "来い", reading: "こい" });
  });

  it("does not emit fake verb paradigms for i-adjectives (#88)", () => {
    const rows = dict.getEntryConjugations(31) ?? [];
    const labels = rows.map((r) => r.label);
    expect(labels).toContain("Past");
    expect(labels).not.toContain("Potential");
    expect(labels).not.toContain("Passive");
    expect(labels).not.toContain("Imperative");
    expect(rows.find((r) => r.label === "Past")?.form).toBe("高かった");
  });
});
