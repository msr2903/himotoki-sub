import { describe, it, expect } from "vitest";
import { addToHistory, historyItemFromTranslation, TLookupHistoryItem } from "./lookupHistory";

const item = (key: string, ts = 1): TLookupHistoryItem => ({ key, headword: key, source: key, ts });

describe("addToHistory", () => {
  it("prepends a new item", () => {
    expect(addToHistory([item("a")], item("b")).map((h) => h.key)).toEqual(["b", "a"]);
  });

  it("moves an existing key to the front (dedupe)", () => {
    const list = [item("a"), item("b"), item("c")];
    expect(addToHistory(list, item("c")).map((h) => h.key)).toEqual(["c", "a", "b"]);
    expect(addToHistory(list, item("c")).length).toBe(3);
  });

  it("caps the length, keeping the most recent", () => {
    const list = [item("b"), item("c")];
    expect(addToHistory(list, item("a"), 2).map((h) => h.key)).toEqual(["a", "b"]);
  });
});

describe("historyItemFromTranslation", () => {
  const tx = { source: "顔", headword: "顔", reading: "かお", mainTranslation: "face", translations: [], error: null } as any;

  it("returns null on an error translation", () => {
    expect(historyItemFromTranslation({ ...tx, error: "boom" })).toBeNull();
    expect(historyItemFromTranslation(null)).toBeNull();
  });

  it("maps headword, reading, gloss and video time", () => {
    const h = historyItemFromTranslation(tx, 12000, "My Video");
    expect(h?.headword).toBe("顔");
    expect(h?.reading).toBe("かお");
    expect(h?.gloss).toBe("face");
    expect(h?.videoTimeMs).toBe(12000);
    expect(h?.videoTitle).toBe("My Video");
  });

  it("falls back to the first sense gloss and source headword", () => {
    const h = historyItemFromTranslation({ source: "走る", translations: [{ word: "to run" }], error: null } as any);
    expect(h?.headword).toBe("走る");
    expect(h?.gloss).toBe("to run");
  });

  it("omits reading when it equals the headword", () => {
    const h = historyItemFromTranslation({ source: "ねこ", headword: "ねこ", reading: "ねこ", mainTranslation: "cat", translations: [], error: null } as any);
    expect(h?.reading).toBeUndefined();
  });
});
