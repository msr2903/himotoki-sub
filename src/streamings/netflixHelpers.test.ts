import { describe, it, expect } from "vitest";
import { primaryTrackKey, adBreakDurationMs, resyncSubsWithAdBreaks } from "./netflixHelpers";

describe("primaryTrackKey", () => {
  it("matches language ('ja') and bcp47 ('ja-JP') to the same primary key", () => {
    expect(primaryTrackKey("ja")).toEqual(primaryTrackKey("ja-JP"));
    expect(primaryTrackKey("ja-JP")).toEqual({ lang: "ja", postfix: "" });
  });

  it("preserves the [cc] and -forced postfixes", () => {
    expect(primaryTrackKey("ja[cc]")).toEqual({ lang: "ja", postfix: "[cc]" });
    expect(primaryTrackKey("ja-JP[cc]")).toEqual({ lang: "ja", postfix: "[cc]" });
    expect(primaryTrackKey("ja-forced")).toEqual({ lang: "ja", postfix: "-forced" });
  });

  it("keeps distinct languages distinct", () => {
    expect(primaryTrackKey("en-US")).not.toEqual(primaryTrackKey("ja-JP"));
  });
});

describe("adBreakDurationMs", () => {
  it("sums each ad's own length (end - start), not absolute end timestamps", () => {
    expect(adBreakDurationMs([{ startTimeMs: 30000, endTimeMs: 45000 }])).toBe(15000);
    expect(
      adBreakDurationMs([
        { startTimeMs: 30000, endTimeMs: 45000 },
        { startTimeMs: 45000, endTimeMs: 50000 },
      ]),
    ).toBe(20000);
  });

  it("is 0 for no ads", () => {
    expect(adBreakDurationMs([])).toBe(0);
  });
});

describe("resyncSubsWithAdBreaks (#54)", () => {
  const cue = (start: number, end: number) => ({ start, end, text: "x", type: "caption" as const });

  it("shifts cues by every break before them, cumulatively", () => {
    // Breaks at 10:00 (30 s) and 25:00 (45 s).
    const breaks = [
      { locationMs: 600_000, durationMs: 30_000 },
      { locationMs: 1_500_000, durationMs: 45_000 },
    ];
    const subs = [cue(0, 500_000), cue(700_000, 800_000), cue(1_600_000, 1_700_000)];
    const out = resyncSubsWithAdBreaks(subs, breaks);
    expect(out[0]).toMatchObject({ start: 0, end: 500_000 }); // before both breaks
    expect(out[1]).toMatchObject({ start: 730_000, end: 830_000 }); // after first: +30 s
    expect(out[2]).toMatchObject({ start: 1_675_000, end: 1_775_000 }); // after both: +75 s
  });

  it("leaves the list unchanged when there are no breaks", () => {
    const subs = [cue(0, 1000)];
    expect(resyncSubsWithAdBreaks(subs, [])).toEqual(subs);
  });
});
