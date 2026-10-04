import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { captureCueAudio } from "./mediaCapture";

/**
 * Deterministic doubles for the media APIs the capture uses: a video whose media time advances on
 * the fake clock while playing (and not buffering), a MediaRecorder that emits one chunk on stop,
 * and a FileReader that base64-encodes instantly. Events are dispatched asynchronously like media
 * element tasks.
 */
type FakeTrack = { kind: string; stop: ReturnType<typeof vi.fn> };

class FakeVideo extends EventTarget {
  private time: number;
  private rate: number;
  paused: boolean;
  seeking = false;
  ended = false;
  buffering = false;
  seekDelayMs = 20;
  playResult: "ok" | "reject" | "hang" = "ok";
  tracks: FakeTrack[] = [];
  captures = 0;
  private ticker: ReturnType<typeof setInterval>;

  constructor(time: number, rate: number, paused: boolean) {
    super();
    this.time = time;
    this.rate = rate;
    this.paused = paused;
    this.ticker = setInterval(() => {
      if (!this.paused && !this.seeking && !this.buffering) this.time += 0.01 * this.rate;
    }, 10);
  }

  dispose() {
    clearInterval(this.ticker);
  }

  private fire(type: string) {
    setTimeout(() => this.dispatchEvent(new Event(type)), 0);
  }

  get currentTime() {
    return this.time;
  }
  set currentTime(t: number) {
    this.time = t;
    this.seeking = true;
    this.fire("seeking");
    setTimeout(() => {
      this.seeking = false;
      this.dispatchEvent(new Event("seeked"));
    }, this.seekDelayMs);
  }

  get playbackRate() {
    return this.rate;
  }
  set playbackRate(r: number) {
    if (r === this.rate) return;
    this.rate = r;
    this.fire("ratechange");
  }

  play() {
    if (this.playResult === "reject") return Promise.reject(new Error("NotAllowedError"));
    if (this.playResult === "hang") return new Promise<void>(() => {});
    if (this.paused) {
      this.paused = false;
      this.fire("play");
    }
    return Promise.resolve();
  }

  pause() {
    if (!this.paused) {
      this.paused = true;
      this.fire("pause");
    }
  }

  captureStream() {
    this.captures++;
    const audio: FakeTrack = { kind: "audio", stop: vi.fn() };
    const video: FakeTrack = { kind: "video", stop: vi.fn() };
    this.tracks.push(audio, video);
    return {
      getAudioTracks: () => [audio],
      getTracks: () => [audio, video],
    };
  }
}

class FakeMediaRecorder {
  static isTypeSupported = () => true;
  static instances: FakeMediaRecorder[] = [];
  state: "inactive" | "recording" = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor() {
    FakeMediaRecorder.instances.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    if (this.state === "inactive") return;
    this.state = "inactive";
    setTimeout(() => {
      this.ondataavailable?.({ data: new Blob(["audio"]) });
      this.onstop?.();
    }, 0);
  }
}

class FakeFileReader {
  result: string | null = null;
  error: unknown = null;
  onloadend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL() {
    setTimeout(() => {
      this.result = "data:audio/webm;base64,QVVESU8=";
      this.onloadend?.();
    }, 0);
  }
}

let videos: FakeVideo[] = [];
const makeVideo = (time: number, rate: number, paused: boolean) => {
  const v = new FakeVideo(time, rate, paused);
  videos.push(v);
  return v;
};
const capture = (v: FakeVideo, start: number, end: number) =>
  captureCueAudio(v as unknown as HTMLVideoElement, start, end, "clip");

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  vi.stubGlobal("MediaStream", class {});
  vi.stubGlobal("FileReader", FakeFileReader);
  FakeMediaRecorder.instances = [];
});

afterEach(async () => {
  // Drain the capture queue's settle step on the fake clock before it is discarded.
  await vi.advanceTimersByTimeAsync(5000);
  videos.forEach((v) => v.dispose());
  videos = [];
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("captureCueAudio", () => {
  it("records the cue at 1x and restores position, speed and paused state", async () => {
    const v = makeVideo(40, 1.25, true);
    const result = capture(v, 10, 12);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(result).resolves.toEqual({ filename: "clip.webm", dataBase64: "QVVESU8=" });
    expect(v.currentTime).toBeCloseTo(40, 1);
    expect(v.playbackRate).toBe(1.25);
    expect(v.paused).toBe(true);
  });

  it("stops at media time, not wall time, when playback buffers (#126)", async () => {
    const v = makeVideo(40, 1, true);
    const result = capture(v, 10, 12);
    await vi.advanceTimersByTimeAsync(100);
    v.buffering = true;
    await vi.advanceTimersByTimeAsync(2500);
    // Wall time already exceeds the 2 s cue, but media time has not reached its end.
    expect(FakeMediaRecorder.instances[0]!.state).toBe("recording");
    v.buffering = false;
    await vi.advanceTimersByTimeAsync(2500);
    await expect(result).resolves.not.toBeNull();
  });

  it("omits audio when playback stalls past the safety deadline", async () => {
    const v = makeVideo(40, 1, true);
    const result = capture(v, 10, 12);
    await vi.advanceTimersByTimeAsync(100);
    v.buffering = true;
    await vi.advanceTimersByTimeAsync(10000);
    await expect(result).resolves.toBeNull();
    expect(v.currentTime).toBeCloseTo(40, 1);
    expect(v.paused).toBe(true);
  });

  it("waits for a slow seek before recording", async () => {
    const v = makeVideo(40, 1, true);
    v.seekDelayMs = 1500;
    const result = capture(v, 10, 12);
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeMediaRecorder.instances[0]!.state).toBe("inactive");
    await vi.advanceTimersByTimeAsync(4000);
    await expect(result).resolves.not.toBeNull();
  });

  it("omits audio when play() is rejected or never starts, and restores the player", async () => {
    for (const playResult of ["reject", "hang"] as const) {
      const v = makeVideo(40, 1.5, true);
      v.playResult = playResult;
      const result = capture(v, 10, 12);
      await vi.advanceTimersByTimeAsync(6000);
      await expect(result).resolves.toBeNull();
      expect(v.currentTime).toBeCloseTo(40, 1);
      expect(v.playbackRate).toBe(1.5);
      expect(FakeMediaRecorder.instances.at(-1)!.state).toBe("inactive");
    }
  });

  it("caps the clip at 15 seconds of media time", async () => {
    const v = makeVideo(40, 1, true);
    const result = capture(v, 10, 60);
    await vi.advanceTimersByTimeAsync(14000);
    expect(FakeMediaRecorder.instances[0]!.state).toBe("recording");
    await vi.advanceTimersByTimeAsync(2000);
    expect(FakeMediaRecorder.instances[0]!.state).toBe("inactive");
    await expect(result).resolves.not.toBeNull();
  });

  it("keeps a user seek, speed change and play made during the capture (#115)", async () => {
    const v = makeVideo(40, 1.25, true);
    const result = capture(v, 10, 12);
    await vi.advanceTimersByTimeAsync(500);
    v.currentTime = 100;
    v.playbackRate = 1.75;
    void v.play();
    await vi.advanceTimersByTimeAsync(3000);
    await expect(result).resolves.toBeNull();
    expect(v.currentTime).toBeGreaterThanOrEqual(100);
    expect(v.playbackRate).toBe(1.75);
    expect(v.paused).toBe(false);
  });

  it("keeps a user pause but still restores position and speed", async () => {
    const v = makeVideo(40, 1.25, false);
    const result = capture(v, 10, 12);
    await vi.advanceTimersByTimeAsync(500);
    v.pause();
    await vi.advanceTimersByTimeAsync(3000);
    await expect(result).resolves.toBeNull();
    expect(v.paused).toBe(true);
    expect(v.currentTime).toBeCloseTo(40, 1);
    expect(v.playbackRate).toBe(1.25);
  });

  it("treats an auto-pause right at the cue end as a complete clip", async () => {
    const v = makeVideo(40, 1, false);
    const result = capture(v, 10, 12);
    const autoPause = setInterval(() => {
      if (!v.paused && v.currentTime >= 11.76) v.pause();
    }, 10);
    await vi.advanceTimersByTimeAsync(3000);
    clearInterval(autoPause);
    await expect(result).resolves.not.toBeNull();
  });

  it("serializes overlapping captures so the original state is restored (#115)", async () => {
    const v = makeVideo(40, 1.25, true);
    const first = capture(v, 10, 12);
    await vi.advanceTimersByTimeAsync(500);
    const second = capture(v, 20, 22);
    await vi.advanceTimersByTimeAsync(8000);
    await expect(first).resolves.not.toBeNull();
    await expect(second).resolves.not.toBeNull();
    expect(v.currentTime).toBeCloseTo(40, 1);
    expect(v.playbackRate).toBe(1.25);
    expect(v.paused).toBe(true);
  });

  it("stops every captured track on success, failure and no-audio streams (#125)", async () => {
    const ok = makeVideo(40, 1, true);
    const r1 = capture(ok, 10, 12);
    const r2 = capture(ok, 10, 12);
    await vi.advanceTimersByTimeAsync(10000);
    await r1;
    await r2;
    expect(ok.captures).toBe(2);
    expect(ok.tracks.every((t) => t.stop.mock.calls.length === 1)).toBe(true);

    const failing = makeVideo(40, 1, true);
    failing.playResult = "reject";
    const r3 = capture(failing, 10, 12);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(r3).resolves.toBeNull();
    expect(failing.tracks.every((t) => t.stop.mock.calls.length === 1)).toBe(true);

    const silent = makeVideo(40, 1, true);
    const videoTrack: FakeTrack = { kind: "video", stop: vi.fn() };
    silent.captureStream = () => ({ getAudioTracks: () => [], getTracks: () => [videoTrack] }) as never;
    await expect(capture(silent, 10, 12)).resolves.toBeNull();
    expect(videoTrack.stop).toHaveBeenCalledTimes(1);
  });
});
