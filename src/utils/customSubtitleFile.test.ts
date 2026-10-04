import { describe, expect, it } from "vitest";

import { latestOnly, parseSubtitleFile, STALE } from "./customSubtitleFile";

const srt = (...cues: string[]) => cues.map((cue, i) => `${i + 1}\n${cue}\n`).join("\n");

describe("an uploaded subtitle file (#156)", () => {
  it("keeps the cues of a valid SRT and WebVTT file", () => {
    expect(parseSubtitleFile(srt("00:00:01,000 --> 00:00:02,500\n猫です"), "a.srt")).toEqual({
      cues: [{ start: 1000, end: 2500, text: "猫です" }],
    });
    const vtt = "WEBVTT\n\n00:00:03.000 --> 00:00:04.000\nはい\n\n00:00:01.000 --> 00:00:02.000\nいいえ\n";
    expect(parseSubtitleFile(vtt, "a.vtt")).toEqual({
      cues: [
        { start: 1000, end: 2000, text: "いいえ" },
        { start: 3000, end: 4000, text: "はい" },
      ],
    });
  });

  it("rejects an empty or non-subtitle file instead of returning an empty track", () => {
    const error = (name: string) => ({ error: `"${name}" has no subtitles that can be shown. Choose an SRT or WebVTT file.` });
    expect(parseSubtitleFile("", "empty.srt")).toEqual(error("empty.srt"));
    expect(parseSubtitleFile("hello world\nno timestamps", "notes.txt")).toEqual(error("notes.txt"));
    expect(parseSubtitleFile("1\n00:00:xx,000 --> 00:00:02,500\nbad\n", "bad.srt")).toEqual(error("bad.srt"));
  });

  it("drops cues with reversed times or no text", () => {
    const file = srt("00:00:01,000 --> 00:00:02,500\n猫です", "00:00:05,000 --> 00:00:04,000\n逆", "00:00:06,000 --> 00:00:07,000\n   ");
    expect(parseSubtitleFile(file, "a.srt")).toEqual({ cues: [{ start: 1000, end: 2500, text: "猫です" }] });
  });
});

describe("overlapping file reads (#145)", () => {
  const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
    return { promise, resolve, reject };
  };

  it("the newer selection wins when the older read finishes last", async () => {
    const latest = latestOnly();
    const older = deferred<string>();
    const newer = deferred<string>();
    const first = latest.run(older.promise);
    const second = latest.run(newer.promise);
    newer.resolve("新しい");
    older.resolve("古い");
    expect(await second).toBe("新しい");
    expect(await first).toBe(STALE);
  });

  it("the newer selection wins when the older read finishes first", async () => {
    const latest = latestOnly();
    const older = deferred<string>();
    const newer = deferred<string>();
    const first = latest.run(older.promise);
    const second = latest.run(newer.promise);
    older.resolve("古い");
    expect(await first).toBe(STALE);
    newer.resolve("新しい");
    expect(await second).toBe("新しい");
  });

  it("a superseded read's failure is not reported, and cancel drops the pending read", async () => {
    const latest = latestOnly();
    const older = deferred<string>();
    const first = latest.run(older.promise);
    const newer = deferred<string>();
    const second = latest.run(newer.promise);
    older.reject(new Error("read failed"));
    expect(await first).toBe(STALE);
    latest.cancel();
    newer.resolve("新しい");
    expect(await second).toBe(STALE);
    await expect(latest.run(Promise.reject(new Error("read failed")))).rejects.toThrow("read failed");
  });
});
