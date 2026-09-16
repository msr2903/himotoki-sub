import { describe, it, expect } from "vitest";
import { buildAnkiNote, boldKeyword } from "./ankiNote";

describe("boldKeyword", () => {
  it("escapes HTML in the sentence", () => {
    expect(boldKeyword("a < b & c", undefined)).toBe("a &lt; b &amp; c");
  });

  it("bolds each occurrence of the keyword", () => {
    expect(boldKeyword("顔を洗う。顔。", "顔")).toBe("<b>顔</b>を洗う。<b>顔</b>。");
  });

  it("returns the plain escaped sentence when there is no keyword", () => {
    expect(boldKeyword("顔を洗う", "")).toBe("顔を洗う");
  });
});

describe("buildAnkiNote", () => {
  const base = { deckName: "Himotoki", word: "顔", gloss: "face" };

  it("builds a minimal card (no context, no media)", () => {
    const note = buildAnkiNote(base);
    expect(note.deckName).toBe("Himotoki");
    expect(note.modelName).toBe("Basic");
    expect(note.fields.Front).toBe("顔");
    expect(note.fields.Back).toContain("face");
    expect(note.fields.Back).not.toContain("<img");
    expect(note.fields.Back).not.toContain("[sound:");
    expect(note.tags).toContain("himotoki");
  });

  it("adds reading to the front", () => {
    const note = buildAnkiNote({ ...base, reading: "かお" });
    expect(note.fields.Front).toContain("かお");
  });

  it("bolds the keyword inside the context sentence", () => {
    const note = buildAnkiNote({ ...base, contextSentence: "顔を洗う", keyword: "顔" });
    expect(note.fields.Back).toContain("<b>顔</b>を洗う");
  });

  it("references stored media by filename", () => {
    const note = buildAnkiNote({ ...base, imageFilename: "himotoki-1.jpg", audioFilename: "himotoki-1.webm" });
    expect(note.fields.Back).toContain('<img src="himotoki-1.jpg">');
    expect(note.fields.Back).toContain("[sound:himotoki-1.webm]");
  });

  it("renders JLPT tags uppercased", () => {
    const note = buildAnkiNote({ ...base, jlpt: ["n5", "n4"] });
    expect(note.fields.Back).toContain("N5 · N4");
  });
});
