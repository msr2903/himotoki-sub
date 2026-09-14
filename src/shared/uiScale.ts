/** Size of the extension's own UI inside the player (word pop-up, hover labels, settings panel), in percent. */
export const UI_SCALE_SETTING = "uiScale";
export const UI_SCALE_DEFAULT = 100;
export const UI_SCALE_MIN = 50;
export const UI_SCALE_MAX = 150;
export const UI_SCALE_STEP = 10;

export const clampUiScale = (value: unknown): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return UI_SCALE_DEFAULT;
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, Math.round(n)));
};
