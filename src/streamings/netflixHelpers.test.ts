import { describe, it, expect } from "vitest";
import { primaryTrackKey, adBreakDurationMs } from "./netflixHelpers";

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
