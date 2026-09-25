import { wordEase } from "./furiganaDifficulty";

/**
 * "New words only" (beta): the learner picks their JLPT level and the subtitles keep only the words
 * above it (or rare words with no JLPT listing); everything else is blurred until peeked. N5 and N4
 * are not offered: at those levels nearly every word would still show.
 */
export type TNewWordsLevel = "off" | "n3" | "n2" | "n1";

export const NEW_WORDS_LEVEL_SETTING = "newWordsLevel";
export const DEFAULT_NEW_WORDS_LEVEL: TNewWordsLevel = "off";

export const NEW_WORDS_LEVEL_OPTIONS: ReadonlyArray<{ value: TNewWordsLevel; label: string; description: string }> = [
  { value: "off", label: "Off", description: "Show every word in the subtitles." },
  { value: "n3", label: "N3", description: "Show only N2 and N1 words, and rare ones. Press H to see the whole line." },
  { value: "n2", label: "N2", description: "Show only N1 words and rare ones. Press H to see the whole line." },
  { value: "n1", label: "N1", description: "Show only rare words outside the JLPT lists. Press H to see the whole line." },
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
