import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeVideo } from "@src/utils/fakeVideo.testutil";

// Real video + subtitle models and their wiring; settings, streaming, the ONNX split and toasts are
// replaced so the graph runs in node.
vi.mock("@src/models/settings", async () => {
  const { createEvent, createStore } = await import("effector");
  const enabledChanged = createEvent<boolean>();
  const autoPauseChanged = createEvent<boolean>();
  const playbackRateChanged = createEvent<number>();
  return {
    enabledChanged,
    autoPauseChanged,
    playbackRateChanged,
    $enabled: createStore(true).on(enabledChanged, (_, v) => v),
    $autoPause: createStore(false).on(autoPauseChanged, (_, v) => v),
    $playbackRate: createStore(1).on(playbackRateChanged, (_, v) => v),
    $secondarySubs: createStore("off"),
    $translateLanguage: createStore("en"),
    // Read by the translations model, which the subtitle wiring imports for dictionary coverage.
    $translationService: createStore("google"),
    $deeplApiKey: createStore(""),
    $knownWords: createStore([]),
  };
});
vi.mock("@src/models/streamings", async () => {
  const { createStore } = await import("effector");
  return { $streaming: createStore({ name: "test", isOnFlight: () => false }) };
});
vi.mock("@src/utils/convertRawSubs", () => {
  const convert = (raw: Array<{ start: number; end: number; text: string }>) =>
    raw.map((cue, id) => ({ id, start: Number(cue.start), end: Number(cue.end), text: cue.text, cleanedText: cue.text, items: [] }));
  return { convertJapaneseSubsFallback: convert, convertJapaneseSubsWithLocalSplit: async (raw: never) => convert(raw) };
});
vi.mock("@src/pages/content/notify", () => ({ notifyError: vi.fn(), notifyInfo: vi.fn() }));
vi.mock("patronum", () => ({ debug: () => {} }));

import * as settings from "@src/models/settings";
import "@src/models/videos/init";
import "@src/models/subs/init";
import {
  $video,
  $wasPaused,
  getCurrentVideoFx,
  loopLineToggled,
  slowReplayRequested,
  videoTimeUpdate,
  wasPausedChanged,
} from "@src/models/videos";
import { $loopedCue, resetSubs, subsDelayButtonPressed, updateCustomSubsFx } from "@src/models/subs";
import { SLOW_REPLAY_RATE } from "@src/shared/playbackRate";

const mocked = settings as unknown as {
  enabledChanged: (v: boolean) => void;
  autoPauseChanged: (v: boolean) => void;
  playbackRateChanged: (v: number) => void;
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
let video: FakeVideo;

const useVideo = async (next = new FakeVideo()) => {
  getCurrentVideoFx.use(async () => next.asVideo());
  await getCurrentVideoFx();
  video = next;
  return next;
};
const loadSubs = async (cues: Array<[number, number, string]>) => {
  await updateCustomSubsFx(cues.map(([start, end, text]) => ({ start, end, text })) as never);
  await flush();
};
/** One playback update: the media `timeupdate` and the content script's videoTimeUpdate. */
const at = async (ms: number) => {
  video.tick(ms);
  videoTimeUpdate();
  await flush();
};

beforeEach(async () => {
  resetSubs("");
  mocked.enabledChanged(true);
  mocked.autoPauseChanged(false);
  mocked.playbackRateChanged(1);
  await useVideo();
  video.paused = false;
});

describe("slow replay wiring (#108)", () => {
  it("a speed chosen during the replay is kept when the line ends", async () => {
    await loadSubs([[1000, 5000, "a"]]);
    await at(1500);
    slowReplayRequested();
    expect(video.playbackRate).toBe(SLOW_REPLAY_RATE);
    mocked.playbackRateChanged(1.5);
    expect(video.playbackRate).toBe(1.5);
    for (const t of [1000, 2500, 4000, 5100, 6000]) await at(t);
    expect(video.playbackRate).toBe(1.5);
    expect(settings.$playbackRate.getState()).toBe(1.5);
  });

  it("a replaced video ends the replay and gets the user's speed", async () => {
    await loadSubs([[1000, 5000, "a"]]);
    await at(1500);
    slowReplayRequested();
    const old = video;
    await useVideo();
    expect(old.playbackRate).toBe(1);
    expect(video.playbackRate).toBe(1);
  });
});

describe("disabling the extension (#111)", () => {
  it("stops an active loop and slow replay", async () => {
    await loadSubs([[1000, 5000, "a"]]);
    await at(1500);
    loopLineToggled();
    expect($loopedCue.getState()).not.toBeNull();
    slowReplayRequested();
    mocked.enabledChanged(false);
    expect($loopedCue.getState()).toBeNull();
    expect(video.playbackRate).toBe(1);
  });

  it("does not auto-pause while disabled", async () => {
    mocked.autoPauseChanged(true);
    await loadSubs([[0, 4000, "a"]]);
    mocked.enabledChanged(false);
    for (const t of [3500, 3800, 4100]) await at(t);
    expect(video.pauseCalls).toBe(0);
  });
});

describe("loop after caption changes (#130)", () => {
  it("ends the loop when replacement captions arrive", async () => {
    await loadSubs([[1000, 2000, "古い"]]);
    await at(1500);
    loopLineToggled();
    expect($loopedCue.getState()?.start).toBe(1000);
    await loadSubs([[10000, 11000, "新しい"]]);
    expect($loopedCue.getState()).toBeNull();
  });

  it("follows the same line after a delay resync", async () => {
    await loadSubs([[1000, 2000, "同じ"]]);
    await at(1500);
    loopLineToggled();
    subsDelayButtonPressed(1);
    await flush();
    expect($loopedCue.getState()).toMatchObject({ start: 2000, end: 3000 });
    loopLineToggled();
  });
});

describe("auto-pause wiring (#131)", () => {
  it("pauses when updates land exactly 250 ms before and at the cue end", async () => {
    mocked.autoPauseChanged(true);
    await loadSubs([[0, 4000, "a"]]);
    for (const t of [3500, 3750, 4000]) await at(t);
    expect(video.pauseCalls).toBe(1);
  });

  it("does not pause on resume after the pause, nor on a seek past the end", async () => {
    mocked.autoPauseChanged(true);
    await loadSubs([[0, 4000, "a"], [6000, 9000, "b"]]);
    for (const t of [3600, 3850]) await at(t);
    expect(video.pauseCalls).toBe(1);
    video.paused = false;
    for (const t of [4100, 4350]) await at(t);
    expect(video.pauseCalls).toBe(1);
    await at(7000);
    await at(30000);
    expect(video.pauseCalls).toBe(1);
  });
});

describe("hover pause ownership (#142)", () => {
  it("is dropped when the video is replaced", async () => {
    wasPausedChanged(true);
    expect($wasPaused.getState()).toBe(true);
    await useVideo();
    expect($wasPaused.getState()).toBe(false);
    expect($video.getState()).toBe(video.asVideo());
  });
});
