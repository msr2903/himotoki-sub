import { afterEach, describe, expect, it, vi } from "vitest";
import { allSettled, fork } from "effector";

// Real subtitle, translation and stats graphs; only settings, streaming, notifications and the
// extension messaging are controlled.
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

import { $coverageKeys, $coverageStatus, $subs, processJapaneseSubsFx, processRawSubsFx, updateCustomSubsFx } from ".";
import "./init";
import { $dictReady, checkDictReadyFx, fetchWordTranslationFx } from "../translations";
import { $videoStats } from "../stats";

const entry = (seq: number) => ({ source: "jitendex", seq, kanji: ["猫"], readings: ["ねこ"], senses: [{ pos: ["n"], glosses: ["cat"] }] });
const processed = [
  { id: 0, text: "猫", cleanedText: "猫", start: 0, end: 1000, items: [{ type: "word", text: "猫", cleanedText: "猫" }] },
];

function setup() {
  const dict = { installed: false, revision: "r1", seq: 100, batches: 0, hold: null as null | Promise<void> };
  const send = vi.fn(async (message: { type: string }) => {
    if (message.type === "himotokiLookupBatch") {
      dict.batches += 1;
      const snapshot = { installed: dict.installed, seq: dict.seq };
      if (dict.hold) await dict.hold;
      return {
        ok: true,
        data: { available: snapshot.installed, results: snapshot.installed ? [{ surface: "猫", best: entry(snapshot.seq) }] : [] },
      };
    }
    if (message.type === "himotokiLookup")
      return { ok: true, data: { available: dict.installed, surface: "猫", best: dict.installed ? entry(dict.seq) : null } };
    if (message.type === "himotokiDictStatus")
      return { ok: true, data: { state: dict.installed ? "ready" : "missing", revision: dict.installed ? dict.revision : "" } };
    throw new Error(`unexpected ${message.type}`);
  });
  vi.stubGlobal("chrome", { runtime: { sendMessage: send } });
  const scope = fork({
    handlers: [
      [processRawSubsFx, async () => processed],
      [processJapaneseSubsFx, async () => processed],
    ],
  });
  const load = () => allSettled(updateCustomSubsFx, { scope, params: [{ text: "猫", start: 0, end: 1000 }] as never });
  return { dict, scope, load };
}

afterEach(() => vi.unstubAllGlobals());

describe("video coverage follows dictionary availability (#161)", () => {
  it("recomputes unchanged captions after install and invalidates them after removal", async () => {
    const { dict, scope, load } = setup();
    await load();
    expect(scope.getState($coverageStatus)).toBe("missing");
    const captions = scope.getState($subs);

    dict.installed = true;
    await allSettled(fetchWordTranslationFx, { scope, params: { source: "猫" } });
    expect(scope.getState($dictReady)).toBe(true);
    expect(scope.getState($subs)).toBe(captions);
    expect(scope.getState($coverageStatus)).toBe("ready");
    expect(scope.getState($coverageKeys)["猫"]).toBe("seq:jitendex:100");
    expect(scope.getState($videoStats)?.total).toBe(1);

    dict.installed = false;
    await allSettled(checkDictReadyFx, { scope });
    expect(scope.getState($dictReady)).toBe(false);
    expect(scope.getState($coverageStatus)).toBe("missing");
    expect(scope.getState($coverageKeys)).toEqual({});
    expect(scope.getState($videoStats)).toBeNull();
  });

  it("recomputes when a different revision replaces the installed dictionary", async () => {
    const { dict, scope, load } = setup();
    dict.installed = true;
    await allSettled(checkDictReadyFx, { scope });
    await load();
    expect(scope.getState($coverageKeys)["猫"]).toBe("seq:jitendex:100");
    const before = dict.batches;

    // Same revision: no rescan.
    await allSettled(checkDictReadyFx, { scope });
    expect(dict.batches).toBe(before);

    dict.revision = "r2";
    dict.seq = 200;
    await allSettled(checkDictReadyFx, { scope });
    expect(dict.batches).toBe(before + 1);
    expect(scope.getState($coverageKeys)["猫"]).toBe("seq:jitendex:200");
  });

  it("a batch pending when the dictionary is removed cannot restore stale coverage", async () => {
    const { dict, scope, load } = setup();
    dict.installed = true;
    await allSettled(checkDictReadyFx, { scope });
    let release!: () => void;
    dict.hold = new Promise((resolve) => (release = resolve));
    const loading = load();
    await vi.waitFor(() => expect(dict.batches).toBe(1));
    expect(scope.getState($coverageStatus)).toBe("loading");

    dict.installed = false;
    // allSettled waits for the held batch too, so observe the removal before releasing it.
    const checking = allSettled(checkDictReadyFx, { scope });
    await vi.waitFor(() => expect(scope.getState($dictReady)).toBe(false));
    expect(scope.getState($coverageStatus)).toBe("missing");
    release();
    await Promise.all([loading, checking]);
    expect(scope.getState($coverageStatus)).toBe("missing");
    expect(scope.getState($coverageKeys)).toEqual({});
  });
});
