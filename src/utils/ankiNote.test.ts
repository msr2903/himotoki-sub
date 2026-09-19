import { describe, it, expect } from "vitest";
import { buildAnkiNote, buildHimotokiFields, boldKeyword, themeClass, renderMeaning, HIMOTOKI_MODEL_NAME } from "./ankiNote";

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

describe("themeClass", () => {
  it("maps themes to wrapper classes ('' for auto)", () => {
    expect(themeClass("auto")).toBe("");
    expect(themeClass(undefined)).toBe("");
    expect(themeClass("light")).toBe("himotoki--light");
    expect(themeClass("dark")).toBe("himotoki--dark");
  });
});

describe("renderMeaning", () => {
  it("renders a single meaning as plain escaped text", () => {
    expect(renderMeaning("face; visage")).toBe("face; visage");
    expect(renderMeaning("", ["face"])).toBe("face");
  });

  it("renders multiple meanings as a numbered list", () => {
    const html = renderMeaning("face", ["face; visage; looks", "look; expression", "hon: honour; dignity"]);
    expect(html).toBe(
      '<ol class="hm-senses"><li>face; visage; looks</li><li>look; expression</li><li>hon: honour; dignity</li></ol>',
    );
  });

  it("falls back to gloss when meanings is empty, and escapes HTML", () => {
    expect(renderMeaning("a <b> & c", [])).toBe("a &lt;b&gt; &amp; c");
  });
});

describe("buildHimotokiFields", () => {
  const base = { deckName: "Himotoki", word: "顔", gloss: "face" };

  it("builds minimal fields (no context, no media, auto theme)", () => {
    const f = buildHimotokiFields(base);
    expect(f.Word).toBe("顔");
    expect(f.Reading).toBe("");
    expect(f.Sentence).toBe("");
    expect(f.Meaning).toBe("face");
    expect(f.Level).toBe("");
    expect(f.Image).toBe("");
    expect(f.Audio).toBe("");
    expect(f.Theme).toBe("");
  });

  it("fills reading, bolded sentence, level, media and theme", () => {
    const f = buildHimotokiFields({
      ...base,
      reading: "かお",
      contextSentence: "顔を洗う",
      keyword: "顔",
      jlpt: ["n5", "n4"],
      imageFilename: "himotoki-1.jpg",
      audioFilename: "himotoki-1.wav",
      theme: "dark",
    });
    expect(f.Reading).toBe("かお");
    expect(f.Sentence).toBe("<b>顔</b>を洗う");
    expect(f.Level).toBe("N5 · N4");
    expect(f.Image).toBe('<img src="himotoki-1.jpg">');
    expect(f.Audio).toBe("[sound:himotoki-1.wav]");
    expect(f.Theme).toBe("himotoki--dark");
  });
});

describe("buildAnkiNote", () => {
  it("targets the Himotoki note type with tags and no duplicates", () => {
    const note = buildAnkiNote({ deckName: "Himotoki", word: "顔", gloss: "face" });
    expect(note.modelName).toBe(HIMOTOKI_MODEL_NAME);
    expect(note.deckName).toBe("Himotoki");
    expect(note.tags).toContain("himotoki");
    expect(note.options.allowDuplicate).toBe(false);
    expect(note.fields.Word).toBe("顔");
  });

  it("uses custom tags when provided, else defaults to himotoki", () => {
    expect(buildAnkiNote({ deckName: "D", word: "顔", gloss: "face", tags: ["mining", "jp"] }).tags).toEqual([
      "mining",
      "jp",
    ]);
    expect(buildAnkiNote({ deckName: "D", word: "顔", gloss: "face", tags: [] }).tags).toEqual(["himotoki"]);
  });
});
