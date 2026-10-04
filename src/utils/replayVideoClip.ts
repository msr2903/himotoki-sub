import { watchMediaWindow } from "./mediaWindow";

/**
 * Replay [start, end) and pause once at its end, in media time, so replay works at any speed and
 * through buffering or popup dismissal. Seeking away (backwards, or forward past the end) hands the
 * video back to the user without pausing the newly chosen scene.
 */
let cancelClip: (() => void) | null = null;

export const cancelVideoClip = () => {
  cancelClip?.();
  cancelClip = null;
};

export const replayVideoClip = (
  video: HTMLVideoElement,
  start: number,
  end: number,
  seek: (time: number) => void,
) => {
  cancelVideoClip();
  if (end <= start) return;
  const stop = watchMediaWindow(video, start, end, (reason) => {
    if (cancelClip === cleanup) cancelClip = null;
    if (reason === "end") video.pause();
  });
  const cleanup = () => {
    stop();
    if (cancelClip === cleanup) cancelClip = null;
  };
  cancelClip = cleanup;
  seek(start);
  void video.play().catch(cleanup);
};
