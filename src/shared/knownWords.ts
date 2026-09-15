import type { TWordTranslation } from "@src/models/types";

/** Persisted set of known words and the dim-known-words toggle. */
export const KNOWN_WORDS_SETTING = "knownWords";
export const DIM_KNOWN_SETTING = "dimKnownWords";
export const DEFAULT_DIM_KNOWN = false;

/**
 * Stable key for a dictionary word: its sequence id when known (preferred, survives surface/reading
 * differences), otherwise the headword. Null when the entry is not resolved to a dictionary word.
 */
export const knownKeyOf = (t: TWordTranslation | null | undefined): string | null => {
  if (!t) return null;
  const save = t.himotokiSave;
  if (save && save.seq !== undefined && save.seq !== null) return `seq:${save.source || "jitendex"}:${save.seq}`;
  const hw = t.headword || t.source;
  return hw ? `hw:${hw}` : null;
};
