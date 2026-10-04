import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDictStatusPoller, DICT_POLL_MAX_MS, nextDictPollDelay, type DictStatus } from "./dictPolling";

const status = (state: DictStatus["state"]): DictStatus => ({
  state,
  received: 0,
  total: 0,
  error: "",
  revision: "",
  title: "",
  terms: 0,
  bytes: 0,
});

type Reply = { ok: boolean; data?: unknown; error?: string };

function setup() {
  const pending: Array<{ resolve: (r: Reply) => void; reject: (e: Error) => void }> = [];
  const request = vi.fn(() => new Promise<Reply>((resolve, reject) => pending.push({ resolve, reject })));
  const statuses: DictStatus[] = [];
  const errors: Array<string | null> = [];
  const poller = createDictStatusPoller({
    request,
    onStatus: (s) => statuses.push(s),
    onError: (e) => errors.push(e),
  });
  return { poller, request, pending, statuses, errors };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("nextDictPollDelay", () => {
  it("polls while busy or an install is pending, stops on a final state, backs off on failure", () => {
    expect(nextDictPollDelay({ status: status("downloading"), failed: false, failures: 0, installPending: false })).toBe(500);
    expect(nextDictPollDelay({ status: status("missing"), failed: false, failures: 0, installPending: true })).toBe(500);
    expect(nextDictPollDelay({ status: status("ready"), failed: false, failures: 0, installPending: false })).toBeNull();
    expect(nextDictPollDelay({ status: status("downloading"), failed: true, failures: 1, installPending: false })).toBe(1000);
    expect(nextDictPollDelay({ status: null, failed: true, failures: 20, installPending: false })).toBe(DICT_POLL_MAX_MS);
  });
});

describe("dictionary status poller", () => {
  it("does not start polling when the first busy reply arrives after disposal (#118)", async () => {
    const { poller, request, pending, statuses } = setup();
    void poller.refresh();
    poller.dispose();
    pending[0]!.resolve({ ok: true, data: status("downloading") });
    await vi.advanceTimersByTimeAsync(5000);
    expect(request).toHaveBeenCalledTimes(1);
    expect(statuses).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops polling once disposed mid-download (#118)", async () => {
    const { poller, request, pending } = setup();
    void poller.refresh();
    pending[0]!.resolve({ ok: true, data: status("downloading") });
    await vi.advanceTimersByTimeAsync(500);
    expect(request).toHaveBeenCalledTimes(2);
    poller.dispose();
    pending[1]!.resolve({ ok: true, data: status("downloading") });
    await vi.advanceTimersByTimeAsync(5000);
    expect(request).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps polling through a transient status error and recovers to Ready (#146)", async () => {
    const { poller, request, pending, statuses, errors } = setup();
    void poller.refresh();
    pending[0]!.resolve({ ok: true, data: status("downloading") });
    await vi.advanceTimersByTimeAsync(500);
    pending[1]!.resolve({ ok: false, error: "temporarily unavailable" });
    await vi.advanceTimersByTimeAsync(0);
    expect(errors.at(-1)).toBe("temporarily unavailable");
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(request).toHaveBeenCalledTimes(3);
    pending[2]!.reject(new Error("Extension context invalidated"));
    await vi.advanceTimersByTimeAsync(2000);
    expect(errors.at(-1)).toBe("Extension context invalidated");
    expect(request).toHaveBeenCalledTimes(4);
    pending[3]!.resolve({ ok: true, data: status("ready") });
    await vi.advanceTimersByTimeAsync(0);
    expect(statuses.at(-1)!.state).toBe("ready");
    expect(errors.at(-1)).toBeNull();
    await vi.advanceTimersByTimeAsync(10000);
    expect(request).toHaveBeenCalledTimes(4);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps polling while an install request is pending even if the worker still says missing", async () => {
    const { poller, request, pending } = setup();
    void poller.refresh();
    pending[0]!.resolve({ ok: true, data: status("missing") });
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(0);
    poller.setInstallPending(true);
    await vi.advanceTimersByTimeAsync(500);
    pending[1]!.resolve({ ok: true, data: status("missing") });
    await vi.advanceTimersByTimeAsync(500);
    expect(request).toHaveBeenCalledTimes(3);
    poller.setInstallPending(false);
    pending[2]!.resolve({ ok: true, data: status("ready") });
    await vi.advanceTimersByTimeAsync(5000);
    expect(request).toHaveBeenCalledTimes(3);
  });
});
