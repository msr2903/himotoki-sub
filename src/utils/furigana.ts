const KANJI_RE = /[一-鿿々〆ヶ]/;

export const hasKanji = (text: string): boolean => KANJI_RE.test(text);

/**
 * Reading to show above a surface form, derived from the dictionary headword and its reading.
 * For conjugated forms (食べた vs 食べる/たべる) the shared kana ending of headword and reading is
 * treated as okurigana: stem reading + the surface's own ending → たべた.
 * Returns null when the surface has no kanji (nothing to annotate) or no reading is known.
 */
export const surfaceReading = (surface: string, headword?: string, reading?: string): string | null => {
  if (!reading || !hasKanji(surface)) return null;
  if (!headword || headword === surface) return reading;
  // A kana-only headword gives no way to align kanji in the surface; better no furigana than wrong furigana.
  if (!hasKanji(headword)) return null;

  // 来る is irregular: 来る/来れば → く…, 来ない/来い/来よう/来させる/来られる/来ず/来まい/来れる → こ…,
  // otherwise 来 → き (来た, 来て, 来ます, 来たる…).
  if (headword === "来る" && surface.startsWith("来")) {
    const rest = surface.slice(1);
    if (hasKanji(rest)) return null;
    if (rest.startsWith("る") || rest.startsWith("れば")) return `く${rest}`;
    if (/^(れ|な|い|ん|よ|さ|ら|ず|まい)/.test(rest)) return `こ${rest}`;
    return `き${rest}`;
  }

  const h = [...headword];
  const r = [...reading];
  let shared = 0;
  while (shared < h.length && shared < r.length && h[h.length - 1 - shared] === r[r.length - 1 - shared]) {
    shared += 1;
  }
  const stemK = h.slice(0, h.length - shared).join("");
  const stemR = r.slice(0, r.length - shared).join("");
  if (stemK && surface.startsWith(stemK)) {
    const rest = surface.slice(stemK.length);
    if (!hasKanji(rest)) return stemR + rest;
  }
  // Surface does not contain the headword stem (e.g. a mis-resolved lemma): no furigana.
  return null;
};

/** Katakana → hiragana so a katakana surface char matches its hiragana reading. */
const toHiragana = (text: string): string =>
  text.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));

/** A run of the surface: either plain text or a kanji run that carries a reading above it. */
export type RubySegment = { text: string; rt?: string };

/**
 * Align a surface with its reading so ruby sits only over the kanji runs, leaving kana (okurigana)
 * as plain text: 食べた → 食「た」べた, not 食べた「たべた」. Returns null when there is nothing to
 * annotate. Falls back to a single ruby over the whole surface if the kana anchors do not line up.
 */
export const furiganaSegments = (surface: string, headword?: string, reading?: string): RubySegment[] | null => {
  const full = surfaceReading(surface, headword, reading);
  if (!full) return null;

  // Split the surface into alternating kanji / non-kanji runs.
  const runs: Array<{ kanji: boolean; text: string }> = [];
  for (const ch of surface) {
    const kanji = hasKanji(ch);
    const last = runs[runs.length - 1];
    if (last && last.kanji === kanji) last.text += ch;
    else runs.push({ kanji, text: ch });
  }

  const whole: RubySegment[] = [{ text: surface, rt: full }];
  const fullH = toHiragana(full);
  const segments: RubySegment[] = [];
  let p = 0; // pointer into full / fullH
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i]!;
    if (!run.kanji) {
      // A kana run must appear verbatim (katakana-normalised) at the current point in the reading.
      const runH = toHiragana(run.text);
      if (!fullH.startsWith(runH, p)) return whole;
      segments.push({ text: run.text });
      p += runH.length;
      continue;
    }
    const next = runs[i + 1];
    if (!next) {
      // Trailing kanji run takes the rest of the reading.
      const rt = full.slice(p);
      segments.push(rt ? { text: run.text, rt } : { text: run.text });
      p = full.length;
      continue;
    }
    // Kanji run reading is everything up to where the following kana run begins in the
    // reading. Search from p + 1: a kanji run always has at least one kana of reading,
    // otherwise the kana anchoring at p itself leaves the kanji with no ruby (言い方).
    const idx = fullH.indexOf(toHiragana(next.text), p + 1);
    if (idx <= p) return whole;
    const rt = full.slice(p, idx);
    segments.push(rt ? { text: run.text, rt } : { text: run.text });
    p = idx;
  }
  return segments;
};

/** First gloss, trimmed for an inline label. */
export const shortGloss = (gloss: string, maxLength = 26): string => {
  const first = (gloss || "").split(/;|,/)[0]?.trim() ?? "";
  if (first.length <= maxLength) return first;
  return `${first.slice(0, maxLength - 1)}…`;
};
