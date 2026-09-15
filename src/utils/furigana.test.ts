import { describe, expect, it } from "vitest";

import { hasKanji, shortGloss, surfaceReading } from "./furigana";

describe("hasKanji", () => {
  it("detects kanji, iteration mark and ヶ", () => {
    expect(hasKanji("食べる")).toBe(true);
    expect(hasKanji("時々")).toBe(true);
    expect(hasKanji("一ヶ月")).toBe(true);
  });
  it("is false for kana-only and latin text", () => {
    expect(hasKanji("たべる")).toBe(false);
    expect(hasKanji("カタカナ")).toBe(false);
    expect(hasKanji("hello")).toBe(false);
  });
});

describe("surfaceReading", () => {
  it("returns null when the surface has no kanji", () => {
    expect(surfaceReading("たべる", "食べる", "たべる")).toBeNull();
  });
  it("returns null when no reading is known", () => {
    expect(surfaceReading("食べる", "食べる", undefined)).toBeNull();
  });
  it("returns the reading verbatim when surface equals headword", () => {
    expect(surfaceReading("顔", "顔", "かお")).toBe("かお");
  });
  it("aligns okurigana for a conjugated form", () => {
    // 食べる/たべる → stem 食/たべ, surface 食べた keeps its own ending た.
    expect(surfaceReading("食べた", "食べる", "たべる")).toBe("たべた");
  });
  it("refuses to annotate when the headword is kana-only", () => {
    expect(surfaceReading("何", "なに", "なに")).toBeNull();
  });
  it("handles the irregular 来る", () => {
    expect(surfaceReading("来る", "来る", "くる")).toBe("くる");
    expect(surfaceReading("来ない", "来る", "くる")).toBe("こない");
    expect(surfaceReading("来ます", "来る", "くる")).toBe("きます");
  });
  it("returns null when the surface does not contain the headword stem", () => {
    expect(surfaceReading("飲む", "食べる", "たべる")).toBeNull();
  });
});

describe("shortGloss", () => {
  it("takes the first sense and trims separators", () => {
    expect(shortGloss("face; expression; look")).toBe("face");
    expect(shortGloss("apple, fruit")).toBe("apple");
  });
  it("truncates long glosses with an ellipsis", () => {
    expect(shortGloss("a very long single gloss that keeps going", 10)).toBe("a very lo…");
  });
});
