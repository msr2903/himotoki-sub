import type { TSubItem } from "@src/models/types";

/**
 * Pure helpers for selecting a run of tokens within a single cue (shift-click a start then an end).
 * The selection is an inclusive index range into `sub.items`; Subs.tsx renders the highlight and an
 * action bar (translate / save the phrase).
 */
export type PhraseRange = { start: number; end: number };

/** Inclusive range between an anchor and an extent index, clamped to the item list. Pure. */
export const clampRange = (anchor: number, extent: number, length: number): PhraseRange => {
  const lo = Math.max(0, Math.min(anchor, extent));
  const hi = Math.min(length - 1, Math.max(anchor, extent));
  return { start: lo, end: hi };
};

export const isIndexSelected = (range: PhraseRange | null, index: number): boolean =>
  range !== null && index >= range.start && index <= range.end;

export const rangeLength = (range: PhraseRange): number => range.end - range.start + 1;

/** Join the surfaces of the items in the range into phrase text (spaces/newlines collapse). Pure. */
export const joinItems = (
  items: Pick<TSubItem, "type" | "text" | "cleanedText">[],
  range: PhraseRange,
): string =>
  items
    .slice(range.start, range.end + 1)
    .map((it) => (it.type === "newline" || it.type === "space" ? " " : it.cleanedText || it.text))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
