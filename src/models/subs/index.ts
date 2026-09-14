import { createStore, createEvent, createEffect, UnitValue, StoreValue } from "effector";
import { resync } from "subtitle";

import {
  convertJapaneseSubsFallback,
  convertJapaneseSubsWithLocalSplit,
} from "@src/utils/convertRawSubs";
import { $video } from "@src/models/videos";
import { getCurrentSubs } from "@src/utils/getCurrentSubs";
import type { Captions, TSub } from "../types";
import type Service from "@src/streamings/service";
import { $autoPause } from "../settings";

export const ES_CUSTOM_SUB_LABEL = "custom";
export const $rawSubs = createStore<Captions>([]);
export const $subs = createStore<TSub[]>([]);
/** The extension is Japanese-only; kept as a store so consumers (TTS, popup) share one source. */
export const $subsLanguage = createStore<string>("ja");
export const $subsTitle = createStore<string>(null);
export const $currentSubs = createStore<TSub[]>([]);
export const $prevCurrentSubs = createStore<TSub[]>([]);
export const esSubsChanged = createEvent<string>();
export const autoPauseFx = createEffect<
  {
    currentSubs: UnitValue<typeof $currentSubs>;
    video: UnitValue<typeof $video>;
    autoPause: StoreValue<typeof $autoPause>;
  },
  void
>(({ video }) => {
  video?.pause();
});

export const subsRequested = createEvent<string>();
export const subsReloadRequested = createEvent();
export const fetchSubs = createEvent<{ streaming: Service; language: string }>();
export const resetSubs = createEvent<string>();
export const fetchSubsFx = createEffect<{ streaming: Service; language: string }, Captions>(
  async ({ streaming, language }) => {
    try {
      return (await streaming.getSubs(language)) ?? [];
    } catch (error) {
      console.error(error);
      return [];
    }
  }
);
export const updateCurrentSubsFx = createEffect<{ subs: TSub[]; video: UnitValue<typeof $video> }, TSub[]>(
  ({ subs, video }) => {
    if (!video) return [];
    return getCurrentSubs(subs, video.currentTime * 1000);
  }
);
export const updatePrevCurrentSubsFx = createEffect<TSub[], TSub[]>((subs) => subs);
export const rawSubsAdded = createEvent<Captions>();
export const updateCustomSubsFx = createEffect<Captions, Captions>((subs) => subs);

/** Immediate paint using Intl.Segmenter, before the ONNX model has run. */
export const processRawSubsFx = createEffect<Captions, TSub[]>(async (rawSubs) => {
  if (!rawSubs?.length) return [];
  return convertJapaneseSubsFallback(rawSubs);
});

/** Full-transcript local ONNX split (upgrades every cue). */
export const processJapaneseSubsFx = createEffect<Captions, TSub[]>(
  async (rawSubs) => convertJapaneseSubsWithLocalSplit(rawSubs),
);

/* ---------- Second subtitle line (subtitle track mode) ---------- */

export const $secondaryRawSubs = createStore<Captions>([]);
export const $currentSecondarySubs = createStore<Captions>([]);
export const fetchSecondarySubsFx = createEffect<{ streaming: Service; language: string }, Captions>(
  async ({ streaming, language }) => {
    try {
      const fetcher = streaming.getSecondarySubs ?? streaming.getSubs;
      return (await fetcher.call(streaming, language)) ?? [];
    } catch (error) {
      console.warn("[himotoki] secondary subtitles failed", error);
      return [];
    }
  },
);
export const updateCurrentSecondarySubsFx = createEffect<
  { subs: Captions; video: UnitValue<typeof $video>; delayMs: number },
  Captions
>(({ subs, video, delayMs }) => {
  if (!video) return [];
  const time = video.currentTime * 1000 - delayMs;
  return subs.filter((cue) => Number(cue.start) <= time && Number(cue.end) >= time);
});

export const $subsDelay = createStore<number>(0);
export const subsDelayButtonPressed = createEvent<number>();
export const subsDelayChangeFx = createEffect<number, number>((value) => value);
export const subsResyncFx = createEffect<
  { rawSubs: Captions; subsDelay: StoreValue<typeof $subsDelay>; delay: number },
  Captions
>(({ rawSubs, subsDelay, delay }) => resync(rawSubs, (delay - subsDelay) * 1000));
