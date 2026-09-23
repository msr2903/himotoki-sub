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
  /** Page URL at lookup time — used to open the original video for entries from other videos. */
  videoUrl?: string;
  /** Stable video identity derived from the URL, for "is this the same video" checks. */
  videoKey?: string;
  ts: number;
};

/**
 * Video identity for jump-to-cue: YouTube's video id (watch?v=, /shorts/, /live/, /embed/, /v/),
 * otherwise origin + pathname (covers Netflix /watch/<id> and similar per-video routes).
 */
export const videoKeyFromUrl = (rawUrl: string | undefined): string | undefined => {
  if (!rawUrl) return undefined;
  try {
    const url = new URL(rawUrl);
    const v = url.searchParams.get("v");
    if (v) return `yt:${v}`;
    const m = url.pathname.match(/^\/(shorts|live|embed|v)\/([^\/?#]+)/);
    if (m) return `yt:${m[2]}`;
    return `${url.origin}${url.pathname}`;
  } catch {
    return rawUrl;
  }
};

/** Original video URL with a timestamp hint for players that understand `t` (YouTube). */
export const urlWithTimestamp = (rawUrl: string, ms: number): string => {
  try {
    const url = new URL(rawUrl);
    if (url.hostname.includes("youtube.com") || url.hostname === "youtu.be") {
      url.searchParams.set("t", `${Math.floor(ms / 1000)}s`);
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
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
  videoUrl?: string,
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
    videoUrl,
    videoKey: videoKeyFromUrl(videoUrl),
    ts: Date.now(),
  };
};
