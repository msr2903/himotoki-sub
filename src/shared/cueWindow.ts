/**
 * Fast "which cues are near this time" lookups for the subtitle timeline (ProgressBar), which asks
 * every animation frame: index once per track, then each query is a binary search plus the cues it
 * returns instead of a scan of the whole track. Pure.
 */
export type TTimedCue = { start: number; end: number };

export type TCueIndex<T extends TTimedCue> = {
  /** Cues ordered by start. */
  sorted: T[];
  /** Longest cue duration, bounding how far before a window a cue reaching into it can start. */
  maxDuration: number;
};

export const indexCues = <T extends TTimedCue>(cues: T[]): TCueIndex<T> => {
  const ordered = cues.every((cue, i) => i === 0 || cues[i - 1]!.start <= cue.start);
  const sorted = ordered ? cues : [...cues].sort((a, b) => a.start - b.start);
  let maxDuration = 0;
  for (const cue of sorted) maxDuration = Math.max(maxDuration, cue.end - cue.start);
  return { sorted, maxDuration };
};

/**
 * Cues that overlap the open window (from, to), in start order: `end > from && start < to`. That
 * includes a cue spanning the whole window (#152); a cue that only touches a border does not count.
 */
export const cuesInWindow = <T extends TTimedCue>({ sorted, maxDuration }: TCueIndex<T>, from: number, to: number): T[] => {
  // A cue reaching into the window started after `from - maxDuration`; skip everything before that.
  const earliest = from - maxDuration;
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]!.start <= earliest) lo = mid + 1;
    else hi = mid;
  }
  const result: T[] = [];
  for (let i = lo; i < sorted.length && sorted[i]!.start < to; i++) {
    const cue = sorted[i]!;
    if (cue.end > from) result.push(cue);
  }
  return result;
};

/**
 * Timeline position for a click: the media time under the pointer, from its x relative to the
 * timeline's own rectangle (never a child marker's offset, #150). Clamped to the visible window. Pure.
 */
export const timeAtPointer = (
  clientX: number,
  rect: { left: number; width: number },
  windowStart: number,
  windowMs: number,
): number | null => {
  if (!(rect.width > 0)) return null;
  const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  return windowStart + fraction * windowMs;
};

/** The part of a cue inside the window, in px from the window's left edge. Pure. */
export const markerGeometry = (
  cue: TTimedCue,
  windowStart: number,
  windowMs: number,
  width: number,
): { x: number; width: number } => {
  const msInPx = width / windowMs;
  const start = Math.max(cue.start, windowStart);
  const end = Math.min(cue.end, windowStart + windowMs);
  return { x: msInPx * (start - windowStart), width: Math.max(0, msInPx * (end - start)) };
};
