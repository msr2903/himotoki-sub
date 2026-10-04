import { SLOW_REPLAY_RATE } from "@src/shared/playbackRate";
import { watchMediaWindow } from "./mediaWindow";

/**
 * Slow replay (\): play [start, end) at SLOW_REPLAY_RATE, then go back to the user's speed. One owner
 * at a time; it ends in media time when playback leaves the line, and is cancelled by a newer slow
 * replay, a speed change, a video replacement or disabling the extension — so a stale replay never
 * overrides a newer speed choice or cuts the next replay short.
 */
let active: { video: HTMLVideoElement; stop: () => void } | null = null;

/** End the current slow replay; with `restoreRate`, put that speed back on its video. */
export const cancelSlowReplay = (restoreRate?: number) => {
  const owner = active;
  if (!owner) return;
  active = null;
  owner.stop();
  if (restoreRate !== undefined) owner.video.playbackRate = restoreRate;
};

export const startSlowReplay = (
  video: HTMLVideoElement,
  start: number,
  end: number,
  seek: (time: number) => void,
  userRate: () => number,
) => {
  // The newer replay sets the slow rate itself; restoring in between would only flicker.
  cancelSlowReplay();
  if (end <= start) return;
  const owner = {
    video,
    stop: () => {},
  };
  owner.stop = watchMediaWindow(video, start, end, () => {
    if (active !== owner) return;
    active = null;
    // The latest setting, not the one captured when the replay started.
    video.playbackRate = userRate();
  });
  active = owner;
  video.playbackRate = SLOW_REPLAY_RATE;
  seek(start);
  void video.play().catch(() => {
    if (active === owner) cancelSlowReplay(userRate());
  });
};
