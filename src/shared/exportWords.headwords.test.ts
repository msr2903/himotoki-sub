import { describe, expect, it } from "vitest";

import { knownKeyOf } from "./knownWords";
import {
  UNRESOLVED_HEADWORD_NOTE,
  buildRows,
  headwordsBySeqKey,
  headwordsFromHistory,
  seqsToResolve,
  toCsv,
  toJson,
} from "./exportWords";
import { himotokiEntryToWordTranslation } from "@src/utils/himotokiTypes";

const neko = himotokiEntryToWordTranslation(
  { source: "jitendex", seq: 1467640, kanji: ["猫"], readings: ["ねこ"], senses: [{ pos: ["n"], glosses: ["cat"] }] },
  "猫",
);
const nekoKey = knownKeyOf(neko)!;

describe("saved-word export headwords (#117)", () => {
  it("dictionary words are stored by sequence key", () => {
    expect(nekoKey).toBe("seq:jitendex:1467640");
  });

  it("asks the dictionary only for unresolved local-dictionary sequence keys", () => {
    const keys = [nekoKey, "seq:jitendex:1188760", "hw:顔", "seq:other:5", "seq:jitendex:x"];
    expect(seqsToResolve(keys, {})).toEqual([1467640, 1188760]);
    expect(seqsToResolve(keys, { [nekoKey]: "猫" })).toEqual([1188760]);
  });

  it("uses the lookup history as an offline headword source", () => {
    const history = [
      { key: nekoKey, headword: "猫", source: "猫", ts: 2 },
      { key: nekoKey, headword: "", source: "猫", ts: 1 },
      { bogus: true },
      null,
    ];
    expect(headwordsFromHistory(history)).toEqual({ [nekoKey]: "猫" });
  });

  it("exports resolved headwords for a mix of sequence and fallback keys", () => {
    const headwords = { ...headwordsBySeqKey({ "1467640": "猫", "1188760": "いつ", "9": "" }) };
    const rows = buildRows([nekoKey, "hw:顔"], { "seq:jitendex:1188760": "learning", "seq:jitendex:42": "ignored" }, headwords);
    expect(rows.map((r) => [r.key, r.headword, r.status, r.note])).toEqual([
      [nekoKey, "猫", "known", ""],
      ["hw:顔", "顔", "known", ""],
      ["seq:jitendex:1188760", "いつ", "learning", ""],
      ["seq:jitendex:42", "", "ignored", UNRESOLVED_HEADWORD_NOTE],
    ]);
    const csv = toCsv(rows);
    expect(csv.split("\n")[1]).toBe("seq:jitendex:1467640,猫,jitendex,1467640,known,");
    expect(JSON.parse(toJson(rows))[0].headword).toBe("猫");
  });

  it("explains rows that stay unresolved when the dictionary is missing", () => {
    const rows = buildRows([nekoKey], {});
    expect(rows[0]!.headword).toBe("");
    expect(rows[0]!.note).toBe(UNRESOLVED_HEADWORD_NOTE);
  });
});
