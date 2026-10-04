import { afterEach, describe, expect, it, vi } from "vitest";
import { allSettled, fork } from "effector";

// Real subtitle graph and converters; only settings, streaming, notifications, the DOM markup
// parser and extension messaging are controlled.
vi.mock("patronum", () => ({ debug: () => undefined }));
vi.mock("@src/pages/content/notify", () => ({ notifyInfo: () => undefined, notifyError: () => undefined }));
vi.mock("../settings", async () => {
  const { createStore } = await import("effector");
  return {
    $autoPause: createStore(false),
    $enabled: createStore(true),
    $secondarySubs: createStore("off"),
    $translateLanguage: createStore("en"),
    $translationService: createStore("google"),
    $deeplApiKey: createStore(""),
    $knownWords: createStore([]),
  };
});
vi.mock("../streamings", async () => {
  const { createStore } = await import("effector");
  return { $streaming: createStore({ name: "stub" }) };
});

import { $coverageStatus, $subs, rawSubsAdded } from ".";
import "./init";

afterEach(() => vi.unstubAllGlobals());

describe("captions that arrive one cue at a time (#144)", () => {
  it("split and look up each new cue once, not the whole transcript per cue", async () => {
    const splitBatches: number[] = [];
    const lookedUp: string[] = [];
    vi.stubGlobal("document", {
      createElement: () => {
        const content = { textContent: "", querySelectorAll: () => [] };
        return { content, set innerHTML(html: string) { content.textContent = html; } };
      },
    });
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: async (message: { type: string; texts?: string[]; surfaces?: string[] }) => {
          if (message.type === "himotokiSplitBatch") {
            splitBatches.push(message.texts!.length);
            return { ok: true, data: message.texts!.map((text) => ({ segments: [text] })) };
          }
          if (message.type === "himotokiLookupBatch") {
            lookedUp.push(...message.surfaces!);
            return { ok: true, data: { available: true, results: [] } };
          }
          return { ok: true, data: { available: false } };
        },
      },
    });
    const scope = fork();
    for (let i = 0; i < 20; i++) {
      await allSettled(rawSubsAdded, { scope, params: [{ text: `単語${i}`, start: i * 1000, end: i * 1000 + 100000 }] });
    }
    const subs = scope.getState($subs);
    expect(subs.map((s) => s.text)).toEqual(Array.from({ length: 20 }, (_, i) => `単語${i}`));
    expect(subs.every((s) => s.analyzed)).toBe(true);
    expect(splitBatches).toEqual(Array(20).fill(1));
    // Every surface (the Segmenter paint's and the split's) is looked up once per dictionary.
    expect(lookedUp.length).toBe(new Set(lookedUp).size);
    expect(lookedUp).toEqual(expect.arrayContaining(subs.map((s) => s.text)));
    expect(scope.getState($coverageStatus)).toBe("ready");
  });
});
