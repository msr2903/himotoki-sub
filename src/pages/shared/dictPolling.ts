/**
 * Dictionary status polling for DictionaryPanel, kept free of React and chrome.* so its lifecycle
 * (disposal, transient failures, install in flight) can be unit tested.
 */

export type DictState = "booting" | "missing" | "downloading" | "importing" | "ready" | "error" | "unsupported";

export type DictStatus = {
  state: DictState;
  received: number;
  total: number;
  error: string;
  revision: string;
  title: string;
  terms: number;
  bytes: number;
  verified?: "ok" | "skipped" | "";
};

export const DICT_POLL_MS = 500;
export const DICT_POLL_MAX_MS = 8000;

export const isDictBusy = (s: DictStatus | null | undefined) =>
  s?.state === "downloading" || s?.state === "importing" || s?.state === "booting";

/**
 * Delay before the next status poll, or null to stop. Polling stops only on an observed non-busy
 * state; a failed status request is retried with bounded exponential backoff instead.
 */
export function nextDictPollDelay(opts: {
  status: DictStatus | null;
  failed: boolean;
  failures: number;
  installPending: boolean;
}): number | null {
  if (opts.failed) return Math.min(DICT_POLL_MAX_MS, DICT_POLL_MS * 2 ** Math.max(0, opts.failures));
  if (opts.installPending || isDictBusy(opts.status)) return DICT_POLL_MS;
  return null;
}

type StatusReply = { ok?: boolean; data?: unknown; error?: string } | undefined;

export type DictStatusPoller = {
  /** Fetch the status now; keep polling while it is busy (or the request failed). */
  refresh: () => Promise<DictStatus | null>;
  /** While an install request from this page is in flight, keep polling even before the worker reports busy. */
  setInstallPending: (pending: boolean) => void;
  /** Stop all polling; replies that arrive later are ignored. */
  dispose: () => void;
};

export function createDictStatusPoller(deps: {
  request: () => Promise<StatusReply>;
  onStatus: (status: DictStatus) => void;
  /** Status-request error message, or null once a request succeeds again. */
  onError: (message: string | null) => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}): DictStatusPoller {
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((timer) => clearTimeout(timer as ReturnType<typeof setTimeout>));
  let disposed = false;
  let timer: unknown = null;
  let failures = 0;
  let installPending = false;
  let last: DictStatus | null = null;

  const cancelTimer = () => {
    if (timer != null) clearTimer(timer);
    timer = null;
  };
  const schedule = (delay: number | null) => {
    cancelTimer();
    if (disposed || delay == null) return;
    timer = setTimer(() => {
      timer = null;
      void refresh();
    }, delay);
  };

  const refresh = async (): Promise<DictStatus | null> => {
    if (disposed) return null;
    let reply: StatusReply;
    let failure: string | null = null;
    try {
      reply = await deps.request();
      if (!reply?.ok) failure = reply?.error || "Could not reach the dictionary worker";
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    if (disposed) return null;
    if (failure != null) {
      failures += 1;
      deps.onError(failure);
      schedule(nextDictPollDelay({ status: last, failed: true, failures, installPending }));
      return null;
    }
    failures = 0;
    last = reply!.data as DictStatus;
    deps.onStatus(last);
    deps.onError(null);
    schedule(nextDictPollDelay({ status: last, failed: false, failures, installPending }));
    return last;
  };

  return {
    refresh,
    setInstallPending(pending) {
      installPending = pending;
      if (pending && timer == null) schedule(DICT_POLL_MS);
    },
    dispose() {
      disposed = true;
      cancelTimer();
    },
  };
}
