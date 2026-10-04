/**
 * Follows a video through a [start, end) window in media time (ms) and reports how playback left it:
 * "end" when normal playback ran through the end, "left" when the user navigated away (a seek
 * backwards or a jump past the end), the media ended or errored, or the start was never reached.
 * Driven by `timeupdate`, so it holds at any speed and through buffering or pauses.
 */
export type TMediaWindowExit = "end" | "left";

type TMediaLike = Pick<HTMLVideoElement, "currentTime" | "seeking" | "playbackRate" | "addEventListener" | "removeEventListener">;

/** Media time two time updates may be apart and still count as normal playback (scaled by speed). */
export const MEDIA_WINDOW_MAX_STEP_MS = 1500;
/** Playback this far before the start still counts as inside (seek rounding, cue gaps). */
export const MEDIA_WINDOW_LEAD_MS = 500;
/** Updates spent waiting for the initial seek to land before giving up. */
export const MEDIA_WINDOW_ARM_UPDATES = 12;

export const watchMediaWindow = (
  video: TMediaLike,
  start: number,
  end: number,
  onExit: (reason: TMediaWindowExit) => void,
): (() => void) => {
  // Not armed until playback is seen inside the window: the seek to `start` can land a few updates
  // later (Netflix seeks through its own player), and the old position must not count as an exit.
  let last: number | null = null;
  let waited = 0;
  let done = false;

  const stop = () => {
    if (done) return;
    done = true;
    video.removeEventListener("timeupdate", onTime);
    video.removeEventListener("ended", onLeave);
    video.removeEventListener("error", onLeave);
  };
  const exit = (reason: TMediaWindowExit) => {
    if (done) return;
    stop();
    onExit(reason);
  };
  const onLeave = () => exit("left");
  const onTime = () => {
    if (video.seeking) return;
    const time = video.currentTime * 1000;
    const inside = time >= start - MEDIA_WINDOW_LEAD_MS && time < end;
    if (last === null) {
      if (inside) last = time;
      else if (++waited >= MEDIA_WINDOW_ARM_UPDATES) exit("left");
      return;
    }
    const maxStep = MEDIA_WINDOW_MAX_STEP_MS * Math.max(1, video.playbackRate || 1);
    if (time >= end) {
      // Running through the end is a completion; jumping far past it is navigation.
      exit(time >= last && time - last <= maxStep ? "end" : "left");
    } else if (!inside) {
      exit("left");
    } else {
      last = time;
    }
  };

  video.addEventListener("timeupdate", onTime);
  video.addEventListener("ended", onLeave);
  video.addEventListener("error", onLeave);
  return stop;
};
