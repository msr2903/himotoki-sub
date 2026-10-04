import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { postJsonWithTimeout } from "./postJson";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const jsonResponse = (body: () => Promise<unknown>, ok = true, status = 200) =>
  ({ ok, status, json: body }) as unknown as Response;

describe("postJsonWithTimeout (#162)", () => {
  it("returns the parsed body and clears its timer", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(async () => ({ result: 1, error: null })));
    await expect(postJsonWithTimeout("http://x", { a: 1 }, 1000, fetchImpl as unknown as typeof fetch)).resolves.toEqual({ result: 1, error: null });
    expect(vi.getTimerCount()).toBe(0);
    const init = fetchImpl.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("times out and aborts when response headers never arrive", async () => {
    let signal: AbortSignal | undefined;
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => {});
    });
    const result = postJsonWithTimeout("http://x", {}, 1000, fetchImpl as unknown as typeof fetch);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toEqual({ error: "No response within 1 s", timeout: true });
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out when the body never finishes", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(() => new Promise(() => {})));
    const result = postJsonWithTimeout("http://x", {}, 1000, fetchImpl);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toMatchObject({ timeout: true });
  });

  it("reports network and HTTP failures without the timeout flag", async () => {
    const failing = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(postJsonWithTimeout("http://x", {}, 1000, failing)).resolves.toEqual({ error: "Failed to fetch" });
    const forbidden = vi.fn(async () => jsonResponse(async () => ({}), false, 403));
    await expect(postJsonWithTimeout("http://x", {}, 1000, forbidden)).resolves.toEqual({ error: "HTTP error! status: 403" });
    expect(vi.getTimerCount()).toBe(0);
  });
});
