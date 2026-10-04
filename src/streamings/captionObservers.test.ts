import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, FakeMutationObserver, FakeText, installFakeDom } from "./fakeDom.testutil";

// The real adapters with their subtitle/settings/video models replaced by spies and a plain store.
const emitted = vi.hoisted(() => [] as Array<{ start: number; end: number; text: string }>);
vi.mock("@src/models/settings", () => ({ esRenderSetings: vi.fn() }));
vi.mock("@src/models/subs", () => ({
  esSubsChanged: vi.fn(),
  rawSubsAdded: (cues: Array<{ start: number; end: number; text: string }>) => emitted.push(...cues),
}));
vi.mock("@src/models/videos", async () => {
  const { createEvent, createStore } = await import("effector");
  const videoSet = createEvent<unknown>();
  return { videoSet, $video: createStore<unknown>(null).on(videoSet, (_, v) => v) };
});

import Udemy from "./udemy";
import Plex from "./plex";
import Amazon from "./amazon";
import Kinopoisk from "./kinopoisk";
import NetflixOnFlight from "./netflixOnFlight";
import * as videos from "@src/models/videos";

const videoSet = (videos as unknown as { videoSet: (v: unknown) => void }).videoSet;
const el = (tag: string, attrs: Record<string, string> = {}, children: Array<FakeElement | FakeText | string> = []) =>
  new FakeElement(tag, attrs, children);

function mount(body: FakeElement) {
  const dom = installFakeDom(body);
  vi.stubGlobal("document", dom.document);
  vi.stubGlobal("MutationObserver", dom.MutationObserver);
  vi.stubGlobal("Node", dom.Node);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", globalThis);
  emitted.length = 0;
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("observer-based caption adapters", () => {
  const udemyPage = (caption: FakeElement[]) => {
    const video = el("video");
    video.currentTime = 5;
    const container = el("div", { class: "captions-display--captions-container--x" }, caption);
    return { body: el("body", {}, [video, container]), video, container };
  };

  it("publishes a caption already visible when it attaches (#132)", () => {
    const { body } = udemyPage([el("span", { "data-purpose": "captions-cue-text" }, ["猫です。"])]);
    mount(body);
    new Udemy().init();
    vi.advanceTimersByTime(300);
    expect(emitted).toEqual([{ start: 5000, end: 105000, text: "猫です。" }]);
    // The next mutation with the same caption is not a new line.
    FakeMutationObserver.live()[0]!.trigger();
    expect(emitted).toHaveLength(1);
  });

  it("publishes nothing for an initially empty container", () => {
    const { body } = udemyPage([]);
    mount(body);
    new Udemy().init();
    vi.advanceTimersByTime(300);
    expect(emitted).toEqual([]);
  });

  it("sees a caption whose text node is rewritten in place, once (#133)", () => {
    const text = new FakeText("猫です。");
    const { body, video } = udemyPage([el("span", { "data-purpose": "captions-cue-text" }, [text])]);
    mount(body);
    new Udemy().init();
    vi.advanceTimersByTime(300);
    const [observer] = FakeMutationObserver.live();
    expect(observer!.options).toMatchObject({ childList: true, subtree: true, characterData: true });

    video.currentTime = 7;
    text.data = "犬です。";
    observer!.trigger();
    observer!.trigger();
    expect(emitted.map((c) => c.text)).toEqual(["猫です。", "犬です。"]);
    expect(emitted[1]!.start).toBe(7000);
  });

  it("reads nested styled Plex spans once and keeps sibling runs and lines apart (#143)", () => {
    const subs = el("div", { class: "libjass-subs" }, [
      el("div", {}, [el("span", {}, [el("span", {}, [el("span", {}, ["猫です。"])])])]),
    ]);
    mount(el("body", {}, [el("video"), subs]));
    new Plex().init();
    vi.advanceTimersByTime(300);
    expect(emitted.map((c) => c.text)).toEqual(["猫です。"]);

    // Two styled runs on one line, then a second line after a <br>.
    const line = el("span", {}, [el("span", {}, ["猫"]), el("span", {}, ["です。"]), el("br"), el("span", {}, ["はい。"])]);
    subs.childNodes = [];
    subs.append(el("div", {}, [line]));
    FakeMutationObserver.live()[0]!.trigger();
    expect(emitted.map((c) => c.text)).toEqual(["猫です。", "猫です。\nはい。"]);
  });

  it("keeps a repeated line within one caption (no global de-dup)", () => {
    const subs = el("div", { class: "libjass-subs" }, [
      el("div", {}, [el("span", {}, [el("span", {}, ["はい。"])])]),
      el("div", {}, [el("span", {}, [el("span", {}, ["はい。"])])]),
    ]);
    mount(el("body", {}, [el("video"), subs]));
    new Plex().init();
    vi.advanceTimersByTime(300);
    expect(emitted.map((c) => c.text)).toEqual(["はい。\nはい。"]);
  });

  it("reads Netflix in-flight and Kinopoisk captions on attach too (#132)", () => {
    const video = el("video");
    mount(
      el("body", {}, [
        video,
        el("div", { class: "player-timedtext" }, [el("div", { class: "player-timedtext-text-container" }, ["猫"])]),
      ]),
    );
    new NetflixOnFlight().init();
    vi.advanceTimersByTime(300);
    expect(emitted.map((c) => c.text)).toEqual(["猫"]);

    emitted.length = 0;
    mount(
      el("body", {}, [
        video,
        el("div", { "data-tid": "SubtitlesPortalRoot" }, [el("div", { class: "Subtitles_text__x" }, ["犬"])]),
      ]),
    );
    new Kinopoisk().init();
    videoSet(video);
    vi.advanceTimersByTime(300);
    expect(emitted.map((c) => c.text)).toEqual(["犬"]);
    videoSet(null);
  });
});

describe("Prime Video caption observer ownership (#114)", () => {
  // One adapter for the block: $video is a module-level store, so every init() stays subscribed.
  let amazon: Amazon | null = null;
  const start = () => {
    if (!amazon) (amazon = new Amazon()).init();
  };
  const player = (time: number, caption: string) => {
    const video = el("video");
    video.currentTime = time;
    const source = el("div", { class: "atvwebplayersdk-captions-overlay" }, [
      el("span", { class: "atvwebplayersdk-captions-text" }, [caption]),
    ]);
    const body = el("body", {}, [el("div", { id: "dv-web-player" }, [video]), source]);
    return { video, source, body };
  };

  it("disconnects the old video's observer and ignores its late mutations", () => {
    const a = player(90, "古い動画");
    mount(a.body);
    start();
    videoSet(a.video);
    vi.advanceTimersByTime(300);
    const [oldObserver] = FakeMutationObserver.live();
    expect(emitted.map((c) => [c.text, c.start])).toEqual([["古い動画", 90000]]);

    const b = player(2, "新しい動画");
    mount(b.body);
    videoSet(b.video);
    vi.advanceTimersByTime(300);
    expect(FakeMutationObserver.live()).toHaveLength(1);
    expect(oldObserver!.connected).toBe(false);
    expect(emitted.map((c) => [c.text, c.start]).at(-1)).toEqual(["新しい動画", 2000]);

    const before = emitted.length;
    (a.source.childNodes[0] as FakeElement).childNodes = [new FakeText("古い字幕")];
    oldObserver!.trigger();
    expect(emitted).toHaveLength(before);
    videoSet(null);
    expect(FakeMutationObserver.live()).toHaveLength(0);
  });

  it("stops waiting for the player of a video that was replaced before it appeared", () => {
    const a = player(90, "古い動画");
    mount(el("body"));
    start();
    videoSet(a.video);
    const b = player(2, "新しい動画");
    videoSet(b.video);
    mount(b.body);
    vi.advanceTimersByTime(900);
    expect(FakeMutationObserver.all).toHaveLength(1);
    expect(emitted.map((c) => c.text)).toEqual(["新しい動画"]);
    videoSet(null);
  });
});
