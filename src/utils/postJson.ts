/**
 * JSON POST with an application deadline, used by the background for AnkiConnect. The deadline
 * covers the whole request (headers and body) and aborts the real network request when it
 * expires, so a stalled local server cannot leave a save pending forever.
 */
export const POST_TIMEOUT_MS = 15000;

/** Failure reply in the same `{ error }` shape AnkiConnect uses; `timeout` marks an expired deadline. */
export type PostFailure = { error: string; timeout?: true };

export const postJsonWithTimeout = async (
  url: string,
  data: unknown,
  timeoutMs: number = POST_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("timeout"));
    }, timeoutMs);
  });
  const request = (async () => {
    const resp = await fetchImpl(url, { method: "POST", body: JSON.stringify(data), signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
    return resp.json();
  })();
  // The losing side of the race must not surface as an unhandled rejection.
  request.catch(() => undefined);
  try {
    return await Promise.race([request, expired]);
  } catch (error) {
    if (controller.signal.aborted) {
      return { error: `No response within ${Math.round(timeoutMs / 1000)} s`, timeout: true } satisfies PostFailure;
    }
    return { error: error instanceof Error ? error.message : String(error) } satisfies PostFailure;
  } finally {
    clearTimeout(timer);
  }
};
