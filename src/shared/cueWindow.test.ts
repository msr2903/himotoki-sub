import { describe, expect, it } from "vitest";
import { cuesInWindow, indexCues, markerGeometry, timeAtPointer } from "./cueWindow";

// Interval overlap over the whole track: what ProgressBar must show each frame.
const bruteForce = (cues: Array<{ start: number; end: number }>, from: number, to: number) =>
  cues.filter((c) => c.end > from && c.start < to);

describe("cuesInWindow (#151)", () => {
  it("matches the full scan on random tracks and windows", () => {
    let seed = 7;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    for (let round = 0; round < 50; round++) {
      const cues = Array.from({ length: 200 }, () => {
        const start = Math.round(rand() * 600000);
        return { start, end: start + Math.round(rand() * 20000) };
      });
      const index = indexCues(cues);
      for (let q = 0; q < 20; q++) {
        const time = Math.round(rand() * 620000);
        const expected = bruteForce(cues, time - 15000, time + 15000).sort((a, b) => a.start - b.start);
        expect(cuesInWindow(index, time - 15000, time + 15000)).toEqual(expected);
      }
    }
  });

  it("keeps an ordered track as-is and only visits nearby cues", () => {
    const cues = Array.from({ length: 10000 }, (_, i) => ({ start: i * 3000, end: i * 3000 + 2000 }));
    const index = indexCues(cues);
    expect(index.sorted).toBe(cues);
    const visible = cuesInWindow(index, 300000 - 15000, 300000 + 15000);
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.length).toBeLessThanOrEqual(11);
  });

  it("handles empty tracks", () => {
    expect(cuesInWindow(indexCues([]), 0, 30000)).toEqual([]);
  });
});

describe("cuesInWindow overlap policy (#152)", () => {
  const index = indexCues([
    { start: 0, end: 60000 }, // spans the whole 15–45 s window
    { start: 10000, end: 20000 }, // partially overlaps the left edge
    { start: 40000, end: 50000 }, // partially overlaps the right edge
    { start: 5000, end: 15000 }, // ends exactly at the left edge: outside
    { start: 45000, end: 47000 }, // starts exactly at the right edge: outside
    { start: 50000, end: 52000 }, // outside
  ]);

  it("includes spanning and partially overlapping cues, excludes adjacent and outside ones", () => {
    expect(cuesInWindow(index, 15000, 45000)).toEqual([
      { start: 0, end: 60000 },
      { start: 10000, end: 20000 },
      { start: 40000, end: 50000 },
    ]);
  });

  it("clips a spanning cue's marker to the window", () => {
    expect(markerGeometry({ start: 0, end: 60000 }, 15000, 30000, 1000)).toEqual({ x: 0, width: 1000 });
    expect(markerGeometry({ start: 10000, end: 20000 }, 15000, 30000, 1000)).toEqual({
      x: 0,
      width: expect.closeTo(166.67, 1),
    });
    const inside = markerGeometry({ start: 25000, end: 27000 }, 15000, 30000, 1000);
    expect(inside.x).toBeCloseTo(333.33, 1);
    expect(inside.width).toBeCloseTo(66.67, 1);
  });
});

describe("timeAtPointer (#150)", () => {
  // At 30 s a 1000 px timeline shows 15–45 s; a cue starting at 25 s sits 333 px from the left.
  const rect = { left: 100, width: 1000 };

  it("maps the pointer through the timeline's rectangle, whatever element was clicked", () => {
    // 20 px inside the 25 s cue marker: 353 px into the timeline.
    expect(timeAtPointer(100 + 353, rect, 15000, 30000)).toBeCloseTo(25590, 0);
  });

  it("clamps to the visible window and rejects a zero-width timeline", () => {
    expect(timeAtPointer(0, rect, 15000, 30000)).toBe(15000);
    expect(timeAtPointer(5000, rect, 15000, 30000)).toBe(45000);
    expect(timeAtPointer(200, { left: 0, width: 0 }, 15000, 30000)).toBeNull();
  });
});
