import { afterEach, describe, expect, it, vi } from "vitest";

import { deeplTranslateFetcher } from "./deeplTranslateFetcher";

function recordRequests() {
  const bodies: Array<{ target_lang: string }> = [];
  vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
    bodies.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ translations: [{ text: "translated" }] }) };
  });
  deeplTranslateFetcher.setApiKey("fixture-key:fx");
  return bodies;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DeepL target language (#139)", () => {
  it("maps selector codes DeepL supports", async () => {
    const bodies = recordRequests();
    for (const lang of ["en", "vi", "no", "zh-TW", "pt"]) {
      await deeplTranslateFetcher.getFullTextTranslation({ text: "猫", lang: lang as never });
    }
    expect(bodies.map((b) => b.target_lang)).toEqual(["EN-US", "VI", "NB", "ZH-HANT", "PT-PT"]);
  });

  it("refuses a language DeepL can't target instead of translating into English", async () => {
    const bodies = recordRequests();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(deeplTranslateFetcher.getFullTextTranslation({ text: "猫", lang: "bn" as never })).rejects.toThrow(
      /DeepL can't translate into this language/,
    );
    await expect(deeplTranslateFetcher.getFullTextTranslation({ text: "猫", lang: "xx-unknown" as never })).rejects.toThrow(
      /DeepL can't translate into this language/,
    );
    expect(bodies).toEqual([]);
  });
});
