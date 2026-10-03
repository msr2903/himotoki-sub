import { allSettled, fork, scopeBind } from "effector";
import { describe, expect, it, vi } from "vitest";

// Real translation graph; only persisted settings and subtitle inputs are replaced.
vi.mock("../settings", async () => {
  const { createStore } = await import("effector");
  return {
    $translateLanguage: createStore("ja"),
    $translationService: createStore("google"),
    $deeplApiKey: createStore(""),
  };
});
vi.mock("../subs", async () => {
  const { createStore } = await import("effector");
  return { $currentSubs: createStore([]), $subs: createStore([]) };
});

import type { TWordTranslation } from "../types";
import {
  $dictReady,
  $lineTranslations,
  $lookups,
  checkDictReadyFx,
  fetchSubTranslationFx,
  fetchWordTranslationFx,
  lineTranslationRequested,
  lookupRequested,
} from ".";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const word = (source: string, lookupSource: "local" | "none" = "local"): TWordTranslation => ({
  source,
  headword: source,
  mainTranslation: lookupSource === "local" ? "meaning" : "",
  targetLanguage: "en",
  translations: [],
  transcription: "",
  lookupSource,
});

describe("lookup caches ignore inherited Object properties (#113)", () => {
  it.each(["constructor", "toString", "__proto__", "hasOwnProperty"])("looks up and translates %s", async (key) => {
    const lookup = vi.fn(async ({ source }: { source: string }) => word(source));
    const translate = vi.fn(async () => "translated");
    const scope = fork({ values: [[$dictReady, true]], handlers: [[fetchWordTranslationFx, lookup], [fetchSubTranslationFx, translate]] });
    await allSettled(lookupRequested, { scope, params: key });
    await allSettled(lineTranslationRequested, { scope, params: key });
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(translate).toHaveBeenCalledTimes(1);
    expect(Object.prototype.hasOwnProperty.call(scope.getState($lookups), key)).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(scope.getState($lineTranslations), key)).toBe(true);
    expect(Object.getPrototypeOf(scope.getState($lookups))).toBe(Object.prototype);

    // Cached now: requesting again reuses the entry.
    await allSettled(lookupRequested, { scope, params: key });
    await allSettled(lineTranslationRequested, { scope, params: key });
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(translate).toHaveBeenCalledTimes(1);
  });

  it("still reuses ordinary cached words", async () => {
    const lookup = vi.fn(async ({ source }: { source: string }) => word(source));
    const scope = fork({ values: [[$dictReady, true]], handlers: [[fetchWordTranslationFx, lookup]] });
    await allSettled(lookupRequested, { scope, params: "猫" });
    await allSettled(lookupRequested, { scope, params: "猫" });
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(scope.getState($lookups).猫.mainTranslation).toBe("meaning");
  });
});

describe("dictionary readiness ordering (#141)", () => {
  const setup = () => {
    const lookups: Array<{ source: string; resolve: (t: TWordTranslation) => void }> = [];
    const status = { ready: true };
    const scope = fork({
      values: [[$dictReady, true]],
      handlers: [
        [fetchWordTranslationFx, ({ source }: { source: string }) => new Promise<TWordTranslation>((resolve) => lookups.push({ source, resolve }))],
        [checkDictReadyFx, async () => ({ ready: status.ready, revision: status.ready ? "r1" : "" })],
      ],
    });
    const check = async () => {
      await scopeBind(checkDictReadyFx, { scope })();
      await flush();
    };
    return { scope, lookups, status, check, request: scopeBind(lookupRequested, { scope }) };
  };

  it("an older lookup cannot restore ready after a newer missing status", async () => {
    const { scope, lookups, status, check, request } = setup();
    request("猫");
    status.ready = false;
    await check();
    expect(scope.getState($dictReady)).toBe(false);
    lookups[0].resolve(word("猫"));
    await flush();
    expect(scope.getState($dictReady)).toBe(false);
  });

  it("after a reinstall, new lookups infer readiness again", async () => {
    const { scope, lookups, status, check, request } = setup();
    request("猫");
    status.ready = false;
    await check();
    status.ready = true;
    await check();
    expect(scope.getState($dictReady)).toBe(true);
    // The stale lookup (from before the removal) reports "none": ignored, still ready.
    lookups[0].resolve(word("猫", "none"));
    await flush();
    expect(scope.getState($dictReady)).toBe(true);
    // A lookup started now is current and may infer a removal.
    request("犬");
    lookups[1].resolve(word("犬", "none"));
    await flush();
    expect(scope.getState($dictReady)).toBe(false);
  });

  it("a status change still invalidates the cache", async () => {
    const { scope, lookups, status, check, request } = setup();
    request("猫");
    lookups[0].resolve(word("猫"));
    await flush();
    expect(scope.getState($lookups).猫).toBeDefined();
    status.ready = false;
    await check();
    expect(scope.getState($lookups)).toEqual({});
  });
});
