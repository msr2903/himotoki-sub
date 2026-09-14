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
  /** Stashed from GET /api/search for Convex saved.addFavorite. */
  himotokiSave?: THimotokiSaveMeta;
  /** Set when the dictionary request itself failed (network, server), as opposed to "no entry". */
  error?: string;
  /** Where the answer came from: the offline SQLite dictionary or the Himotoki HTTP API. */
  lookupSource?: "local" | "api";
  /** Dictionary headword (kanji form if any) and its kana reading, for furigana. */
  headword?: string;
  reading?: string;
  common?: boolean;
  pitch?: string;
  jlpt?: string[];
  /** "飲みます → 飲む (Polite)" when the surface was deconjugated. */
  conjugationNote?: string;
  /** First example sentence of the first sense, when the dictionary has one. */
  example?: { jp: string; en: string; keyword?: string };
};

export type TLearningService = "himotoki" | "anki" | "disabled";

/** What hovering or clicking a subtitle token does. */
export type TTokenAction = "furigana" | "meaning" | "both" | "popup" | "none";

export type TTranslationService = "google" | "deepl";

export type Captions = subTitleType[];
