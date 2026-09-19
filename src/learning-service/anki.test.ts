import { describe, it, expect } from "vitest";
import { isAnkiConnectionError } from "./anki";

describe("isAnkiConnectionError", () => {
  it("treats the real network failures as connection errors", () => {
    expect(isAnkiConnectionError({ error: "Failed to fetch" })).toBe(true);
    expect(isAnkiConnectionError({ error: "NetworkError when attempting to fetch resource." })).toBe(true);
    expect(isAnkiConnectionError({ error: "Load failed" })).toBe(true);
    expect(isAnkiConnectionError(null)).toBe(true);
    expect(isAnkiConnectionError(undefined)).toBe(true);
  });

  it("does not misclassify a successful call or a non-network Anki error", () => {
    expect(isAnkiConnectionError({ error: null } as { error?: unknown })).toBe(false);
    expect(isAnkiConnectionError({})).toBe(false);
    expect(isAnkiConnectionError({ error: "deck name conflicts with existing" })).toBe(false);
    expect(isAnkiConnectionError({ error: "HTTP error! status: 403" })).toBe(false);
  });
});
