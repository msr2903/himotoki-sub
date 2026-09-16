import { createEvent, createStore } from "effector";

import { withPersist } from "@src/utils/withPersist";
import {
  LOOKUP_HISTORY_SETTING,
  TLookupHistoryItem,
  addToHistory,
} from "@src/shared/lookupHistory";

export { historyItemFromTranslation } from "@src/shared/lookupHistory";
export type { TLookupHistoryItem } from "@src/shared/lookupHistory";

/**
 * Local, persisted history of the words the user has looked up (hovered or clicked). Fully offline —
 * no backend. Deduped by the word's stable key (move-to-front) and capped; each item remembers the
 * video position at lookup time so the panel can jump back to that cue. Pure helpers: src/shared/lookupHistory.ts.
 */
export const $lookupHistory = withPersist(
  createStore<TLookupHistoryItem[]>([], { name: LOOKUP_HISTORY_SETTING }),
);
export const lookupRecorded = createEvent<TLookupHistoryItem>();
export const historyItemRemoved = createEvent<string>();
export const historyCleared = createEvent();

$lookupHistory
  .on(lookupRecorded, (list, item) => addToHistory(list, item))
  .on(historyItemRemoved, (list, key) => list.filter((h) => h.key !== key))
  .on(historyCleared, () => []);
