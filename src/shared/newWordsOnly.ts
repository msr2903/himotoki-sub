import { wordEase } from "./furiganaDifficulty";

/**
 * "New words only" (beta): the learner picks their JLPT level and the subtitle line is replaced by a
 * short glossary of the words above it (or rare words with no JLPT listing); H peeks the full line.
 * N5 and N4 are not offered: at those levels nearly every word would still be listed.
 */
export type TNewWordsLevel = "off" | "n3" | "n2" | "n1";

export const NEW_WORDS_LEVEL_SETTING = "newWordsLevel";
export const DEFAULT_NEW_WORDS_LEVEL: TNewWordsLevel = "off";

export const NEW_WORDS_LEVEL_OPTIONS: ReadonlyArray<{ value: TNewWordsLevel; label: string; description: string }> = [
  { value: "off", label: "Off", description: "Show every word in the subtitles." },
  { value: "n3", label: "N3", description: "List N2 and N1 words, and rare ones, with their meanings." },
  { value: "n2", label: "N2", description: "List N1 words and rare ones with their meanings." },
  { value: "n1", label: "N1", description: "List only rare words outside the JLPT lists, with their meanings." },
];

export const isNewWordsLevel = (value: unknown): value is TNewWordsLevel =>
  NEW_WORDS_LEVEL_OPTIONS.some((o) => o.value === value);

/**
 * Frequency rank past which a word with no JLPT listing counts as rare for a learner at this level.
 * Roughly the vocabulary size behind each level, so common unlisted words stay hidden.
 */
export const RARE_RANK: Record<Exclude<TNewWordsLevel, "off">, number> = { n3: 6000, n2: 10000, n1: 18000 };

const JAPANESE = /[\u3040-\u30ff\u3400-\u9fff]/;

/** Tokens with no kana or kanji (English asides, numbers, punctuation) are never "new Japanese words". */
export const isJapaneseToken = (text: string): boolean => JAPANESE.test(text);

/**
 * Is this word likely new to a learner at `level`? JLPT-listed words are new when harder than the
 * level; unlisted words when rarer than RARE_RANK. Words with no JLPT or frequency data count as new,
 * so the filter errs on showing too much rather than hiding something the learner needed.
 */
export const isNewWord = (word: { jlpt?: string[]; frequency?: number }, level: TNewWordsLevel): boolean => {
  if (level === "off") return true;
  const ease = wordEase(word.jlpt); // 5 = N5 … 1 = N1; 0 = unlisted
  if (ease > 0) return ease < Number(level.slice(1));
  if (typeof word.frequency !== "number") return true;
  return word.frequency > RARE_RANK[level];
};

/** At most this many glossary rows per line; the rest are counted as "+N". */
export const GLOSSARY_MAX = 3;
/** The glossary's Show line chip fades out after the pointer has been still over the video this long. */
export const SHOW_LINE_IDLE_MS = 2000;
/** Keep a glossary on screen at least this long, so a word from a quick line can still be read. */
export const GLOSSARY_HOLD_MS = 3000;

/**
 * Keep the `max` hardest words, in their original order, and count the rest. Hardest first: unlisted
 * (rare) words, then N1 → N3; ties go to the rarer word.
 */
export function pickGlossary<T extends { jlpt?: string[]; frequency?: number }>(
  words: T[],
  max = GLOSSARY_MAX,
): { shown: T[]; more: number } {
  if (words.length <= max) return { shown: words, more: 0 };
  const keep = words
    .map((word, index) => ({ index, ease: wordEase(word.jlpt), rank: word.frequency ?? Infinity }))
    .sort((a, b) => a.ease - b.ease || b.rank - a.rank)
    .slice(0, max)
    .map((w) => w.index)
    .sort((a, b) => a - b);
  return { shown: keep.map((i) => words[i]!), more: words.length - max };
}

/** The first meanings of a gloss that fit in `maxLength` characters ("after all; as expected"). */
export const glossaryGloss = (gloss: string, maxLength = 40): string => {
  const parts = (gloss || "").split(";").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return "";
  let out = parts[0]!;
  for (const part of parts.slice(1)) {
    if (out.length + 2 + part.length > maxLength) break;
    out += `; ${part}`;
  }
  return out.length <= maxLength ? out : `${out.slice(0, maxLength - 1)}…`;
};
