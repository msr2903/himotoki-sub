import { createStore, sample, split } from "effector";
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
import { autoPauseStep, rebindLoopedCue, type TAutoPauseTrack } from "./cuePlayback";
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
import { $autoPause, $enabled, $secondarySubs, $translateLanguage } from "../settings";
import { $dictGeneration, $dictReady } from "../translations";
import type { Captions, TSub } from "../types";
import type Service from "@src/streamings/service";
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
// Auto-pause at the end of each line. Time updates are sparse (≈250 ms), so besides the lead window
// before the end it also pauses when normal playback crosses the end (see autoPauseStep).
const $autoPauseTrack = createStore<TAutoPauseTrack | null>(null);
const autoPauseChecked = sample({
  clock: videoTimeUpdate,
  source: {
    currentSubs: $currentSubs,
    video: $video,
    autoPause: $autoPause,
    enabled: $enabled,
    looped: $loopedCue,
    track: $autoPauseTrack,
  },
  filter: ({ video }) => video != null,
  fn: ({ currentSubs, video, autoPause, enabled, looped, track }) => ({
    currentSubs,
    video,
    autoPause,
    ...autoPauseStep(track, {
      time: video!.currentTime * 1000,
      end: currentSubs[0]?.end ?? null,
      rate: video!.playbackRate,
      seeking: video!.seeking,
      active: enabled && autoPause && !looped && !video!.paused && !video!.ended,
    }),
  }),
});
// Explicit navigation is a seek, not playback running through a line end.
$autoPauseTrack
  .on(autoPauseChecked, (_, { track }) => track)
  .reset(moveKeyPressed, moveToTimeRequested, resetSubs, $video.updates);
sample({
  clock: autoPauseChecked,
  filter: ({ pause }) => pause,
  fn: ({ currentSubs, video, autoPause }) => ({ currentSubs, video, autoPause }),
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

// Only the latest caption request counts. A newer request or a reset makes an in-flight one stale,
// so a slow previous video/track can neither replace newer captions nor restore cleared ones.
const $currentSubsRequest = createStore<{ streaming: Service; language: string } | null>(null)
  .on(fetchSubsFx, (_, params) => params)
  .reset(resetSubs);
const currentSubsFetched = sample({
  clock: fetchSubsFx.done,
  source: $currentSubsRequest,
  filter: (current, { params }) => current === params,
  fn: (_, done) => done,
});

// A requested track that comes back empty is the most common "nothing happens" report; say so.
sample({
  clock: currentSubsFetched,
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
  [currentSubsFetched.map(({ result }) => result), subsResyncFx.doneData, updateCustomSubsFx.doneData],
  (oldSubs, subs) => (sameCaptions(oldSubs, subs) ? oldSubs : subs)
);

// Services that surface captions one cue at a time (MutationObserver-driven:
// Amazon/Plex/Kinopoisk/Udemy/in-flight Netflix) emit rawSubsAdded per cue; append them.
$rawSubs.on(rawSubsAdded, appendRawSubs);

$rawSubs.reset(resetSubs);
$sentenceOpen.reset(resetSubs);

// Keys already resolved against a dictionary generation, so captions that grow one cue at a time
// look up only their new words. Filled further below, once the removal signal exists.
type TCoverageResolved = { generation: number; keys: Map<string, string | null> } | null;
const $coverageResolved = createStore<TCoverageResolved>(null);
const knownCoverage = (resolved: TCoverageResolved, generation: number) =>
  resolved?.generation === generation ? resolved.keys : undefined;

// Resolve every distinct word's key once the subtitles are ready, for coverage stats.
sample({
  clock: $subs,
  source: { generation: $dictGeneration, resolved: $coverageResolved },
  filter: (_, subs) => subs.length > 0,
  fn: ({ generation, resolved }, subs) => ({ subs, generation, known: knownCoverage(resolved, generation) }),
  target: computeCoverageFx,
});
// The dictionary became available or was replaced (captions unchanged): rescan the loaded captions.
sample({
  clock: $dictGeneration.updates,
  source: { subs: $subs, ready: $dictReady },
  filter: ({ subs, ready }) => ready && subs.length > 0,
  fn: ({ subs }, generation) => ({ subs, generation }),
  target: computeCoverageFx,
});
// The dictionary was removed: the resolved keys belong to a dictionary that no longer exists.
const coverageDictRemoved = sample({
  clock: $dictGeneration.updates,
  source: { subs: $subs, ready: $dictReady },
  filter: ({ subs, ready }) => !ready && subs.length > 0,
});
// Results count only for the current captions and the dictionary they were resolved against.
const isCurrentCoverage = (
  { subs, generation }: { subs: TSub[]; generation: number },
  { params }: { params: { subs: TSub[]; generation: number } },
) => subs === params.subs && generation === params.generation;
const currentCoverageDone = sample({
  clock: computeCoverageFx.done,
  source: { subs: $subs, generation: $dictGeneration },
  filter: isCurrentCoverage,
  fn: (_, { result }) => result,
});
const currentCoverageFailed = sample({
  clock: computeCoverageFx.fail,
  source: { subs: $subs, generation: $dictGeneration },
  filter: isCurrentCoverage,
});
$coverageResolved
  .on(computeCoverageFx.done, (resolved, { params, result }) => {
    if (!result) return resolved;
    const keys = new Map(knownCoverage(resolved, params.generation));
    for (const surface of Object.keys(result)) keys.set(surface, result[surface]!);
    return { generation: params.generation, keys };
  })
  .reset(resetSubs, coverageDictRemoved);
$coverageKeys.on(currentCoverageDone, (_, map) => map ?? {}).reset(resetSubs, $subs.updates, coverageDictRemoved);
$coverageStatus
  .on(computeCoverageFx, () => "loading")
  .on(currentCoverageDone, (_, map) => map === null ? "missing" : "ready")
  .on(currentCoverageFailed, () => "error")
  .on(coverageDictRemoved, () => "missing")
  .reset(resetSubs);

// Pass the current list along so cues it already holds unchanged are not converted again (#144).
sample({
  clock: $rawSubs,
  source: $subs,
  fn: (previous, rawSubs) => ({ rawSubs, previous }),
  target: processRawSubsFx,
});

// Apply split results only when they belong to the current raw captions: both effects are
// async, so a batch finishing after a reset/track switch/delay change must not write stale
// cues back into $subs (same params-identity guard as computeCoverageFx above). `done` fires on
// failure too, so only successful results are written.
sample({
  clock: processRawSubsFx.done,
  source: $rawSubs,
  filter: (rawSubs, done) => !("error" in done) && rawSubs === done.params.rawSubs,
  fn: (_, done) => ("result" in done ? done.result : []),
  target: $subs,
});
sample({
  clock: processJapaneseSubsFx.done,
  source: $rawSubs,
  filter: (rawSubs, done) => !("error" in done) && rawSubs === done.params.rawSubs,
  fn: (_, done) => ("result" in done ? done.result : []),
  target: $subs,
});
$subs.reset(resetSubs);

// After the Segmenter paint, upgrade the cues it has not already analysed via the local ONNX split.
sample({
  clock: processRawSubsFx.done,
  source: $rawSubs,
  filter: (rawSubs, { params }) => Boolean(rawSubs?.length) && rawSubs === params.rawSubs,
  fn: (rawSubs, { result }) => ({ rawSubs, previous: result }),
  target: processJapaneseSubsFx,
});

/* ---------- Second subtitle line ---------- */

// Fetch the secondary track when the primary captions arrive, or when the mode / language changes.
sample({
  clock: [currentSubsFetched, $secondarySubs.updates, $translateLanguage.updates],
  source: { streaming: $streaming, mode: $secondarySubs, language: $translateLanguage, rawSubs: $rawSubs },
  filter: ({ mode, rawSubs, streaming }) => mode === "track" && rawSubs.length > 0 && streaming.name !== "stub",
  fn: ({ streaming, language }) => ({ streaming, language }),
  target: fetchSecondarySubsFx,
});

// Same rule for the second line: only the latest request for the current captions and settings.
const $currentSecondaryRequest = createStore<{ streaming: Service; language: string } | null>(null)
  .on(fetchSecondarySubsFx, (_, params) => params)
  .reset(resetSubs, fetchSubsFx, $secondarySubs.updates, $translateLanguage.updates);
const currentSecondaryFetched = sample({
  clock: fetchSecondarySubsFx.done,
  source: $currentSecondaryRequest,
  filter: (current, { params }) => current === params,
  fn: (_, { result }) => result,
});

$secondaryRawSubs
  .on(currentSecondaryFetched, (_, subs) => subs)
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
// New captions (track switch, custom import, delay resync): follow the same line or stop looping.
$loopedCue.on($subs.updates, rebindLoopedCue);

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
