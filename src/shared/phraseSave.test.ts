import { describe, expect, it } from "vitest";

import { pendingPhraseSaveStep, type TPendingPhraseSave } from "./phraseSave";

const draft: TPendingPhraseSave<{ deckName: string }> = { phrase: "猫が", language: "en", payload: { deckName: "Mining" } };
const now = (over: Partial<Parameters<typeof pendingPhraseSaveStep>[1]> = {}) => ({
  phrase: "猫が",
  language: "en",
  pending: false,
  translation: null,
  error: null,
  ...over,
});

describe("a pending Save phrase click (#158)", () => {
  it("waits for the translation of the phrase it was clicked for, then runs", () => {
    expect(pendingPhraseSaveStep(draft, now())).toBe("wait");
    expect(pendingPhraseSaveStep(draft, now({ pending: true }))).toBe("wait");
    expect(pendingPhraseSaveStep(draft, now({ translation: "cat is" }))).toBe("run");
  });

  it("is cancelled when the selection is extended or shrunk, even if that phrase is translated", () => {
    expect(pendingPhraseSaveStep(draft, now({ phrase: "猫が好き", translation: "likes cats" }))).toBe("cancel");
    expect(pendingPhraseSaveStep(draft, now({ phrase: "猫", translation: "cat" }))).toBe("cancel");
    expect(pendingPhraseSaveStep(draft, now({ phrase: "" }))).toBe("cancel");
  });

  it("is cancelled when the translation language changes", () => {
    expect(pendingPhraseSaveStep(draft, now({ language: "de", translation: "Katze" }))).toBe("cancel");
  });

  it("is cancelled by a failed translation, but a retry in flight waits", () => {
    expect(pendingPhraseSaveStep(draft, now({ error: "DeepL API error: 500" }))).toBe("cancel");
    expect(pendingPhraseSaveStep(draft, now({ error: "DeepL API error: 500", pending: true }))).toBe("wait");
  });

  it("does nothing without a pending click", () => {
    expect(pendingPhraseSaveStep(null, now({ translation: "cat is" }))).toBe("idle");
  });
});
