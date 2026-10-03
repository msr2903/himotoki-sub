/**
 * Where the dictionary worker runs. Chrome hosts it in an offscreen document (MV3 service workers
 * cannot start workers). Firefox has no chrome.offscreen, but its background is an event page that
 * can start the worker itself. With neither, the dictionary is reported as unsupported instead of
 * every request failing with a TypeError.
 */
export type DictHost = "offscreen" | "background" | "unsupported";

export function detectDictHost(env: { offscreen?: { createDocument?: unknown }; Worker?: unknown }): DictHost {
  if (typeof env.offscreen?.createDocument === "function") return "offscreen";
  if (typeof env.Worker === "function") return "background";
  return "unsupported";
}

export const DICT_UNSUPPORTED_MESSAGE =
  "The offline dictionary cannot run in this browser, so word lookups are unavailable.";

/** Reply for a dictionary op when no host is available, shaped like the worker's own replies. */
export function unsupportedDictReply(
  op: string,
  payload: Record<string, unknown>,
): { ok: boolean; data?: unknown; error?: string } {
  switch (op) {
    case "status":
      return {
        ok: true,
        data: { state: "unsupported", received: 0, total: 0, error: "", revision: "", title: "", terms: 0, bytes: 0, verified: "" },
      };
    case "lookup":
    case "lookupBatch":
    case "conjTable":
      return { ok: true, data: { available: false } };
    case "repair":
      return { ok: true, data: { available: false, cues: Array.isArray(payload.cues) ? payload.cues : [] } };
    default:
      return { ok: false, error: DICT_UNSUPPORTED_MESSAGE };
  }
}
