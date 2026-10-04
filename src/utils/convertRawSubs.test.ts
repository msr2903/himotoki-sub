import { describe, expect, it } from "vitest";

import { chunkCue, splitReadingLine, splitReadingLines } from "./convertRawSubs";

describe("splitReadingLine", () => {
  it("splits a genuine kanji line + kana reading line", () => {
    const cue = "皆さんは朝起きたら何をしますか\nみなさんはあさおきたらなにをしますか";
    const { body, readingLine } = splitReadingLine(cue);
    expect(body).toBe("皆さんは朝起きたら何をしますか");
    expect(readingLine).toBe("みなさんはあさおきたらなにをしますか");
  });

  it("tolerates spaces in the reading line", () => {
    const cue = "朝起きたら何をしますか\nあさ おきたら なに を しますか";
    const { body, readingLine } = splitReadingLine(cue);
    expect(body).toBe("朝起きたら何をしますか");
    expect(readingLine).toBe("あさ おきたら なに を しますか");
  });

  it("does not treat unrelated two-line dialogue as a reading line", () => {
    // The kana line is unrelated dialogue: the kanji line's own kana (を, む) are not a
    // subsequence of it, so it cannot be a reading of the first line.
    const cue = "水を飲む\nはいそうですよ";
    const { body, readingLine } = splitReadingLine(cue);
    expect(readingLine).toBeNull();
    expect(body).toBe(cue);
  });

  it("does not fire when the kana line is shorter than the kanji line's own kana", () => {
    const cue = "食べましたか\nたべ";
    expect(splitReadingLine(cue).readingLine).toBeNull();
  });

  it("does nothing for a single line", () => {
    const cue = "こんにちは";
    expect(splitReadingLine(cue)).toEqual({ body: cue, readingLine: null });
  });

  it("does nothing when the first line has no kanji", () => {
    const cue = "こんにちは\nこんにちはみなさん";
    expect(splitReadingLine(cue).readingLine).toBeNull();
  });
});

describe("kanji-only first lines (#119)", () => {
  it("keeps a second speaker under a kanji-only line", () => {
    expect(splitReadingLine("何？\nはい。")).toEqual({ body: "何？\nはい。", readingLine: null });
  });

  it("trusts a kanji-only line's reading only in a track with verified reading lines", () => {
    const track = ["皆さんは朝起きたら何をしますか\nみなさんはあさおきたらなにをしますか", "日本語\nにほんご"];
    expect(splitReadingLines(track).map((r) => r.readingLine)).toEqual([
      "みなさんはあさおきたらなにをしますか",
      "にほんご",
    ]);
    // Without that evidence both lines stay.
    expect(splitReadingLines(["日本語\nにほんご", "何？\nはい。"]).map((r) => r.readingLine)).toEqual([null, null]);
  });

  it("still rejects a kana line too short to read every kanji", () => {
    const track = ["朝起きたら何をしますか\nあさおきたらなにをしますか", "日本語学校\nはい"];
    expect(splitReadingLines(track)[1]).toEqual({ body: "日本語学校\nはい", readingLine: null });
  });
});

describe("chunkCue", () => {
  it("separates text runs, spaces and newlines and trims leading/trailing whitespace", () => {
    expect(chunkCue("食べる ます\n次")).toEqual([
      { kind: "text", text: "食べる" },
      { kind: "space" },
      { kind: "text", text: "ます" },
      { kind: "newline" },
      { kind: "text", text: "次" },
    ]);
  });

  it("treats the ideographic space U+3000 as a space chunk", () => {
    expect(chunkCue("朝　夜")).toEqual([
      { kind: "text", text: "朝" },
      { kind: "space" },
      { kind: "text", text: "夜" },
    ]);
  });
});
