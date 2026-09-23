import { describe, it, expect } from "vitest";
import { addToHistory, historyItemFromTranslation, urlWithTimestamp, videoKeyFromUrl, TLookupHistoryItem } from "./lookupHistory";

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

  it("records the video url and derived video key (#84)", () => {
    const h = historyItemFromTranslation(tx, 5000, "V", "https://www.youtube.com/watch?v=jfKfPfyJRdk");
    expect(h?.videoUrl).toBe("https://www.youtube.com/watch?v=jfKfPfyJRdk");
    expect(h?.videoKey).toBe("yt:jfKfPfyJRdk");
  });
});

describe("videoKeyFromUrl (#84)", () => {
  it("uses the YouTube video id across url shapes", () => {
    const key = "yt:jfKfPfyJRdk";
    expect(videoKeyFromUrl("https://www.youtube.com/watch?v=jfKfPfyJRdk")).toBe(key);
    expect(videoKeyFromUrl("https://www.youtube.com/watch?v=jfKfPfyJRdk&t=30s")).toBe(key);
    expect(videoKeyFromUrl("https://www.youtube.com/shorts/jfKfPfyJRdk")).toBe(key);
    expect(videoKeyFromUrl("https://www.youtube.com/live/jfKfPfyJRdk")).toBe(key);
    // youtu.be ids live in the path — covered by the origin+path fallback, still per-video stable.
    expect(videoKeyFromUrl("https://youtu.be/jfKfPfyJRdk")).toBe("https://youtu.be/jfKfPfyJRdk");
  });

  it("falls back to origin+path for other services", () => {
    expect(videoKeyFromUrl("https://www.netflix.com/watch/81234567")).toBe("https://www.netflix.com/watch/81234567");
    expect(videoKeyFromUrl("https://www.netflix.com/watch/81234567?t=123")).toBe("https://www.netflix.com/watch/81234567");
  });

  it("is undefined for no url", () => {
    expect(videoKeyFromUrl(undefined)).toBeUndefined();
  });
});

describe("urlWithTimestamp (#84)", () => {
  it("adds a t= parameter for YouTube urls", () => {
    expect(urlWithTimestamp("https://www.youtube.com/watch?v=jfKfPfyJRdk", 65_000)).toBe(
      "https://www.youtube.com/watch?v=jfKfPfyJRdk&t=65s",
    );
  });

  it("leaves other urls unchanged", () => {
    expect(urlWithTimestamp("https://www.netflix.com/watch/81234567", 65_000)).toBe(
      "https://www.netflix.com/watch/81234567",
    );
  });
});
