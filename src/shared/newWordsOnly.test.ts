import { describe, expect, it } from "vitest";
import { glossaryGloss, isJapaneseToken, isNewWord, isNewWordsLevel, pickGlossary } from "./newWordsOnly";

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

describe("pickGlossary", () => {
  const w = (id: string, jlpt?: string, frequency?: number) => ({ id, jlpt: jlpt ? [jlpt] : undefined, frequency });

  it("keeps short lists as they are", () => {
    const words = [w("a", "n2"), w("b", "n1")];
    expect(pickGlossary(words)).toEqual({ shown: words, more: 0 });
  });

  it("keeps the hardest words in line order and counts the rest", () => {
    const words = [w("n2", "n2"), w("rare", undefined, 40000), w("n1", "n1"), w("n2b", "n2"), w("rarer", undefined, 90000)];
    const { shown, more } = pickGlossary(words);
    expect(shown.map((x) => x.id)).toEqual(["rare", "n1", "rarer"]);
    expect(more).toBe(2);
  });
});

describe("glossaryGloss", () => {
  it("joins meanings that fit and truncates a long first one", () => {
    expect(glossaryGloss("after all; as expected; also")).toBe("after all; as expected; also");
    expect(glossaryGloss("after all; as expected; in the end; still; nevertheless")).toBe("after all; as expected; in the end");
    expect(glossaryGloss("a".repeat(50))).toBe(`${"a".repeat(39)}…`);
    expect(glossaryGloss("")).toBe("");
  });
});
