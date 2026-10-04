import { describe, expect, it, vi } from "vitest";

import { prepareEndpointUrl } from "./endpointUrl";

describe("saving a custom endpoint URL (#94)", () => {
  it("asks for the origin's host permission and saves the trimmed URL once granted", async () => {
    const request = vi.fn(async () => true);
    expect(await prepareEndpointUrl("  https://dict.example.test:8443/jitendex.sqlite.gz ", request)).toEqual({
      ok: true,
      value: "https://dict.example.test:8443/jitendex.sqlite.gz",
    });
    expect(request).toHaveBeenCalledWith(["https://dict.example.test:8443/*"]);
  });

  it("keeps the previous URL when the permission is denied or the prompt fails", async () => {
    for (const request of [async () => false, async () => Promise.reject(new Error("dismissed"))]) {
      expect(await prepareEndpointUrl("https://dict.example.test/x", request)).toEqual({
        ok: false,
        error: "Host permission was not granted. The previous URL is still active.",
      });
    }
  });

  it("rejects text that is not an HTTP(S) URL without prompting", async () => {
    const request = vi.fn(async () => true);
    for (const value of ["dict.example.test", "ftp://dict.example.test/x", "javascript:alert(1)"]) {
      expect(await prepareEndpointUrl(value, request)).toEqual({ ok: false, error: "Enter a valid HTTP or HTTPS URL." });
    }
    expect(request).not.toHaveBeenCalled();
  });

  it("a blank field restores the default without prompting", async () => {
    const request = vi.fn(async () => true);
    expect(await prepareEndpointUrl("   ", request)).toEqual({ ok: true, value: "" });
    expect(request).not.toHaveBeenCalled();
  });
});
