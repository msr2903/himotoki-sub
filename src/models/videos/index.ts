import { createStore, createEffect, createEvent, StoreValue } from "effector";
import { $currentSubs, $subs } from "../subs";
import { TMoveDirection } from "../types";
import { replayVideoClip } from "@src/utils/replayVideoClip";
import { moveVideoToTime } from "@src/utils/moveVideoToTime";
import { $streaming } from "../streamings";
import { startSlowReplay } from "@src/utils/slowReplay";

const TIME_SEEK_TIME = 5000;

export const $video = createStore<HTMLVideoElement | null>(null);
export const getCurrentVideoFx = createEffect<void, HTMLVideoElement>(() => document.querySelector("video"));
export const videoTimeUpdate = createEvent<void>();

export const $wasPaused = createStore<boolean>(false);
export const wasPausedChanged = createEvent<boolean>();
$wasPaused.on(wasPausedChanged, (_, wasPaused) => wasPaused);

$video.on(getCurrentVideoFx.doneData, (_, video) => video);
// A hover pause belongs to the video it paused; a replacement video must not be resumed for it.
$wasPaused.reset($video.updates);
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
    // Seek to the next cue's start whenever one exists — the single-current-cue case is the normal
    // one, and in gaps between cues subs.find still locates the upcoming line.
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
    // Anchor on the cue before the current position: the cue before the one on screen, or — in a
    // gap between cues — the last cue that already started.
    const anchorIndex =
      currentSubs.length > 0 ? currentSubs[0].id - 1 : subs.findLastIndex((sub) => sub.start < currentTime);

    let prevSub = anchorIndex >= 0 ? subs[anchorIndex] : undefined;

    if (prevSub && prevSub.end - prevSub.start < 20) {
      // if the previous subtitle is too short, we need move to the previous one
      // to avoid the situation when the previous subtitle is the same as the current one.
      // It's happening with youtube auto-generated subtitles
      prevSub = subs[anchorIndex - 1];
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
    /** Read when the replay ends, so a speed chosen meanwhile is the one restored. */
    userRate: () => number;
  },
  void
>(({ video, currentSubs, streaming, userRate }) => {
  if (!video || currentSubs.length === 0) return;
  const cue = currentSubs[0];
  startSlowReplay(video, cue.start, cue.end, (time) => moveVideoToTime(video, streaming, time), userRate);
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
