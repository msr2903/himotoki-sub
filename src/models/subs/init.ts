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
  $secondaryRawSubs,
  $currentSecondarySubs,
  fetchSecondarySubsFx,
  updateCurrentSecondarySubsFx,
  $loopedCue,
  loopedCueSet,
  $sentenceOpen,
  $coverageKeys,
  $coverageStatus,
  computeCoverageFx,
} from ".";
import { appendRawSubs } from "./appendRawSubs";
import { $streaming } from "../streamings";
import {
  $video,
  videoTimeUpdate,
  moveToTimeRequested,
  moveKeyPressed,
  replayLinePressed,
  loopLineToggled,
  loopCleared,
} from "../videos";
import { $autoPause, $secondarySubs, $translateLanguage } from "../settings";
import type { Captions } from "../types";
import { debug } from "patronum";
import { cancelVideoClip } from "@src/utils/replayVideoClip";
import { notifyError, notifyInfo } from "@src/pages/content/notify";

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
  source: { currentSubs: $currentSubs, video: $video, autoPause: $autoPause, looped: $loopedCue },
  fn: ({ currentSubs, video, autoPause }, _) => ({ currentSubs, video, autoPause }),
  filter: ({ currentSubs, video, autoPause, looped }) => {
    if (looped || !currentSubs[0] || !video || !autoPause || video.paused || video.ended) {
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

// A requested track that comes back empty is the most common "nothing happens" report; say so.
sample({
  clock: fetchSubsFx.done,
  filter: ({ params, result }) => Boolean(params.language) && params.language !== ES_CUSTOM_SUB_LABEL && result.length === 0,
  fn: ({ params }) => params.language,
}).watch((language) => {
  notifyError(
    language.startsWith("ja")
      ? "No Japanese captions could be loaded for this video. Turn on CC in the player or upload subtitles in the Himotoki settings."
      : `No captions could be loaded for "${language}".`,
    "no-captions",
  );
});

// Full-track sources replace the whole caption list. rawSubsAdded is deliberately
// NOT in this list: it carries a single incremental cue and is handled by the
// append reducer below. (It used to be here too, and — running first — clobbered
// $rawSubs with the lone cue, so the append handler never accumulated anything.)
$rawSubs.on(
  [fetchSubsFx.doneData, subsResyncFx.doneData, updateCustomSubsFx.doneData],
  (oldSubs, subs) => (sameCaptions(oldSubs, subs) ? oldSubs : subs)
);

// Services that surface captions one cue at a time (MutationObserver-driven:
// Amazon/Plex/Kinopoisk/Udemy/in-flight Netflix) emit rawSubsAdded per cue; append them.
$rawSubs.on(rawSubsAdded, appendRawSubs);

$rawSubs.reset(resetSubs);
$sentenceOpen.reset(resetSubs);

// Resolve every distinct word's key once the subtitles are ready, for coverage stats.
sample({ clock: $subs, filter: (subs) => subs.length > 0, target: computeCoverageFx });
const currentCoverageDone = sample({
  clock: computeCoverageFx.done,
  source: $subs,
  filter: (subs, { params }) => subs === params,
  fn: (_, { result }) => result,
});
const currentCoverageFailed = sample({
  clock: computeCoverageFx.fail,
  source: $subs,
  filter: (subs, { params }) => subs === params,
});
$coverageKeys.on(currentCoverageDone, (_, map) => map ?? {}).reset(resetSubs, $subs.updates);
$coverageStatus
  .on(computeCoverageFx, () => "loading")
  .on(currentCoverageDone, (_, map) => map === null ? "missing" : "ready")
  .on(currentCoverageFailed, () => "error")
  .reset(resetSubs);

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

/* ---------- Second subtitle line ---------- */

// Fetch the secondary track when the primary captions arrive, or when the mode / language changes.
sample({
  clock: [fetchSubsFx.doneData, $secondarySubs.updates, $translateLanguage.updates],
  source: { streaming: $streaming, mode: $secondarySubs, language: $translateLanguage, rawSubs: $rawSubs },
  filter: ({ mode, rawSubs, streaming }) => mode === "track" && rawSubs.length > 0 && streaming.name !== "stub",
  fn: ({ streaming, language }) => ({ streaming, language }),
  target: fetchSecondarySubsFx,
});

$secondaryRawSubs
  .on(fetchSecondarySubsFx.doneData, (_, subs) => subs)
  .reset(resetSubs)
  .on($secondarySubs.updates, (subs, mode) => (mode === "track" ? subs : []));

sample({
  clock: [videoTimeUpdate, $secondaryRawSubs, $subsDelay],
  source: { subs: $secondaryRawSubs, video: $video, delayMs: $subsDelay.map((s) => s * 1000) },
  filter: ({ video, subs }) => video != null && subs.length > 0,
  target: updateCurrentSecondarySubsFx,
});
$currentSecondarySubs
  .on(updateCurrentSecondarySubsFx.doneData, (oldSubs, subs) =>
    oldSubs.length === subs.length && oldSubs.every((c, i) => c.text === subs[i]!.text) ? oldSubs : subs,
  )
  .reset(resetSubs)
  .on($secondaryRawSubs, (current, subs) => (subs.length ? current : []));

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


/* ---------- Replay / loop current line (idea 17) ---------- */

// R: jump to the start of the current line and play it.
sample({
  clock: replayLinePressed,
  source: $currentSubs,
  filter: (currentSubs) => currentSubs.length > 0,
  fn: (currentSubs) => currentSubs[0]!.start,
  target: moveToTimeRequested,
});
replayLinePressed.watch(() => {
  cancelVideoClip();
  if ($currentSubs.getState().length) void $video.getState()?.play().catch(() => {});
});
resetSubs.watch(cancelVideoClip);
loopLineToggled.watch(cancelVideoClip);

// L: toggle looping the current line. Toggling off (or with no current line) clears it.
sample({
  clock: loopLineToggled,
  source: { currentSubs: $currentSubs, looped: $loopedCue },
  fn: ({ currentSubs, looped }) => (looped ? null : (currentSubs[0] ?? null)),
  target: loopedCueSet,
});
$loopedCue.on(loopedCueSet, (_, cue) => cue).reset(loopCleared, resetSubs, moveKeyPressed);

// While looping, seek back to the cue start whenever playback leaves the cue window.
sample({
  clock: videoTimeUpdate,
  source: { looped: $loopedCue, video: $video },
  filter: ({ looped, video }) => {
    if (!looped || !video) return false;
    const t = video.currentTime * 1000;
    return t >= looped.end || t < looped.start - 500;
  },
  fn: ({ looped }) => looped!.start,
  target: moveToTimeRequested,
});

let loopWasOn = false;
$loopedCue.watch((cue) => {
  const on = Boolean(cue);
  if (on !== loopWasOn) {
    loopWasOn = on;
    notifyInfo(on ? "Looping this line (L to stop)" : "Loop off");
  }
});
