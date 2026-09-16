import { describe, it, expect } from "vitest";
import { statusOf, setStatus, mergeLegacyKnown, statusClass } from "./wordStatus";

describe("statusOf", () => {
  it("returns 'new' for an unknown key", () => {
    expect(statusOf({}, "hw:猫")).toBe("new");
  });

  it("returns 'new' for a null/undefined key", () => {
    expect(statusOf({ "hw:猫": "known" }, null)).toBe("new");
    expect(statusOf({ "hw:猫": "known" }, undefined)).toBe("new");
  });

  it("prefers an explicit status over the legacy list", () => {
    expect(statusOf({ "hw:猫": "learning" }, "hw:猫", ["hw:猫"])).toBe("learning");
  });

  it("falls back to the legacy known array", () => {
    expect(statusOf({}, "hw:猫", ["hw:猫"])).toBe("known");
    expect(statusOf({}, "hw:犬", ["hw:猫"])).toBe("new");
  });
});

describe("setStatus", () => {
  it("stores a non-new status without mutating the input", () => {
    const map = {};
    const next = setStatus(map, "hw:猫", "learning");
    expect(next).toEqual({ "hw:猫": "learning" });
    expect(map).toEqual({});
  });

  it("removes the entry when set back to 'new'", () => {
    const next = setStatus({ "hw:猫": "known" }, "hw:猫", "new");
    expect(next).toEqual({});
  });

  it("overwrites an existing status", () => {
    const next = setStatus({ "hw:猫": "learning" }, "hw:猫", "known");
    expect(next).toEqual({ "hw:猫": "known" });
  });
});

describe("mergeLegacyKnown", () => {
  it("marks legacy keys as known when unset", () => {
    expect(mergeLegacyKnown({}, ["hw:猫", "hw:犬"])).toEqual({
      "hw:猫": "known",
      "hw:犬": "known",
    });
  });

  it("does not override an explicit status", () => {
    expect(mergeLegacyKnown({ "hw:猫": "ignored" }, ["hw:猫"])).toEqual({ "hw:猫": "ignored" });
  });

  it("returns the same reference when nothing changes", () => {
    const map = { "hw:猫": "known" as const };
    expect(mergeLegacyKnown(map, ["hw:猫"])).toBe(map);
    expect(mergeLegacyKnown(map, [])).toBe(map);
  });
});

describe("statusClass", () => {
  it("maps each status to its class", () => {
    expect(statusClass("new")).toBe("");
    expect(statusClass("learning")).toBe("es-sub-item--learning");
    expect(statusClass("known")).toBe("es-sub-item--known");
    expect(statusClass("ignored")).toBe("es-sub-item--ignored");
  });
});
