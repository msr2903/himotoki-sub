import { describe, expect, it } from "vitest";

import { isPunctuationSurface } from "./himotokiTypes";

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
