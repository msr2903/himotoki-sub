/**
 * A Save phrase click that is waiting for the phrase's machine translation. Everything the save
 * sends (destination, deck, tags, card options) is captured at the click in `payload`, so a later
 * selection or setting change can't redirect it.
 */
export type TPendingPhraseSave<T> = { phrase: string; language: string; payload: T };

/**
 * What to do with a pending save now. It runs only with the translation of the phrase (and
 * language) it was clicked for; a changed selection or language, or a failed translation, cancels
 * it, so a different phrase is never saved without another click.
 */
export const pendingPhraseSaveStep = (
  draft: TPendingPhraseSave<unknown> | null,
  current: { phrase: string; language: string; pending: boolean; translation: string | null; error: string | null },
): "idle" | "wait" | "run" | "cancel" => {
  if (!draft) return "idle";
  if (draft.phrase !== current.phrase || draft.language !== current.language) return "cancel";
  if (current.pending) return "wait";
  if (current.translation) return "run";
  return current.error ? "cancel" : "wait";
};
