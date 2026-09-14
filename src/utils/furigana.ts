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

  // 来る is irregular: 来る/来れば/来よう → く/く/こ…, 来ない/来い → こ…, otherwise 来 → き.
  if (headword === "来る" && surface.startsWith("来")) {
    const rest = surface.slice(1);
    if (hasKanji(rest)) return null;
    if (/^(る|れ|よ)/.test(rest)) return `く${rest}`;
    if (/^(な|い|ん)/.test(rest)) return `こ${rest}`;
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

/** First gloss, trimmed for an inline label. */
export const shortGloss = (gloss: string, maxLength = 26): string => {
  const first = (gloss || "").split(/;|,/)[0]?.trim() ?? "";
  if (first.length <= maxLength) return first;
  return `${first.slice(0, maxLength - 1)}…`;
};
