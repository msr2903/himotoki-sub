/**
 * Whether a cue is showing at `time` (ms). Cues are half-open intervals [start, end): at a shared
 * boundary only the next cue is active, so replay/loop/previous never pick the line that just ended.
 * Genuinely overlapping cues are all active; zero-length cues never are.
 */
export const isCueActive = (cue: { start: number | string; end: number | string }, time: number): boolean => {
  const start = Number(cue.start);
  const end = Number(cue.end);
  return end > start && start <= time && time < end;
};

export const getCurrentSubs = <T extends { start: number | string; end: number | string }>(subs: T[], time: number): T[] =>
  subs.filter((sub) => isCueActive(sub, time));
