import { allSettled, fork, scopeBind } from "effector";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@src/models/settings", async () => {
  const { createStore } = await import("effector");
  return {
    $translateLanguage: createStore("en"),
    $translationService: createStore("google"),
    $deeplApiKey: createStore(""),
  };
});
vi.mock("@src/models/subs", async () => {
  const { createStore } = await import("effector");
  return { $currentSubs: createStore([]), $subs: createStore([]) };
});
vi.mock("@src/models/videos", async () => {
  const { createStore } = await import("effector");
  return { $video: createStore<HTMLVideoElement | null>(null) };
});
vi.mock("@src/utils/withPersist", () => ({ withPersist: <T>(store: T) => store }));

import { $video } from "@src/models/videos";
import { $dictReady, fetchWordTranslationFx, lookupRequested, lookupVisited } from "@src/models/translations";
import type { TWordTranslation } from "@src/models/types";
import { $lookupHistory } from ".";
import "./init";

const cat: TWordTranslation = {
  source: "猫",
  headword: "猫",
  reading: "ねこ",
  mainTranslation: "cat",
  targetLanguage: "en",
  translations: [],
  transcription: "",
  lookupSource: "local",
  himotokiSave: { source: "jitendex", seq: 1467640, headword: "猫" },
};
const dog: TWordTranslation = { ...cat, source: "犬", headword: "犬", mainTranslation: "dog", himotokiSave: { source: "jitendex", seq: 1259970, headword: "犬" } };

const onVideo = (id: string) => {
  vi.stubGlobal("location", { href: `https://www.youtube.com/watch?v=${id}` });
  vi.stubGlobal("document", { title: id });
};

afterEach(() => vi.unstubAllGlobals());

describe("Recent lookups (#140)", () => {
  it("a cached lookup in a later video records the new video and time and moves to the front", async () => {
    const lookup = vi.fn(async ({ source }: { source: string }) => (source === "猫" ? cat : dog));
    const video = { currentTime: 10 };
    const scope = fork({
      handlers: [[fetchWordTranslationFx, lookup]],
      values: [[$video, video as unknown as HTMLVideoElement], [$dictReady, true]],
    });

    onVideo("first");
    await allSettled(lookupRequested, { scope, params: "猫" });
    await allSettled(lookupVisited, { scope, params: "猫" });
    await allSettled(lookupRequested, { scope, params: "犬" });
    await allSettled(lookupVisited, { scope, params: "犬" });
    expect(scope.getState($lookupHistory).map((h) => h.source)).toEqual(["犬", "猫"]);

    onVideo("second");
    video.currentTime = 50;
    await allSettled(lookupRequested, { scope, params: "猫" });
    await allSettled(lookupVisited, { scope, params: "猫" });
    expect(lookup).toHaveBeenCalledTimes(2); // served from cache
    const [first, second] = scope.getState($lookupHistory);
    expect(first).toMatchObject({ source: "猫", videoTimeMs: 50_000, videoKey: "yt:second", videoTitle: "second" });
    expect(second.source).toBe("犬");
  });

  it("records a visit that was waiting for its lookup when the result arrives", async () => {
    let resolve!: (t: TWordTranslation) => void;
    const scope = fork({
      handlers: [[fetchWordTranslationFx, () => new Promise<TWordTranslation>((r) => (resolve = r))]],
      values: [[$video, { currentTime: 3 } as unknown as HTMLVideoElement], [$dictReady, true]],
    });
    onVideo("v");
    scopeBind(lookupRequested, { scope })("猫");
    scopeBind(lookupVisited, { scope })("猫");
    expect(scope.getState($lookupHistory)).toEqual([]);
    resolve(cat);
    await allSettled(scope);
    expect(scope.getState($lookupHistory)).toEqual([expect.objectContaining({ source: "猫", videoTimeMs: 3000 })]);
  });

  it("passive lookups (furigana, colouring) are not recorded", async () => {
    const scope = fork({ handlers: [[fetchWordTranslationFx, async () => cat]], values: [[$dictReady, true]] });
    await allSettled(lookupRequested, { scope, params: "猫" });
    expect(scope.getState($lookupHistory)).toEqual([]);
  });
});
