import type { TWordTranslation } from "@src/models/types";
import { knownKeyOf } from "@src/shared/knownWords";

/**
 * Pure types and helpers for the local lookup history. Kept free of Effector/chrome so it can be unit
 * tested; the persisted store lives in src/models/history.
 */
export type TLookupHistoryItem = {
  key: string;
  headword: string;
  reading?: string;
  gloss?: string;
  source: string;
  /** Video position (ms) when the word was looked up, for jump-to-cue. */
  videoTimeMs?: number;
  videoTitle?: string;
  ts: number;
};

export const LOOKUP_HISTORY_SETTING = "lookupHistory";
export const HISTORY_CAP = 200;

/** Prepend an item, de-duplicating by key (move-to-front) and capping length. Pure. */
export const addToHistory = (
  list: TLookupHistoryItem[],
  item: TLookupHistoryItem,
  cap = HISTORY_CAP,
): TLookupHistoryItem[] => {
  const rest = list.filter((h) => h.key !== item.key);
  return [item, ...rest].slice(0, cap);
};

/** Build a history item from a resolved translation, or null when it should not be recorded. Pure. */
export const historyItemFromTranslation = (
  tx: TWordTranslation | null | undefined,
  videoTimeMs?: number,
  videoTitle?: string,
): TLookupHistoryItem | null => {
  if (!tx || tx.error) return null;
  const headword = tx.headword || tx.source;
  if (!headword) return null;
  const gloss = tx.mainTranslation || tx.translations?.[0]?.word;
  return {
    key: knownKeyOf(tx) || `hw:${headword}`,
    headword,
    reading: tx.reading && tx.reading !== headword ? tx.reading : undefined,
    gloss,
    source: tx.source,
    videoTimeMs,
    videoTitle,
    ts: Date.now(),
  };
};
