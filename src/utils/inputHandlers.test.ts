import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Real handlers; models replaced by plain stores/events so the tests need no extension APIs.
vi.mock("@src/models/settings", async () => {
  const { createEvent, createStore } = await import("effector");
  const enabledChanged = createEvent<boolean>();
  const middleChanged = createEvent<string>();
  const $enabled = createStore(true).on(enabledChanged, (_, v) => v);
  return {
    enabledChanged,
    middleChanged,
    $enabled,
    $moveBySubsEnabled: createStore(true),
    $mouseActions: {
      middle: createStore("none").on(middleChanged, (_, v) => v),
      back: createStore("none"),
      forward: createStore("none"),
    },
    secondarySubsCycled: createEvent(),
    playbackRateSpeedUp: createEvent(),
    playbackRateSpeedDown: createEvent(),
    listeningPeekToggled: createEvent(),
  };
});
vi.mock("@src/models/videos", async () => {
  const { createEvent, createStore } = await import("effector");
  const videoSet = createEvent<unknown>();
  return {
    $video: createStore<unknown>(null).on(videoSet, (_, v) => v),
    videoSet,
    moveKeyPressed: createEvent(),
    replayLinePressed: createEvent(),
    loopLineToggled: createEvent(),
    slowReplayRequested: createEvent(),
  };
});
vi.mock("@src/models/subs", async () => {
  const { createEvent } = await import("effector");
  return { sentenceToggled: createEvent(), transcriptToggled: createEvent() };
});
vi.mock("@src/models/streamings", async () => {
  const { createStore } = await import("effector");
  return { $streaming: createStore({ isOnFlight: () => false }) };
});

import * as settings from "@src/models/settings";
import * as videos from "@src/models/videos";
import * as subs from "@src/models/subs";
import { keyboardHandler } from "./keyboardHandler";
import { addMouseEventsListeners, removeMouseEventsListeners } from "./mouseHandler";

const mocked = settings as unknown as typeof settings & {
  enabledChanged: (v: boolean) => void;
  middleChanged: (v: string) => void;
};

const fakeTarget = (attrs: Record<string, string> = {}, tagName = "DIV") => ({
  tagName,
  getAttribute: (name: string) => attrs[name] ?? null,
  parentElement: null,
  parentNode: null,
});

const key = (code: string, init: { type?: string; repeat?: boolean; target?: unknown } = {}) => {
  const event = {
    type: init.type ?? "keydown",
    code,
    repeat: init.repeat ?? false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: init.target ?? fakeTarget(),
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
  keyboardHandler(event as unknown as KeyboardEvent);
  return event;
};

const spyOn = (unit: { watch: (fn: () => void) => { unsubscribe: () => void } }) => {
  const fn = vi.fn();
  const sub = unit.watch(fn);
  return { fn, unsubscribe: sub.unsubscribe };
};

afterEach(() => mocked.enabledChanged(true));

describe("keyboard shortcuts", () => {
  it("ignore OS auto-repeat for toggles but keep repeating speed steps (#127)", () => {
    const transcript = spyOn(subs.transcriptToggled);
    const speed = spyOn(settings.playbackRateSpeedUp);
    const first = key("KeyT");
    for (let i = 0; i < 10; i++) key("KeyT", { repeat: true });
    key("KeyT", { type: "keyup" });
    expect(transcript.fn).toHaveBeenCalledTimes(1);
    expect(first.preventDefault).toHaveBeenCalled();

    key("Period");
    key("Period", { repeat: true });
    expect(speed.fn).toHaveBeenCalledTimes(2);
    transcript.unsubscribe();
    speed.unsubscribe();
  });

  it.each(["KeyD", "KeyB", "KeyL", "KeyH", "KeyR", "Backslash"])("%s fires once per press", (code) => {
    const units = {
      KeyD: settings.secondarySubsCycled,
      KeyB: subs.sentenceToggled,
      KeyL: videos.loopLineToggled,
      KeyH: settings.listeningPeekToggled,
      KeyR: videos.replayLinePressed,
      Backslash: videos.slowReplayRequested,
    } as const;
    const spy = spyOn(units[code as keyof typeof units]);
    key(code);
    key(code, { repeat: true });
    key(code, { repeat: true });
    expect(spy.fn).toHaveBeenCalledTimes(1);
    spy.unsubscribe();
  });

  it("leave plaintext-only editors alone (#128)", () => {
    const replay = spyOn(videos.replayLinePressed);
    const editor = fakeTarget({ contenteditable: "plaintext-only" });
    const event = key("KeyR", { target: editor });
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(replay.fn).not.toHaveBeenCalled();
    replay.unsubscribe();
  });

  it("are released while the extension is disabled, and come back on re-enable (#111)", () => {
    const speed = spyOn(settings.playbackRateSpeedUp);
    const move = spyOn(videos.moveKeyPressed);
    mocked.enabledChanged(false);
    const event = key("Period");
    const arrow = key("ArrowRight");
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
    expect(arrow.stopPropagation).not.toHaveBeenCalled();
    expect(speed.fn).not.toHaveBeenCalled();
    expect(move.fn).not.toHaveBeenCalled();

    mocked.enabledChanged(true);
    expect(key("Period").preventDefault).toHaveBeenCalled();
    expect(speed.fn).toHaveBeenCalledTimes(1);
    speed.unsubscribe();
    move.unsubscribe();
  });
});

describe("mouse bindings", () => {
  const listeners: Record<string, (event: MouseEvent) => void> = {};
  const video = {
    paused: false,
    pause: vi.fn(),
    play: vi.fn(() => Promise.resolve()),
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 450 }),
  };

  beforeEach(() => {
    vi.stubGlobal("document", {
      addEventListener: (type: string, fn: (event: MouseEvent) => void) => {
        listeners[type] = fn;
      },
      removeEventListener: () => {},
    });
    (videos as unknown as { videoSet: (v: unknown) => void }).videoSet(video);
    addMouseEventsListeners();
    mocked.middleChanged("playPause");
    video.pause.mockClear();
  });
  afterEach(() => {
    removeMouseEventsListeners();
    vi.unstubAllGlobals();
  });

  const press = (target: unknown, x = 100, y = 100) => {
    const events = ["mousedown", "mouseup", "auxclick"].map((type) => ({
      type,
      button: 1,
      clientX: x,
      clientY: y,
      target,
      composedPath: () => [target],
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }));
    for (const event of events) listeners[event.type]!(event as unknown as MouseEvent);
    return events;
  };

  it("run on the bare video and claim the whole click", () => {
    const events = press(fakeTarget({}, "VIDEO"));
    expect(video.pause).toHaveBeenCalledTimes(1);
    events.forEach((event) => expect(event.preventDefault).toHaveBeenCalled());
  });

  it("leave links over the video to the browser (#137)", () => {
    const events = press(fakeTarget({ href: "https://www.deepl.com/pro-api" }, "A"));
    expect(video.pause).not.toHaveBeenCalled();
    events.forEach((event) => expect(event.preventDefault).not.toHaveBeenCalled());
  });

  it("do nothing while the extension is disabled (#111)", () => {
    mocked.enabledChanged(false);
    const events = press(fakeTarget({}, "VIDEO"));
    expect(video.pause).not.toHaveBeenCalled();
    events.forEach((event) => expect(event.preventDefault).not.toHaveBeenCalled());
    mocked.enabledChanged(true);
    press(fakeTarget({}, "VIDEO"));
    expect(video.pause).toHaveBeenCalledTimes(1);
  });
});
