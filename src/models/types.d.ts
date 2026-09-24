import type { subTitleType } from "subtitle";

export type TMoveDirection = "next" | "prev" | "current";

export type THimotokiSubMeta = {
  seq?: number;
  source?: string;
  reading?: string;
  lemma?: string;
  conjType?: string | null;
  gloss?: string;
  senses?: Array<{ pos?: string[]; glosses?: string[] }>;
  common?: boolean;
};

export type TSubItem = {
  text: string;
  cleanedText: string;
  tag: "span" | "b" | "i" | "u";
  /** "space" and "newline" are layout-only items: never hoverable, never looked up. */
  type: "word" | "punctuation" | "space" | "newline";
  himotoki?: THimotokiSubMeta;
};

export type TSub = {
  id: number;
  start: number;
  end: number;
  text: string;
  cleanedText: string;
  items: TSubItem[];
  analyzed?: boolean;
  /** A kana reading line the channel printed under the kanji line, when detected (see convertRawSubs). */
  readingLine?: string;
};

export type TPartOfSpeach =
  | "noun"
  | "pronoun"
  | "verb"
  | "adjective"
  | "adverb"
  | "preposition"
  | "conjunction"
  | "interjection"
  | "abbreviation"
  | "prefix"
  | "article"
  | "numeral"
  | "auxiliary verb"
  | "particle"
  | "unknown";

export type TWordTranslationItem = {
  word: string;
  partOfSpeech: TPartOfSpeach;
  synonyms: string[];
  popularity: number;
};

export type THimotokiSaveMeta = {
  source: string;
  seq: string | number;
  headword: string;
  reading?: string;
  gloss?: string;
};

export type TWordTranslation = {
  source: string;
  mainTranslation: string;
  targetLanguage: string;
  translations: TWordTranslationItem[];
  transcription: string;
  /** Populated from the offline dictionary lookup, for Convex saved.addFavorite (Save to Himotoki). */
  himotokiSave?: THimotokiSaveMeta;
  /** Set when the dictionary request itself failed (network, server), as opposed to "no entry". */
  error?: string;
  /** Where the answer came from: the offline SQLite dictionary, or "none" when it isn't installed. */
  lookupSource?: "local" | "none";
  /** Dictionary headword (kanji form if any) and its kana reading, for furigana. */
  headword?: string;
  reading?: string;
  common?: boolean;
  pitch?: string;
  jlpt?: string[];
  /** Frequency rank (smaller = more common), from the folded frequency list. */
  frequency?: number;
  /** Other dictionary entries for the same surface (multi-entry switcher). Never nested. */
  alternatives?: TWordTranslation[];
  /** "飲みます → 飲む (Polite)" when the surface was deconjugated. */
  conjugationNote?: string;
  /** Deconjugation chain for the grammar view: dictionary form + the steps applied to it. */
  conjugation?: {
    rootText: string;
    rootReading?: string;
    rootSeq?: number;
    steps: Array<{ label: string; tip?: string }>;
  };
  /** First example sentence of the first sense, when the dictionary has one. */
  example?: { jp: string; en: string; keyword?: string };
};

export type TLearningService = "himotoki" | "anki" | "disabled";

/** What hovering or clicking a subtitle token does. */
export type TTokenAction = "furigana" | "meaning" | "both" | "popup" | "none";

/** What an extra mouse button does over the video (see src/shared/mouseActions.ts). */
export type TMouseAction = "none" | "prev" | "next" | "replay" | "loop" | "slowReplay" | "playPause";
export type TMouseButton = "middle" | "back" | "forward";

/** Inline ruby furigana over kanji tokens. */
export type TFuriganaMode = "always" | "hover" | "never";

/** "Hide furigana for words I already know up to this JLPT level" (off = annotate every word). */
export type TFuriganaLevel = "off" | "n5" | "n4" | "n3" | "n2" | "n1";
/** The kana "reading line" some channels print under the kanji line. */
export type TReadingLineMode = "hide" | "text";

/** Second subtitle line under the Japanese one: none, a subtitle track in the translate-to language, or machine translation. */
export type TSecondarySubs = "off" | "track" | "translate";

export type TTranslationService = "google" | "deepl";

export type Captions = subTitleType[];
