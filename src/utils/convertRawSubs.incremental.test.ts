import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { convertJapaneseSubsFallback, convertJapaneseSubsWithLocalSplit } from "./convertRawSubs";
import type { Captions, TSub } from "@src/models/types";

// cleanCueText parses markup through a detached <div>; a tag-stripping double is enough here.
const fakeDocument = {
  createElement: () => {
    let text = "";
    return {
      set innerHTML(html: string) {
        text = html.replace(/<[^>]*>/g, "");
      },
      get textContent() {
        return text;
      },
    };
  },
};

let splitTexts: string[][];
beforeEach(() => {
  splitTexts = [];
  vi.stubGlobal("document", fakeDocument);
  vi.stubGlobal("chrome", {
    runtime: {
      sendMessage: async (message: { type: string; texts?: string[]; cues?: string[][] }) => {
        if (message.type === "himotokiSplitBatch") {
          splitTexts.push(message.texts!);
          // One segment per character, so a split result is distinguishable from the Segmenter paint.
          return { ok: true, data: message.texts!.map((t) => ({ segments: [...t] })) };
        }
        return { ok: true, data: { available: false } };
      },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

const cues = (n: number): Captions =>
  Array.from({ length: n }, (_, i) => ({ text: `猫${i}です`, start: i * 1000, end: i * 1000 + 1000 })) as Captions;

/** What the model does for incremental captions: paint, then upgrade, each fed the previous $subs. */
async function accumulate(n: number) {
  let subs: TSub[] = [];
  for (let i = 1; i <= n; i++) {
    const raw = cues(i);
    const painted = convertJapaneseSubsFallback(raw, subs);
    subs = await convertJapaneseSubsWithLocalSplit(raw, painted);
  }
  return subs;
}

describe("incremental captions are analysed once each (#144)", () => {
  it("splits only the new cue's text as cues accumulate", async () => {
    const subs = await accumulate(20);
    expect(splitTexts.map((batch) => batch.length)).toEqual(Array(20).fill(1));
    expect(subs).toHaveLength(20);
    expect(subs.every((sub) => sub.analyzed)).toBe(true);
  });

  it("gives the same result as converting the whole track at once", async () => {
    const incremental = await accumulate(5);
    const whole = await convertJapaneseSubsWithLocalSplit(cues(5));
    expect(incremental).toEqual(whole);
  });

  it("the paint for a new cue keeps already analysed cues", async () => {
    const subs = await accumulate(3);
    const painted = convertJapaneseSubsFallback(cues(4), subs);
    expect(painted.map((s) => s.analyzed)).toEqual([true, true, true, false]);
  });

  it("re-analyses a cue whose text or start changed", async () => {
    const subs = await accumulate(3);
    splitTexts = [];
    const raw = cues(3);
    raw[2] = { ...raw[2]!, text: "犬です" };
    raw[0] = { ...raw[0]!, start: 500 };
    await convertJapaneseSubsWithLocalSplit(raw, convertJapaneseSubsFallback(raw, subs));
    expect(splitTexts).toEqual([["猫0です", "犬です"]]);
  });

  it("re-reads reading lines when the track gains a verified one", async () => {
    let subs: TSub[] = [];
    const first = [{ text: "日本語\nにほんご", start: 0, end: 1000 }] as Captions;
    subs = await convertJapaneseSubsWithLocalSplit(first, convertJapaneseSubsFallback(first, subs));
    expect(subs[0]!.readingLine).toBeUndefined();
    const both = [...first, { text: "朝起きた\nあさおきた", start: 1000, end: 2000 }] as Captions;
    subs = await convertJapaneseSubsWithLocalSplit(both, convertJapaneseSubsFallback(both, subs));
    expect(subs.map((s) => s.readingLine)).toEqual(["にほんご", "あさおきた"]);
    expect(subs[0]!.cleanedText).toBe("日本語");
  });
});
