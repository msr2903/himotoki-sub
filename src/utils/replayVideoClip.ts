/** Stop at media time, so replay works at any speed and through buffering or popup dismissal. */
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
  const cleanup = () => {
    video.removeEventListener("timeupdate", onTime);
    video.removeEventListener("ended", cleanup);
    video.removeEventListener("error", cleanup);
    if (cancelClip === cleanup) cancelClip = null;
  };
  const onTime = () => {
    if (video.seeking) return;
    if (video.currentTime * 1000 >= end) {
      video.pause();
      cleanup();
    } else if (video.currentTime * 1000 < start - 500) {
      cleanup();
    }
  };
  cancelClip = cleanup;
  video.addEventListener("timeupdate", onTime);
  video.addEventListener("ended", cleanup);
  video.addEventListener("error", cleanup);
  seek(start);
  void video.play().catch(cleanup);
};
