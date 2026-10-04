import { describe, expect, it } from "vitest";
import type { TSub } from "../types";
import { autoPauseStep, rebindLoopedCue, type TAutoPauseTrack } from "./cuePlayback";

const sub = (id: number, start: number, end: number, text = `line ${id}`): TSub => ({
  id,
  start,
  end,
  text,
  cleanedText: text,
  items: [],
});

describe("rebindLoopedCue (#130)", () => {
  it("keeps no loop when none is active", () => {
    expect(rebindLoopedCue(null, [sub(0, 0, 1000)])).toBeNull();
  });

  it("keeps the same reference when the line is unchanged (re-split pass)", () => {
    const looped = sub(1, 1000, 2000);
    expect(rebindLoopedCue(looped, [sub(0, 0, 900), sub(1, 1000, 2000)])).toBe(looped);
  });

  it("follows the same line to its new timing after a delay resync", () => {
    const looped = sub(1, 1000, 2000);
    expect(rebindLoopedCue(looped, [sub(0, 500, 1400), sub(1, 1500, 2500)])).toMatchObject({ start: 1500, end: 2500 });
  });

  it("stops looping when replacement captions no longer contain the line", () => {
    const looped = sub(0, 1000, 2000, "古い字幕");
    expect(rebindLoopedCue(looped, [sub(0, 10000, 11000, "新しい字幕")])).toBeNull();
    expect(rebindLoopedCue(looped, [])).toBeNull();
  });
});

type TNow = Parameters<typeof autoPauseStep>[1];
const run = (updates: Array<Partial<TNow> & { time: number; end: number | null }>) => {
  let track: TAutoPauseTrack | null = null;
  const pauses: number[] = [];
  for (const update of updates) {
    const result = autoPauseStep(track, { rate: 1, seeking: false, active: true, ...update });
    track = result.track;
    if (result.pause) pauses.push(update.time);
  }
  return pauses;
};

describe("autoPauseStep (#131)", () => {
  it("pauses inside the lead window before the end", () => {
    expect(run([{ time: 3500, end: 4000 }, { time: 3800, end: 4000 }])).toEqual([3800]);
  });

  it("pauses when updates skip the lead window (exact 250 ms and 0 ms left)", () => {
    expect(run([{ time: 3500, end: 4000 }, { time: 3750, end: 4000 }, { time: 4000, end: 4000 }])).toEqual([4000]);
  });

  it("pauses when a sparse update lands past the end and the reading already moved on", () => {
    expect(run([{ time: 3600, end: 4000 }, { time: 4300, end: null }])).toEqual([4300]);
    // Adjacent cue: the fresh reading is the next line.
    expect(run([{ time: 3600, end: 4000 }, { time: 4300, end: 6000 }])).toEqual([4300]);
  });

  it("pauses when the reading lags one update behind the clock", () => {
    expect(run([{ time: 3600, end: null }, { time: 4300, end: 4000 }])).toEqual([4300]);
  });

  it("does not pause again for the same line after resuming", () => {
    expect(run([{ time: 3600, end: 4000 }, { time: 3850, end: 4000 }, { time: 4100, end: 4000 }, { time: 4350, end: 6000 }])).toEqual([
      3850,
    ]);
  });

  it("allows a larger step at higher speed", () => {
    expect(run([{ time: 2500, end: 4000, rate: 2 }, { time: 4600, end: null, rate: 2 }])).toEqual([4600]);
    expect(run([{ time: 2500, end: 4000 }, { time: 4600, end: null }])).toEqual([]);
  });

  it("never pauses on a seek across the end", () => {
    expect(run([{ time: 3600, end: 4000 }, { time: 60000, end: null }])).toEqual([]);
    expect(run([{ time: 3600, end: 4000 }, { time: 4100, end: null, seeking: true }])).toEqual([]);
  });

  it("pauses at the same line again after seeking back to replay it", () => {
    expect(
      run([
        { time: 3850, end: 4000 },
        { time: 1000, end: 4000 },
        { time: 3600, end: 4000, rate: 4 },
        { time: 4100, end: 4000, rate: 4 },
      ]),
    ).toEqual([3850, 4100]);
  });

  it("stays quiet while inactive (paused, looping, disabled) but keeps tracking", () => {
    expect(run([{ time: 3600, end: 4000, active: false }, { time: 4100, end: 4000, active: false }])).toEqual([]);
  });
});
