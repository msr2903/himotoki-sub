import { describe, expect, it } from "vitest";

import { himotokiEntryToWordTranslation, isPunctuationSurface } from "./himotokiTypes";

describe("isPunctuationSurface", () => {
  it("is true for Japanese and ASCII punctuation and whitespace", () => {
    expect(isPunctuationSurface("。")).toBe(true);
    expect(isPunctuationSurface("、")).toBe(true);
    expect(isPunctuationSurface("！？")).toBe(true);
    expect(isPunctuationSurface("「」")).toBe(true);
    expect(isPunctuationSurface("…")).toBe(true);
    expect(isPunctuationSurface("　")).toBe(true);
    expect(isPunctuationSurface("...")).toBe(true);
  });

  it("is false for words, including ones ending in punctuation", () => {
    expect(isPunctuationSurface("食べる")).toBe(false);
    expect(isPunctuationSurface("すき")).toBe(false);
    expect(isPunctuationSurface("そう。")).toBe(false);
    expect(isPunctuationSurface("")).toBe(false);
  });
});

const posOf = (pos: string[]) =>
  himotokiEntryToWordTranslation({ senses: [{ pos, glosses: ["g"] }] }, "test").translations[0]!
    .partOfSpeech;

describe("mapPos whole-tag matching (#74)", () => {
  it("labels adverbs as adverb, not verb", () => {
    expect(posOf(["adv"])).toBe("adverb");
    expect(posOf(["adv", "adv-to"])).toBe("adverb");
  });

  it("labels interjections and conjunctions, not noun", () => {
    expect(posOf(["int"])).toBe("interjection");
    expect(posOf(["conj"])).toBe("conjunction");
  });

  it("still labels real verbs and nouns", () => {
    expect(posOf(["v5r"])).toBe("verb");
    expect(posOf(["v1"])).toBe("verb");
    expect(posOf(["vs-i"])).toBe("verb");
    expect(posOf(["n"])).toBe("noun");
    expect(posOf(["adj-i"])).toBe("adjective");
    expect(posOf(["prt"])).toBe("particle");
  });

  it("prefers verb for suru-able nouns", () => {
    expect(posOf(["n", "vs"])).toBe("verb");
  });
});
