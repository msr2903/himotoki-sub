import { createEvent, fork, scopeBind } from "effector";
import { describe, expect, it, vi } from "vitest";

// Keep the real translation graph; replace only browser/persisted settings and
// subtitle inputs so races can be driven without loading a streaming site.
vi.mock("../settings", async () => {
  const { createStore } = await import("effector");
  return {
    $translateLanguage: createStore("en"),
    $translationService: createStore("google"),
    $deeplApiKey: createStore(""),
  };
});
vi.mock("../subs", async () => {
  const { createStore } = await import("effector");
  return { $currentSubs: createStore([]), $subs: createStore([]) };
});

import { $deeplApiKey, $translateLanguage, $translationService } from "../settings";
import { $lineTranslations, $lineTranslationPendings, fetchSubTranslationFx, lineTranslationRequested } from ".";

const languageChanged = createEvent<string>();
const serviceChanged = createEvent<"google" | "deepl">();
const apiKeyChanged = createEvent<string>();
$translateLanguage.on(languageChanged, (_, value) => value);
$translationService.on(serviceChanged, (_, value) => value);
$deeplApiKey.on(apiKeyChanged, (_, value) => value);

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const setup = () => {
  const requests: Array<{ resolve: (text: string) => void; reject: (error: Error) => void }> = [];
  const handler = vi.fn(() => new Promise<string>((resolve, reject) => requests.push({ resolve, reject })));
  const scope = fork({ handlers: [[fetchSubTranslationFx, handler]] });
  return { scope, requests, handler, request: scopeBind(lineTranslationRequested, { scope }) };
};

describe("line translation request lifecycle", () => {
  it.each([
    [languageChanged, "id"],
    [serviceChanged, "deepl"],
    [apiKeyChanged, "replacement-key"],
  ] as const)("invalidates pending work when setting %s changes", async (change, value) => {
    const { scope, requests, request } = setup();
    request("猫");
    scopeBind(change as typeof languageChanged, { scope })(value);
    expect(scope.getState($lineTranslationPendings)).toEqual({});
    request("猫");
    expect(requests).toHaveLength(2);
    requests[0].resolve("obsolete");
    await flush();
    expect(scope.getState($lineTranslations)).toEqual({});
    expect(scope.getState($lineTranslationPendings)).toEqual({ 猫: true });
    request("猫");
    expect(requests).toHaveLength(2);
    requests[1].resolve("current");
    await flush();
    expect(scope.getState($lineTranslations)).toEqual({ 猫: { text: "current" } });
    expect(scope.getState($lineTranslationPendings)).toEqual({});
  });

  it("rejects an old response after switching A → B → A", async () => {
    const { scope, requests, request } = setup();
    request("猫");
    const change = scopeBind(languageChanged, { scope });
    change("id");
    change("en");
    request("猫");
    requests[1].resolve("new English");
    await flush();
    requests[0].resolve("old English");
    await flush();
    expect(scope.getState($lineTranslations)).toEqual({ 猫: { text: "new English" } });
  });

  it("ignores obsolete failures without clearing the current pending request", async () => {
    const { scope, requests, request } = setup();
    request("猫");
    scopeBind(apiKeyChanged, { scope })("corrected-key");
    request("猫");
    requests[0].reject(new Error("old credentials"));
    await flush();
    expect(scope.getState($lineTranslations)).toEqual({});
    expect(scope.getState($lineTranslationPendings)).toEqual({ 猫: true });
    requests[1].resolve("cat");
    await flush();
    expect(scope.getState($lineTranslations).猫.text).toBe("cat");
  });

  it("deduplicates trimmed requests, reuses success, and permits retry after failure", async () => {
    const { scope, requests, request } = setup();
    request("  猫  ");
    request("猫");
    request(" ");
    expect(requests).toHaveLength(1);
    requests[0].reject(new Error("temporary failure"));
    await flush();
    expect(scope.getState($lineTranslations).猫.error).toBe("temporary failure");
    request("猫");
    requests[1].resolve("cat");
    await flush();
    request("猫");
    expect(requests).toHaveLength(2);
    expect(scope.getState($lineTranslations)).toEqual({ 猫: { text: "cat" } });
  });
});
