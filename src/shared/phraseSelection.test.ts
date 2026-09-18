import { describe, it, expect } from "vitest";
import { clampRange, isIndexSelected, rangeLength, joinItems } from "./phraseSelection";

describe("clampRange", () => {
  it("orders anchor/extent regardless of direction", () => {
    expect(clampRange(3, 1, 10)).toEqual({ start: 1, end: 3 });
    expect(clampRange(1, 3, 10)).toEqual({ start: 1, end: 3 });
  });

  it("clamps to the item list bounds", () => {
    expect(clampRange(-2, 99, 5)).toEqual({ start: 0, end: 4 });
  });
});

describe("isIndexSelected", () => {
  it("is false for a null range", () => {
    expect(isIndexSelected(null, 0)).toBe(false);
  });

  it("includes endpoints", () => {
    const r = { start: 1, end: 3 };
    expect([0, 1, 2, 3, 4].map((i) => isIndexSelected(r, i))).toEqual([false, true, true, true, false]);
  });
});

describe("rangeLength", () => {
  it("counts inclusive length", () => {
    expect(rangeLength({ start: 2, end: 2 })).toBe(1);
    expect(rangeLength({ start: 1, end: 3 })).toBe(3);
  });
});

describe("joinItems", () => {
  const items = [
    { type: "word", text: "朝" },
    { type: "word", text: "ご飯" },
    { type: "space", text: " " },
    { type: "word", text: "を" },
    { type: "word", text: "食べる", cleanedText: "食べる" },
  ] as any[];

  it("concatenates word surfaces in range", () => {
    expect(joinItems(items, { start: 0, end: 1 })).toBe("朝ご飯");
  });

  it("collapses spaces/newlines and trims", () => {
    expect(joinItems(items, { start: 0, end: 4 })).toBe("朝ご飯 を食べる");
  });

  it("prefers cleanedText when present", () => {
    expect(joinItems(items, { start: 4, end: 4 })).toBe("食べる");
  });
});
