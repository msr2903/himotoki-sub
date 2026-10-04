import { describe, expect, it } from "vitest";
import { getCurrentSubs, isCueActive } from "./getCurrentSubs";

const A = { text: "A", start: 0, end: 1000 };
const B = { text: "B", start: 1000, end: 2000 };

describe("active cues are half-open intervals (#121)", () => {
  it("shows only the next cue at a shared boundary", () => {
    expect(getCurrentSubs([A, B], 1000)).toEqual([B]);
    expect(getCurrentSubs([A, B], 999)).toEqual([A]);
    expect(getCurrentSubs([A, B], 2000)).toEqual([]);
  });

  it("starts a cue at its exact start time", () => {
    expect(getCurrentSubs([A, B], 0)).toEqual([A]);
  });

  it("keeps genuine overlaps", () => {
    const C = { text: "C", start: 500, end: 1500 };
    expect(getCurrentSubs([A, C, B], 1200)).toEqual([C, B]);
    expect(getCurrentSubs([A, C, B], 700)).toEqual([A, C]);
  });

  it("ignores zero-length cues", () => {
    expect(isCueActive({ start: 1000, end: 1000 }, 1000)).toBe(false);
  });

  it("accepts the string times of raw secondary captions", () => {
    expect(getCurrentSubs([{ text: "x", start: "1000", end: "2000" }], 1000)).toHaveLength(1);
    expect(getCurrentSubs([{ text: "x", start: "0", end: "1000" }], 1000)).toHaveLength(0);
  });
});
