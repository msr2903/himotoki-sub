/**
 * Playback speed for the video, adjustable from the panel and with the , / . hotkeys. Slow-replay (\)
 * replays the current line at SLOW_REPLAY_RATE for shadowing, then restores the chosen rate.
 */
export const PLAYBACK_RATE_SETTING = "playbackRate";
export const PLAYBACK_RATE_DEFAULT = 1;
export const PLAYBACK_RATE_MIN = 0.5;
export const PLAYBACK_RATE_MAX = 2;
export const PLAYBACK_RATE_STEP = 0.25;
export const SLOW_REPLAY_RATE = 0.75;

/** Round to the nearest step and clamp into [MIN, MAX]. Guards NaN → default. Pure. */
export const clampRate = (value: number): number => {
  if (!Number.isFinite(value)) return PLAYBACK_RATE_DEFAULT;
  const stepped = Math.round(value / PLAYBACK_RATE_STEP) * PLAYBACK_RATE_STEP;
  const clamped = Math.min(PLAYBACK_RATE_MAX, Math.max(PLAYBACK_RATE_MIN, stepped));
  // Avoid floating-point drift like 1.7500000000000002.
  return Math.round(clamped * 100) / 100;
};

/** Nudge the current rate by delta (usually ±STEP), clamped. Pure. */
export const stepRate = (current: number, delta: number): number => clampRate(current + delta);
