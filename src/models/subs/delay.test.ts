import { describe, expect, it, vi } from "vitest";
import { allSettled, fork } from "effector";

// Real subtitle wiring; settings, streaming, notifications and the split effects are controlled.
vi.mock("patronum", () => ({ debug: () => undefined }));
vi.mock("@src/pages/content/notify", () => ({ notifyInfo: () => undefined, notifyError: () => undefined }));
vi.mock("../settings", async () => {
  const { createStore } = await import("effector");
  return {
    $autoPause: createStore(false),
    $enabled: createStore(true),
    $secondarySubs: createStore("off"),
    $translateLanguage: createStore("en"),
    $translationService: createStore("google"),
    $deeplApiKey: createStore(""),
    $knownWords: createStore([]),
  };
});
vi.mock("../streamings", async () => {
  const { createStore } = await import("effector");
  return { $streaming: createStore({ name: "test" }) };
});

import {
  $rawSubs,
  $subsDelay,
  fetchSubsFx,
  processJapaneseSubsFx,
  processRawSubsFx,
  rawSubsAdded,
  resetSubs,
  subsDelayButtonPressed,
  updateCustomSubsFx,
} from ".";
import "./init";
import type Service from "@src/streamings/service";

const setup = () =>
  fork({
    handlers: [
      [processRawSubsFx, async () => []],
      [processJapaneseSubsFx, async () => []],
    ],
  });
const starts = (scope: ReturnType<typeof setup>) => scope.getState($rawSubs).map((cue) => Number(cue.start));
const cue = (start: number, text = "猫") => ({ text, start, end: start + 1000 });

describe("a subtitle delay survives new captions (#122)", () => {
  it("a new upload is shifted by the delay the label shows", async () => {
    const scope = setup();
    await allSettled(updateCustomSubsFx, { scope, params: [cue(10_000)] });
    await allSettled(subsDelayButtonPressed, { scope, params: 1 });
    expect(starts(scope)).toEqual([11_000]);

    await allSettled(updateCustomSubsFx, { scope, params: [cue(20_000)] });
    expect(scope.getState($subsDelay)).toBe(1);
    expect(starts(scope)).toEqual([21_000]);

    await allSettled(subsDelayButtonPressed, { scope, params: 1.5 });
    expect(starts(scope)).toEqual([21_500]);
    await allSettled(subsDelayButtonPressed, { scope, params: 0 });
    expect(starts(scope)).toEqual([20_000]);
  });

  it("clearing the subtitles starts the next track without a delay", async () => {
    const scope = setup();
    await allSettled(updateCustomSubsFx, { scope, params: [cue(10_000)] });
    await allSettled(subsDelayButtonPressed, { scope, params: 1 });
    await allSettled(resetSubs, { scope, params: "" });
    expect(scope.getState($subsDelay)).toBe(0);
    await allSettled(updateCustomSubsFx, { scope, params: [cue(20_000)] });
    expect(starts(scope)).toEqual([20_000]);
    await allSettled(subsDelayButtonPressed, { scope, params: 1.5 });
    expect(starts(scope)).toEqual([21_500]);
  });

  it("a reloaded track is shifted, and an identical reload keeps the same list", async () => {
    const scope = setup();
    const streaming = { name: "test", getSubs: async () => [cue(5_000)] } as unknown as Service;
    await allSettled(fetchSubsFx, { scope, params: { streaming, language: "ja" } });
    await allSettled(subsDelayButtonPressed, { scope, params: -0.5 });
    expect(starts(scope)).toEqual([4_500]);
    const shifted = scope.getState($rawSubs);

    await allSettled(fetchSubsFx, { scope, params: { streaming, language: "ja" } });
    expect(scope.getState($rawSubs)).toBe(shifted);
  });

  it("cues that arrive one at a time are shifted too", async () => {
    const scope = setup();
    await allSettled(subsDelayButtonPressed, { scope, params: 2 });
    await allSettled(rawSubsAdded, { scope, params: [cue(1_000, "一")] });
    await allSettled(rawSubsAdded, { scope, params: [cue(3_000, "二")] });
    expect(starts(scope)).toEqual([3_000, 5_000]);
    await allSettled(subsDelayButtonPressed, { scope, params: 1 });
    expect(starts(scope)).toEqual([2_000, 4_000]);
  });
});
