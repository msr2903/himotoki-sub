import { describe, expect, it } from "vitest";

import { furiganaSegments, hasKanji, shortGloss, surfaceReading } from "./furigana";

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
  it("uses the こ-stem for 来る's volitional/causative/passive/classical forms (#63)", () => {
    expect(surfaceReading("来よう", "来る", "くる")).toBe("こよう");
    expect(surfaceReading("来させる", "来る", "くる")).toBe("こさせる");
    expect(surfaceReading("来られる", "来る", "くる")).toBe("こられる");
    expect(surfaceReading("来ず", "来る", "くる")).toBe("こず");
    expect(surfaceReading("来まい", "来る", "くる")).toBe("こまい");
    expect(surfaceReading("来れる", "来る", "くる")).toBe("これる");
    expect(surfaceReading("来れば", "来る", "くる")).toBe("くれば");
    expect(surfaceReading("来た", "来る", "くる")).toBe("きた");
    expect(surfaceReading("来て", "来る", "くる")).toBe("きて");
  });
  it("returns null when the surface does not contain the headword stem", () => {
    expect(surfaceReading("飲む", "食べる", "たべる")).toBeNull();
  });
});

describe("furiganaSegments", () => {
  it("keeps ruby on the kanji when its reading starts with the following okurigana (#86)", () => {
    // 言い方: the okurigana い must not swallow 言's reading.
    expect(furiganaSegments("言い方", "言い方", "いいかた")).toEqual([
      { text: "言", rt: "い" },
      { text: "い" },
      { text: "方", rt: "かた" },
    ]);
    expect(furiganaSegments("言い訳", "言い訳", "いいわけ")).toEqual([
      { text: "言", rt: "い" },
      { text: "い" },
      { text: "訳", rt: "わけ" },
    ]);
    expect(furiganaSegments("聞き取り", "聞き取り", "ききとり")).toEqual([
      { text: "聞", rt: "き" },
      { text: "き" },
      { text: "取", rt: "と" },
      { text: "り" },
    ]);
  });
  it("annotates a stem-only surface like 聞き (#86)", () => {
    expect(furiganaSegments("聞き", "聞く", "きく")).toEqual([
      { text: "聞", rt: "き" },
      { text: "き" },
    ]);
  });
  it("still aligns ordinary okurigana", () => {
    expect(furiganaSegments("食べた", "食べる", "たべる")).toEqual([
      { text: "食", rt: "た" },
      { text: "べた" },
    ]);
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
