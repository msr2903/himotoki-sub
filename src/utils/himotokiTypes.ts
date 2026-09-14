import type { TPartOfSpeach, TWordTranslation, TWordTranslationItem } from "@src/models/types";

export type HimotokiSense = {
  pos?: string[];
  glosses?: string[];
  lang?: string;
};

export type HimotokiEntry = {
  seq?: number;
  source?: string;
  kanji?: string[];
  readings?: string[];
  senses?: HimotokiSense[];
  common?: boolean;
  jlpt?: string | null;
};

export type HimotokiConjugation = {
  root_text?: string;
  root_reading?: string;
  root_seq?: number;
};

export type HimotokiToken = {
  surface: string;
  start?: number;
  end?: number;
  best?: HimotokiEntry | null;
  source_text?: string | null;
  conj_type?: string | null;
  conjugation?: HimotokiConjugation | null;
  entries?: HimotokiEntry[];
};

export type HimotokiAnalyzeResponse = {
  text: string;
  tokens: HimotokiToken[];
  split_available?: boolean;
};

export type HimotokiSearchResponse = {
  words?: {
    results?: HimotokiEntry[];
    total?: number;
  };
  results?: HimotokiEntry[];
};

const mapPos = (pos?: string[]): TPartOfSpeach => {
  if (!pos?.length) return "unknown";
  const joined = pos.join(" ").toLowerCase();
  if (joined.includes("v") || joined.includes("verb")) return "verb";
  if (joined.includes("adj")) return "adjective";
  if (joined.includes("adv")) return "adverb";
  if (joined.includes("n") || joined.includes("noun")) return "noun";
  if (joined.includes("prt") || joined.includes("particle")) return "particle";
  if (joined.includes("conj")) return "conjunction";
  if (joined.includes("int")) return "interjection";
  return "unknown";
};

export const firstGloss = (entry?: HimotokiEntry | null): string => {
  const sense = entry?.senses?.find((s) => s.glosses?.length);
  return sense?.glosses?.[0] ?? "";
};

export const entryReading = (entry?: HimotokiEntry | null): string => {
  return entry?.readings?.[0] ?? "";
};

export const entryLemma = (token: HimotokiToken): string => {
  return (
    token.conjugation?.root_text ||
    token.source_text ||
    token.best?.kanji?.[0] ||
    token.best?.readings?.[0] ||
    token.surface
  );
};

export const isPunctuationSurface = (surface: string): boolean => {
  return /^[\s\u3000\u3001\u3002！？!?,.。、「」『』（）()\[\]{}…・ー\-]+$/.test(surface);
};

export const himotokiEntryToWordTranslation = (
  entry: HimotokiEntry,
  source: string,
  targetLanguage = "en",
  conjNote?: string | null,
): TWordTranslation => {
  const senses = entry.senses ?? [];
  const translations: TWordTranslationItem[] = senses.slice(0, 8).map((sense) => ({
    word: (sense.glosses ?? []).join("; "),
    partOfSpeech: mapPos(sense.pos),
    synonyms: [],
    popularity: entry.common ? 1 : 0,
  }));

  const main = firstGloss(entry) || translations[0]?.word || "";
  let transcription = entryReading(entry);
  if (conjNote) {
    transcription = transcription ? `${transcription} · ${conjNote}` : conjNote;
  }

  const headword =
    entry.kanji?.[0] || entry.readings?.[0] || source;
  const reading = entryReading(entry);
  const himotokiSave =
    entry.seq !== undefined && entry.seq !== null
      ? {
          source: entry.source || "jitendex",
          seq: entry.seq,
          headword,
          reading: reading || undefined,
          gloss: main || undefined,
        }
      : undefined;

  return {
    source,
    mainTranslation: main,
    targetLanguage,
    translations,
    transcription,
    himotokiSave,
    headword,
    reading: reading || undefined,
  };
};

export const himotokiTokenToWordTranslation = (
  token: HimotokiToken,
  targetLanguage = "en",
): TWordTranslation | null => {
  if (!token.best) return null;
  const source = entryLemma(token);
  const conjNote = token.conj_type
    ? `${token.surface} → ${entryLemma(token)} (${token.conj_type})`
    : null;
  return himotokiEntryToWordTranslation(token.best, source, targetLanguage, conjNote);
};
