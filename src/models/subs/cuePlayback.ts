import type { TSub } from "../types";

/**
 * The looped cue after the subtitles changed. The re-split pass, appended cues and a delay resync
 * keep the same line (same id and text), so the loop follows it to its new timing; a different track
 * or custom import no longer has that line, so the loop ends instead of seeking to a dead window.
 * Returns the same reference when nothing changed. Pure.
 */
export const rebindLoopedCue = (looped: TSub | null, subs: TSub[]): TSub | null => {
  if (!looped) return null;
  const match = subs.find((sub) => sub.id === looped.id && sub.text === looped.text);
  if (!match) return null;
  return match.start === looped.start && match.end === looped.end ? looped : match;
};

/** Auto-pause pauses this long before the current cue ends, when a time update lands there. */
export const AUTO_PAUSE_LEAD_MS = 250;
/** Media time two updates may be apart and still be normal playback rather than a seek (× speed). */
export const AUTO_PAUSE_MAX_STEP_MS = 1500;

export type TAutoPauseTrack = {
  /** Video time (ms) at the previous update. */
  time: number;
  /** End of the current cue at the previous update. */
  end: number | null;
  /** The cue end already paused at, so resuming does not pause there again. */
  pausedEnd: number | null;
};

/**
 * One auto-pause decision per video time update. Pauses inside the lead window before the cue end,
 * or — when updates are sparse and skip that window — as soon as normal playback crosses the end of
 * the cue that was showing. Seeks (large or backward jumps) never pause and forget the last pause,
 * so replaying a line pauses at its end again. Pure.
 */
export const autoPauseStep = (
  prev: TAutoPauseTrack | null,
  now: { time: number; end: number | null; rate: number; seeking: boolean; active: boolean },
): { pause: boolean; track: TAutoPauseTrack } => {
  const maxStep = AUTO_PAUSE_MAX_STEP_MS * Math.max(1, now.rate || 1);
  const natural = prev !== null && !now.seeking && now.time >= prev.time && now.time - prev.time <= maxStep;
  let pausedEnd = natural ? prev.pausedEnd : null;
  let target: number | null = null;
  if (now.end !== null && now.end - now.time > 0 && now.end - now.time < AUTO_PAUSE_LEAD_MS) {
    target = now.end;
  } else if (natural) {
    // Either reading may be the cue just crossed: $currentSubs can lag one update behind the clock.
    const from = prev.time;
    const crossed = (end: number | null) => end !== null && from < end && now.time >= end;
    if (crossed(prev.end)) target = prev.end;
    else if (crossed(now.end)) target = now.end;
  }
  const pause = now.active && !now.seeking && target !== null && target !== pausedEnd;
  if (pause) pausedEnd = target;
  return { pause, track: { time: now.time, end: now.end, pausedEnd } };
};
