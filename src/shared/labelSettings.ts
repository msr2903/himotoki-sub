/** Size of the meaning text in the hover label above a word, in percent (100 = default). */
export const MEANING_SIZE_SETTING = "meaningSize";
export const MEANING_SIZE_DEFAULT = 100;
export const MEANING_SIZE_MIN = 80;
export const MEANING_SIZE_MAX = 200;
export const MEANING_SIZE_STEP = 10;

export const clampMeaningSize = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return MEANING_SIZE_DEFAULT;
  return Math.min(MEANING_SIZE_MAX, Math.max(MEANING_SIZE_MIN, Math.round(n)));
};
