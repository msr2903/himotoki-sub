/**
 * Per-word learning status (Language-Reactor style): New / Learning / Known / Ignored.
 *
 * Statuses are keyed by the same stable key as known words (`knownKeyOf`, see ./knownWords.ts) and
 * stored as a `Record<key, status>` in the persisted `wordStatuses` store. "new" is the implicit
 * default and is never stored (a word with no entry is New). The legacy binary `knownWords` array
 * still exists and is kept in sync with the "known" set for backward compatibility (coverage stats,
 * export); `statusOf` also falls back to it so words marked known before this feature keep showing
 * as Known without a migration step.
 */
export type TWordStatus = "new" | "learning" | "known" | "ignored";

export const WORD_STATUSES_SETTING = "wordStatuses";
export const DEFAULT_WORD_STATUSES: Record<string, TWordStatus> = {};

/** Selectable statuses, in display order. "new" clears any explicit status. */
export const WORD_STATUS_ORDER: TWordStatus[] = ["new", "learning", "known", "ignored"];

export const WORD_STATUS_LABELS: Record<TWordStatus, string> = {
  new: "New",
  learning: "Learning",
  known: "Known",
  ignored: "Ignored",
};

/**
 * Effective status for a word key: an explicit map entry wins, otherwise the legacy known-words
 * array marks it Known, otherwise New. Pure.
 */
export const statusOf = (
  map: Record<string, TWordStatus>,
  key: string | null | undefined,
  legacyKnown?: readonly string[],
): TWordStatus => {
  if (!key) return "new";
  const explicit = map[key];
  if (explicit) return explicit;
  if (legacyKnown && legacyKnown.includes(key)) return "known";
  return "new";
};

/** Set a word's status, removing the entry when set back to "new" (the default). Pure. */
export const setStatus = (
  map: Record<string, TWordStatus>,
  key: string,
  status: TWordStatus,
): Record<string, TWordStatus> => {
  const next = { ...map };
  if (status === "new") delete next[key];
  else next[key] = status;
  return next;
};

/**
 * Merge a legacy known-words array into a status map: any key without an explicit status becomes
 * "known". Returns the original reference when nothing changes. Pure.
 */
export const mergeLegacyKnown = (
  map: Record<string, TWordStatus>,
  legacyKnown: readonly string[],
): Record<string, TWordStatus> => {
  let changed = false;
  const next: Record<string, TWordStatus> = { ...map };
  for (const key of legacyKnown) {
    if (!next[key]) {
      next[key] = "known";
      changed = true;
    }
  }
  return changed ? next : map;
};

/** CSS class for a word's status on the subtitle token, or "" for New. */
export const statusClass = (status: TWordStatus): string => {
  switch (status) {
    case "known":
      return "es-sub-item--known";
    case "learning":
      return "es-sub-item--learning";
    case "ignored":
      return "es-sub-item--ignored";
    default:
      return "";
  }
};
