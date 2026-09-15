import { sample } from "effector";
import { debug } from "patronum";
import { $currentSubs, $subs } from "../subs";
import { $streaming } from "../streamings";
import { cancelVideoClip } from "@src/utils/replayVideoClip";
import {
  $video, $wasPaused, moveKeyPressed, moveFx, moveToTimeRequested, moveToTimeFx,
  replayCueRequested, replayCueFx, loopCleared,
} from ".";

sample({
  clock: moveToTimeRequested,
  source: { video: $video, streaming: $streaming },
  fn: ({ video, streaming }, time) => ({ video, streaming, time }),
  target: moveToTimeFx,
});

sample({
  clock: moveKeyPressed,
  source: { video: $video, subs: $subs, currentSubs: $currentSubs, streaming: $streaming },
  fn: ({ video, subs, currentSubs, streaming }, { direction, force }) => ({
    video,
    subs,
    currentSubs,
    streaming,
    direction,
    force,
  }),
  target: moveFx,
});

debug($video, moveKeyPressed, moveFx, $wasPaused);

sample({
  clock: replayCueRequested,
  source: { video: $video, streaming: $streaming },
  fn: (source, cue) => ({ ...source, ...cue }),
  target: replayCueFx,
});
replayCueRequested.watch(() => loopCleared());
moveKeyPressed.watch(cancelVideoClip);
$video.updates.watch(cancelVideoClip);
