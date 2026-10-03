import { describe, expect, it } from "vitest";
import { detectDictHost, unsupportedDictReply } from "./dictHost";

describe("dictionary host selection (#104)", () => {
  it("uses the offscreen document when chrome.offscreen exists, else the background page, else none", () => {
    expect(detectDictHost({ offscreen: { createDocument: () => undefined }, Worker: undefined })).toBe("offscreen");
    expect(detectDictHost({ offscreen: undefined, Worker: function Worker() {} })).toBe("background");
    expect(detectDictHost({})).toBe("unsupported");
  });

  it("answers every dictionary op without throwing when no host is available", () => {
    expect(unsupportedDictReply("status", {})).toMatchObject({ ok: true, data: { state: "unsupported" } });
    expect(unsupportedDictReply("lookup", { surface: "猫" })).toEqual({ ok: true, data: { available: false } });
    expect(unsupportedDictReply("lookupBatch", { surfaces: ["猫"] })).toEqual({ ok: true, data: { available: false } });
    expect(unsupportedDictReply("conjTable", { seq: 1 })).toEqual({ ok: true, data: { available: false } });
    expect(unsupportedDictReply("repair", { cues: [["猫", "が"]] })).toEqual({
      ok: true,
      data: { available: false, cues: [["猫", "が"]] },
    });
    expect(unsupportedDictReply("install", {})).toMatchObject({ ok: false });
    expect(unsupportedDictReply("remove", {})).toMatchObject({ ok: false });
  });
});
