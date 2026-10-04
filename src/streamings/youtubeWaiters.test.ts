import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@src/models/subs", () => ({ esSubsChanged: vi.fn() }));
vi.mock("@src/models/settings", () => ({ esRenderSetings: vi.fn() }));

import Youtube from "./youtube";

type Internals = {
  captionsDataWaiters: Map<string, unknown[]>;
  requestPlayerTrack(videoId: string, languageCode: string, timeoutMs?: number): Promise<string | null>;
  handleCaptionsData(event: CustomEvent): void;
  ensureVideoCache(videoId: string): void;
};

const tokenUrl = (lang: string, v = "vid1") => `https://www.youtube.com/api/timedtext?v=${v}&lang=${lang}&pot=token`;

let yt: Internals;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", {
    location: { href: "https://www.youtube.com/watch?v=vid1" },
    dispatchEvent: () => true,
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: number) => clearTimeout(id),
    setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
    clearInterval: (id: number) => clearInterval(id),
  });
  yt = new Youtube() as unknown as Internals;
  yt.ensureVideoCache("vid1");
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("YouTube caption-track waiters (#136)", () => {
  it("drops each waiter when it times out", async () => {
    for (let i = 0; i < 25; i++) {
      const pending = yt.requestPlayerTrack("vid1", "ja", 100);
      vi.advanceTimersByTime(100);
      expect(await pending).toBeNull();
    }
    expect(yt.captionsDataWaiters.get("ja")?.length ?? 0).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a timeout leaves a concurrent live request waiting, and delivery resolves it", async () => {
    const short = yt.requestPlayerTrack("vid1", "ja", 100);
    const long = yt.requestPlayerTrack("vid1", "ja", 5000);
    vi.advanceTimersByTime(100);
    expect(await short).toBeNull();
    expect(yt.captionsDataWaiters.get("ja")).toHaveLength(1);

    yt.handleCaptionsData(new CustomEvent("esYoutubeCaptionsData", { detail: tokenUrl("ja") }));
    expect(await long).toBe(tokenUrl("ja"));
    expect(yt.captionsDataWaiters.has("ja")).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("settles and drops the previous video's waiters when the video changes", async () => {
    const pending = yt.requestPlayerTrack("vid1", "ja", 8000);
    yt.ensureVideoCache("vid2");
    expect(await pending).toBeNull();
    expect(yt.captionsDataWaiters.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
