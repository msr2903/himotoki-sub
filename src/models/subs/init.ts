import { sample, split } from "effector";
import {
  $currentSubs,
  $rawSubs,
  $subs,
  $subsDelay,
  esSubsChanged,
  fetchSubsFx,
  resetSubs,
  subsDelayButtonPressed,
  subsDelayChangeFx,
  subsRequested,
  subsResyncFx,
  updateCurrentSubsFx,
  updateCustomSubsFx,
  autoPauseFx,
  $subsTitle,
  subsReloadRequested,
  ES_CUSTOM_SUB_LABEL,
  rawSubsAdded,
  processRawSubsFx,
  processJapaneseSubsFx,
} from ".";
import { $streaming } from "../streamings";
import { $video, videoTimeUpdate } from "../videos";
import { $autoPause } from "../settings";
import type { Captions } from "../types";
import { debug } from "patronum";

split({
  source: esSubsChanged,
  match: {
    hasLanguage: (language) => !!language,
    noLanguage: (language) => !language,
  },
  cases: {
    hasLanguage: subsRequested,
    noLanguage: resetSubs,
  },
});

sample({
  clock: subsRequested,
  source: $streaming,
  filter: (_, language) => language != ES_CUSTOM_SUB_LABEL,
  fn: (streaming, language) => ({ streaming, language }),
  target: fetchSubsFx,
});

sample({
  clock: [videoTimeUpdate, $subs],
  source: { subs: $subs, video: $video },
  filter: ({ video }) => video != null,
  fn: ({ subs, video }, _) => ({ subs, video }),
  target: updateCurrentSubsFx,
});
sample({
  clock: videoTimeUpdate,
  source: { currentSubs: $currentSubs, video: $video, autoPause: $autoPause },
  fn: ({ currentSubs, video, autoPause }, _) => ({ currentSubs, video, autoPause }),
  filter: ({ currentSubs, video, autoPause }) => {
    if (!currentSubs[0] || !video || !autoPause || video.paused || video.ended) {
      return false;
    }
    const timeDiff = currentSubs[0].end - video.currentTime * 1000;
    return timeDiff < 250 && timeDiff > 0;
  },
  target: autoPauseFx,
});

sample({
  clock: subsDelayButtonPressed,
  target: subsDelayChangeFx,
});

sample({
  clock: subsDelayButtonPressed,
  source: { rawSubs: $rawSubs, subsDelay: $subsDelay },
  fn: ({ rawSubs, subsDelay }, delay) => ({ rawSubs, subsDelay, delay }),
  target: subsResyncFx,
});

sample({
  clock: subsReloadRequested,
  source: { subsTitle: $subsTitle, rawSubs: $rawSubs },
  filter: ({ subsTitle, rawSubs }) => subsTitle && rawSubs.length > 0,
  fn: ({ subsTitle }) => subsTitle,
  target: esSubsChanged,
});

// Streaming sites re-request the same caption track often; identical captions must not restart
// the split pipeline (it remounts every token and drops hover state).
const sameCaptions = (a: Captions, b: Captions): boolean =>
  a.length === b.length &&
  a.every((cue, i) => cue.text === b[i]!.text && cue.start === b[i]!.start && cue.end === b[i]!.end);

$rawSubs.on(
  [fetchSubsFx.doneData, subsResyncFx.doneData, updateCustomSubsFx.doneData, rawSubsAdded],
  (oldSubs, subs) => (sameCaptions(oldSubs, subs) ? oldSubs : subs)
);

$rawSubs.on(rawSubsAdded, (oldSubs, newSubs) => {
  const lastSub = oldSubs[oldSubs.length - 1];
  if (!lastSub) {
    return [...oldSubs, ...newSubs];
  }
  if (lastSub.text != newSubs[0].text && lastSub.start != newSubs[0].start) {
    const subs = oldSubs.slice(0, -1);
    lastSub.end = lastSub.start;
    return [...subs, ...[lastSub], ...newSubs];
  }
});

$rawSubs.reset(resetSubs);

sample({
  clock: $rawSubs,
  target: processRawSubsFx,
});

$subs.on(processRawSubsFx.doneData, (_, subs) => subs);
$subs.on(processJapaneseSubsFx.doneData, (_, subs) => subs);
$subs.reset(resetSubs);

// After the Segmenter paint, upgrade all cues via the local ONNX split.
sample({
  clock: processRawSubsFx.doneData,
  source: $rawSubs,
  filter: (rawSubs) => Boolean(rawSubs?.length),
  target: processJapaneseSubsFx,
});

$currentSubs.on([updateCurrentSubsFx.doneData, autoPauseFx.doneData], (oldSubs, subs) =>
  JSON.stringify(oldSubs) === JSON.stringify(subs) ? oldSubs : subs
);

$subsDelay.on(subsDelayChangeFx.doneData, (_, newSubsDelay) => newSubsDelay);
$subsTitle.on(esSubsChanged, (_, value) => value);
$subsTitle.on(updateCustomSubsFx.doneData, () => ES_CUSTOM_SUB_LABEL);

debug(
  $rawSubs,
  $subs,
  $subsDelay,
  subsResyncFx,
  autoPauseFx.doneData,
  $currentSubs,
  subsReloadRequested,
  $subsTitle,
  esSubsChanged,
  processRawSubsFx.doneData,
  processJapaneseSubsFx.doneData
);
