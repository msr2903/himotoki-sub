import { describe, expect, it } from "vitest";

import { entryHeadword, entryLemma, himotokiEntryToWordTranslation, type HimotokiEntry } from "./himotokiTypes";

/** Trimmed shapes of real API rows (all flagged usually_kana by the API). */
const uk = (seq: number, kanji: string[], readings: string[], pos: string[]): HimotokiEntry => ({
  source: "jitendex",
  seq,
  common: true,
  kanji,
  readings,
  senses: [{ pos, glosses: ["gloss"] }],
  usually_kana: true,
});

const cases: Array<[string, HimotokiEntry]> = [
  ["いつ", uk(1188760, ["何時"], ["いつ"], ["pn"])],
  ["この", uk(1582920, ["此の"], ["この"], ["adj-pn"])],
  ["どこ", uk(1577140, ["何処", "何所"], ["どこ", "どっこ"], ["pn"])],
  ["まだ", uk(1527110, ["未だ"], ["まだ", "いまだ"], ["adv"])],
  ["ある", uk(1296400, ["有る", "在る"], ["ある"], ["v5r-i"])],
  ["コーヒー", uk(1036310, ["珈琲"], ["コーヒー"], ["n"])],
];

describe("usually-kana headwords (#116)", () => {
  for (const [kana, entry] of cases) {
    it(`${kana} keeps its kana headword for the popup, speech and save`, () => {
      const t = himotokiEntryToWordTranslation(entry, kana);
      expect(t.headword).toBe(kana);
      expect(t.himotokiSave?.headword).toBe(kana);
      expect(t.reading).toBe(kana);
      expect(entryLemma({ surface: kana, best: entry })).toBe(kana);
      // Kanji spellings remain available on the entry.
      expect(entry.kanji?.length).toBeGreaterThan(0);
    });
  }

  it("maps a conjugated usually-kana verb's kanji root to kana", () => {
    const entry = cases[4]![1];
    expect(
      entryLemma({ surface: "あった", best: entry, conjugation: { root_text: "有る", root_reading: "ある" } }),
    ).toBe("ある");
    expect(entryLemma({ surface: "あった", best: entry, conjugation: { root_text: "ある" } })).toBe("ある");
  });

  it("still prefers the kanji spelling for ordinary entries", () => {
    const neko: HimotokiEntry = { seq: 1467640, kanji: ["猫"], readings: ["ねこ"], senses: [{ pos: ["n"], glosses: ["cat"] }] };
    expect(entryHeadword(neko)).toBe("猫");
    expect(himotokiEntryToWordTranslation(neko, "猫").headword).toBe("猫");
    expect(entryLemma({ surface: "食べた", best: { kanji: ["食べる"], readings: ["たべる"] }, conjugation: { root_text: "食べる" } })).toBe(
      "食べる",
    );
  });

  it("falls back when the entry has no kana reading", () => {
    expect(entryHeadword({ kanji: ["何処"], usually_kana: true })).toBe("何処");
    expect(entryHeadword(null)).toBe("");
  });
});
