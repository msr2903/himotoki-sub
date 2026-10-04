import { describe, expect, it, vi } from "vitest";
import { allSettled, fork } from "effector";

// Real subtitle wiring; settings, streaming, notifications and the split effects are controlled.
const notifyError = vi.hoisted(() => vi.fn());
vi.mock("patronum", () => ({ debug: () => undefined }));
vi.mock("@src/pages/content/notify", () => ({ notifyInfo: () => undefined, notifyError }));
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
  $secondaryRawSubs,
  fetchSecondarySubsFx,
  fetchSubsFx,
  processJapaneseSubsFx,
  processRawSubsFx,
  resetSubs,
} from ".";
import "./init";
import type Service from "@src/streamings/service";

type Cue = { text: string; start: number; end: number };

/** A streaming double whose caption requests resolve when the test says so. */
function deferredStreaming() {
  const pending: Array<(cues: Cue[]) => void> = [];
  const request = () => new Promise<Cue[]>((resolve) => pending.push(resolve));
  const streaming = { name: "test", getSubs: request, getSecondarySubs: request } as unknown as Service;
  return { streaming, pending };
}

const setup = () =>
  fork({
    handlers: [
      [processRawSubsFx, async () => []],
      [processJapaneseSubsFx, async () => []],
    ],
  });
const texts = (cues: Cue[]) => cues.map((c) => c.text);
const cue = (text: string): Cue => ({ text, start: 0, end: 1000 });

describe("caption fetches belong to the request that started them (#105)", () => {
  it("an older video's late response does not replace the newer captions", async () => {
    const scope = setup();
    const { streaming, pending } = deferredStreaming();
    const a = allSettled(fetchSubsFx, { scope, params: { streaming, language: "ja" } });
    const b = allSettled(fetchSubsFx, { scope, params: { streaming, language: "ja" } });
    pending[1]!([cue("New video")]);
    // allSettled waits for every pending effect in the scope, so observe B before releasing A.
    await vi.waitFor(() => expect(texts(scope.getState($rawSubs))).toEqual(["New video"]));
    pending[0]!([cue("Old video")]);
    await Promise.all([a, b]);
    expect(texts(scope.getState($rawSubs))).toEqual(["New video"]);
  });

  it("a response arriving after reset does not restore subtitles", async () => {
    const scope = setup();
    const { streaming, pending } = deferredStreaming();
    const c = allSettled(fetchSubsFx, { scope, params: { streaming, language: "ja" } });
    const reset = allSettled(resetSubs, { scope, params: "" });
    pending[0]!([cue("Old video")]);
    await Promise.all([c, reset]);
    expect(scope.getState($rawSubs)).toEqual([]);
  });

  it("a stale empty response does not report missing captions", async () => {
    notifyError.mockClear();
    const scope = setup();
    const { streaming, pending } = deferredStreaming();
    const a = allSettled(fetchSubsFx, { scope, params: { streaming, language: "ja" } });
    const b = allSettled(fetchSubsFx, { scope, params: { streaming, language: "ja" } });
    pending[1]!([cue("New video")]);
    await vi.waitFor(() => expect(texts(scope.getState($rawSubs))).toEqual(["New video"]));
    pending[0]!([]);
    await Promise.all([a, b]);
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("an older secondary-track response does not replace the newer one, or survive reset", async () => {
    const scope = setup();
    const { streaming, pending } = deferredStreaming();
    const a = allSettled(fetchSecondarySubsFx, { scope, params: { streaming, language: "en" } });
    const b = allSettled(fetchSecondarySubsFx, { scope, params: { streaming, language: "en" } });
    pending[1]!([cue("new")]);
    await vi.waitFor(() => expect(texts(scope.getState($secondaryRawSubs))).toEqual(["new"]));
    pending[0]!([cue("old")]);
    await Promise.all([a, b]);
    expect(texts(scope.getState($secondaryRawSubs))).toEqual(["new"]);

    const c = allSettled(fetchSecondarySubsFx, { scope, params: { streaming, language: "en" } });
    const reset = allSettled(resetSubs, { scope, params: "" });
    await vi.waitFor(() => expect(scope.getState($secondaryRawSubs)).toEqual([]));
    pending[2]!([cue("late")]);
    await Promise.all([c, reset]);
    expect(scope.getState($secondaryRawSubs)).toEqual([]);
  });
});
