import { createStore, createEffect, createEvent, StoreValue } from "effector";
import { $currentSubs, $subs } from "../subs";
import { TMoveDirection } from "../types";
import { replayVideoClip } from "@src/utils/replayVideoClip";
import { moveVideoToTime } from "@src/utils/moveVideoToTime";
import { $streaming } from "../streamings";
import { SLOW_REPLAY_RATE } from "@src/shared/playbackRate";

const TIME_SEEK_TIME = 5000;

export const $video = createStore<HTMLVideoElement | null>(null);
export const getCurrentVideoFx = createEffect<void, HTMLVideoElement>(() => document.querySelector("video"));
export const videoTimeUpdate = createEvent<void>();

export const $wasPaused = createStore<boolean>(false);
export const wasPausedChanged = createEvent<boolean>();
$wasPaused.on(wasPausedChanged, (_, wasPaused) => wasPaused);

$video.on(getCurrentVideoFx.doneData, (_, video) => video);
getCurrentVideoFx.use(async () => document.querySelector("video")!);

type TMoveFX = {
  video: StoreValue<typeof $video>;
  subs: StoreValue<typeof $subs>;
  currentSubs: StoreValue<typeof $currentSubs>;
  streaming: StoreValue<typeof $streaming>;
  direction: TMoveDirection;
  force: boolean;
};
export const moveKeyPressed = createEvent<{ direction: TMoveDirection; force: boolean }>();
export const moveFx = createEffect<TMoveFX, void>(({ video, subs, streaming, direction, currentSubs, force }) => {
  if (video === null) {
    return;
  }

  if (direction === "next") {
    const currentTime = video.currentTime * 1000;
    if (currentSubs.length < 2) {
      // use regular move if we don't have subs
      moveVideoToTime(video, streaming, currentTime + TIME_SEEK_TIME);
      return;
    }

    const nextSub = subs.find((sub) => sub.start > currentTime);
    const isNextSubClose = nextSub && nextSub.start - currentTime <= TIME_SEEK_TIME;

    if (nextSub && (force || isNextSubClose)) {
      moveVideoToTime(video, streaming, nextSub.start);
    } else {
      moveVideoToTime(video, streaming, currentTime + TIME_SEEK_TIME);
    }
  }

  if (direction === "prev") {
    const currentTime = video.currentTime * 1000;
    if (currentSubs.length < 2) {
      // use regular move if we don't have subs
      moveVideoToTime(video, streaming, currentTime - TIME_SEEK_TIME);
      return;
    }

    let prevSub = subs[currentSubs[0].id - 1];

    if (prevSub && prevSub.end - prevSub.start < 20) {
      // if the previous subtitle is too short, we need move to the previous one
      // to avoid the situation when the previous subtitle is the same as the current one.
      // It's happening with youtube auto-generated subtitles
      prevSub = subs[currentSubs[0].id - 2];
    }

    const isPrevSubClose = prevSub && currentTime - prevSub.end <= TIME_SEEK_TIME;

    if (prevSub && (force || isPrevSubClose)) {
      moveVideoToTime(video, streaming, prevSub.start);
    } else {
      moveVideoToTime(video, streaming, currentTime - TIME_SEEK_TIME);
    }
  }

  if (direction === "current") {
    if (currentSubs.length > 0) {
      moveVideoToTime(video, streaming, currentSubs[0].start);
      video.play();
    }
  }
});

export const moveToTimeRequested = createEvent<number>();

/** Replay the current subtitle line from its start; loop it for shadowing (toggle). */
export const replayLinePressed = createEvent<void>();
export const loopLineToggled = createEvent<void>();
export const loopCleared = createEvent<void>();
export const moveToTimeFx = createEffect<
  { video: StoreValue<typeof $video>; streaming: StoreValue<typeof $streaming>; time: number },
  void
>(({ video, streaming, time }) => {
  if (!video) return;
  moveVideoToTime(video, streaming, time);
});

/** Replay the current line slowed to SLOW_REPLAY_RATE (shadowing), then restore the user's rate. */
export const slowReplayRequested = createEvent<void>();
export const slowReplayFx = createEffect<
  {
    video: StoreValue<typeof $video>;
    currentSubs: StoreValue<typeof $currentSubs>;
    streaming: StoreValue<typeof $streaming>;
    userRate: number;
  },
  void
>(({ video, currentSubs, streaming, userRate }) => {
  if (!video || currentSubs.length === 0) return;
  const cue = currentSubs[0];
  video.playbackRate = SLOW_REPLAY_RATE;
  moveVideoToTime(video, streaming, cue.start);
  void video.play();
  const durationMs = Math.max(300, (cue.end - cue.start) / SLOW_REPLAY_RATE);
  window.setTimeout(() => {
    try {
      video.playbackRate = userRate;
    } catch {
      // ignore
    }
  }, durationMs + 80);
});

export const replayCueRequested = createEvent<{ start: number; end: number }>();
export const replayCueFx = createEffect(({ video, streaming, start, end }: {
  video: HTMLVideoElement | null;
  streaming: StoreValue<typeof $streaming>;
  start: number;
  end: number;
}) => {
  if (video) replayVideoClip(video, start, end, (time) => moveVideoToTime(video, streaming, time));
});
