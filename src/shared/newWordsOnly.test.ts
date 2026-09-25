import { describe, expect, it } from "vitest";
import { isJapaneseToken, isNewWord, isNewWordsLevel } from "./newWordsOnly";

describe("isNewWord", () => {
  it("shows everything when off", () => {
    expect(isNewWord({ jlpt: ["n5"] }, "off")).toBe(true);
  });

  it("shows JLPT words harder than the learner's level", () => {
    expect(isNewWord({ jlpt: ["n4"] }, "n3")).toBe(false);
    expect(isNewWord({ jlpt: ["n3"] }, "n3")).toBe(false);
    expect(isNewWord({ jlpt: ["n2"] }, "n3")).toBe(true);
    expect(isNewWord({ jlpt: ["n1"] }, "n2")).toBe(true);
    expect(isNewWord({ jlpt: ["n1"] }, "n1")).toBe(false);
  });

  it("uses the easiest listing when a word has several", () => {
    expect(isNewWord({ jlpt: ["n1", "n4"] }, "n3")).toBe(false);
  });

  it("shows unlisted words only when rare for the level", () => {
    expect(isNewWord({ frequency: 3000 }, "n3")).toBe(false);
    expect(isNewWord({ frequency: 8000 }, "n3")).toBe(true);
    expect(isNewWord({ frequency: 8000 }, "n2")).toBe(false);
    expect(isNewWord({ frequency: 25000 }, "n1")).toBe(true);
  });

  it("shows words with no difficulty data", () => {
    expect(isNewWord({}, "n2")).toBe(true);
  });
});

describe("isNewWordsLevel", () => {
  it("accepts only off and N3–N1", () => {
    expect(["off", "n3", "n2", "n1"].every(isNewWordsLevel)).toBe(true);
    expect(isNewWordsLevel("n4")).toBe(false);
    expect(isNewWordsLevel("n5")).toBe(false);
  });
});

describe("isJapaneseToken", () => {
  it("tells Japanese words from English asides and punctuation", () => {
    expect(isJapaneseToken("邂逅")).toBe(true);
    expect(isJapaneseToken("かぶります")).toBe(true);
    expect(isJapaneseToken("カメラ")).toBe(true);
    expect(isJapaneseToken("When you hear them,")).toBe(false);
    expect(isJapaneseToken("。")).toBe(false);
    expect(isJapaneseToken("2024")).toBe(false);
  });
});
