import { describe, expect, it } from "vitest";

import {
  HIMOTOKI_BACK_TEMPLATE,
  HIMOTOKI_CARD_CSS,
  HIMOTOKI_FRONT_TEMPLATE,
  boldKeyword,
  cardDesignHash,
  pickSentenceKeyword,
  planModelUpdate,
} from "./ankiNote";

const current = { Himotoki: { Front: HIMOTOKI_FRONT_TEMPLATE, Back: HIMOTOKI_BACK_TEMPLATE } };

describe("planModelUpdate (#124)", () => {
  it("leaves the current design alone", () => {
    expect(planModelUpdate(current, HIMOTOKI_CARD_CSS)).toEqual({ templates: false, styling: false });
  });

  it("never touches customized templates or CSS", () => {
    const custom = { Himotoki: { Front: HIMOTOKI_FRONT_TEMPLATE + "<div>{{Notes}}</div>", Back: HIMOTOKI_BACK_TEMPLATE } };
    expect(planModelUpdate(custom, HIMOTOKI_CARD_CSS + "\n.hm-word { font-size: 60px; }")).toEqual({
      templates: false,
      styling: false,
    });
    const extraCard = { ...current, Reverse: { Front: "{{Meaning}}", Back: "{{Word}}" } };
    expect(planModelUpdate(extraCard, ".card {}").templates).toBe(false);
  });

  it("ignores unreadable model content", () => {
    expect(planModelUpdate(undefined, undefined)).toEqual({ templates: false, styling: false });
    expect(planModelUpdate("x", 42)).toEqual({ templates: false, styling: false });
  });

  it("migrates the unmodified earlier built-in CSS (before the numbered senses list)", () => {
    const start = HIMOTOKI_CARD_CSS.indexOf(".hm-senses {");
    const end = HIMOTOKI_CARD_CSS.indexOf(".hm-level {");
    const previous = HIMOTOKI_CARD_CSS.slice(0, start) + HIMOTOKI_CARD_CSS.slice(end);
    expect(planModelUpdate(current, previous).styling).toBe(true);
    // Line-ending differences from Anki's storage do not count as a customization.
    expect(planModelUpdate(current, previous.replace(/\n/g, "\r\n")).styling).toBe(true);
  });

  it("pins the current design hashes", () => {
    // Changing the built-in CSS/templates? Add the old hash to PREVIOUS_BUILTIN_* in ankiNote.ts
    // so existing unmodified note types still migrate, then update these values.
    expect(cardDesignHash(HIMOTOKI_CARD_CSS)).toBe("64cfb9a7");
    expect(`${cardDesignHash(HIMOTOKI_FRONT_TEMPLATE)}:${cardDesignHash(HIMOTOKI_BACK_TEMPLATE)}`).toBe("5e929129:fe63b7ac");
  });
});

describe("pickSentenceKeyword (#157)", () => {
  it("prefers the subtitle surface over the lemma", () => {
    expect(pickSentenceKeyword("朝ご飯を食べた。", ["食べた", "食べる"])).toBe("食べた");
    expect(pickSentenceKeyword("寒かった。", ["寒かった", "寒い"])).toBe("寒かった");
  });

  it("falls back to a dictionary form or reading that occurs in the sentence", () => {
    expect(pickSentenceKeyword("コーヒーを飲む。", ["珈琲", "コーヒー"])).toBe("コーヒー");
    expect(pickSentenceKeyword("どこへ行く？", [undefined, "", "何処", "どこ"])).toBe("どこ");
  });

  it("bolds every occurrence and keeps HTML escaped", () => {
    const sentence = "<食べた>、また食べた";
    expect(boldKeyword(sentence, pickSentenceKeyword(sentence, ["食べた", "食べる"]))).toBe(
      "&lt;<b>食べた</b>&gt;、また<b>食べた</b>",
    );
  });

  it("returns the first form when there is no sentence", () => {
    expect(pickSentenceKeyword(undefined, [null, "食べた"])).toBe("食べた");
    expect(pickSentenceKeyword("", [])).toBeUndefined();
  });
});
