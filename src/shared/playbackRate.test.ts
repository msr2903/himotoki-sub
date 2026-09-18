import { describe, it, expect } from "vitest";
import { clampRate, stepRate, PLAYBACK_RATE_MIN, PLAYBACK_RATE_MAX } from "./playbackRate";

describe("clampRate", () => {
  it("clamps below min and above max", () => {
    expect(clampRate(0.1)).toBe(PLAYBACK_RATE_MIN);
    expect(clampRate(5)).toBe(PLAYBACK_RATE_MAX);
  });

  it("rounds to the nearest step", () => {
    expect(clampRate(1.1)).toBe(1);
    expect(clampRate(1.2)).toBe(1.25);
  });

  it("avoids floating point drift", () => {
    expect(clampRate(1.75)).toBe(1.75);
  });

  it("falls back to default on NaN", () => {
    expect(clampRate(NaN)).toBe(1);
  });
});

describe("stepRate", () => {
  it("steps up and down by the delta, clamped", () => {
    expect(stepRate(1, 0.25)).toBe(1.25);
    expect(stepRate(1, -0.25)).toBe(0.75);
    expect(stepRate(PLAYBACK_RATE_MAX, 0.25)).toBe(PLAYBACK_RATE_MAX);
    expect(stepRate(PLAYBACK_RATE_MIN, -0.25)).toBe(PLAYBACK_RATE_MIN);
  });
});
