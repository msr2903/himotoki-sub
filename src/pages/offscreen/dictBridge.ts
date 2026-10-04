/**
 * Bridge to the SQLite dictionary worker (dict.worker.ts). Chrome hosts it in the offscreen
 * document; browsers without chrome.offscreen (Firefox) host it directly in the background page.
 */

let dictWorker: Worker | null = null;
let dictSeq = 0;
const dictPending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function getDictWorker(): Worker {
  if (!dictWorker) {
    dictWorker = new Worker(new URL("./dict.worker.ts", import.meta.url), { type: "module" });
    dictWorker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; data?: unknown; error?: string }>) => {
      const { id, ok, data, error } = event.data;
      const pending = dictPending.get(id);
      if (!pending) return;
      dictPending.delete(id);
      if (ok) pending.resolve(data);
      else pending.reject(new Error(error || "dictionary worker error"));
    };
    dictWorker.onerror = (event) => {
      const error = new Error(event.message || "dictionary worker crashed");
      for (const pending of dictPending.values()) pending.reject(error);
      dictPending.clear();
      dictWorker = null;
    };
  }
  return dictWorker;
}

export function dictCall(op: string, payload: Record<string, unknown>): Promise<unknown> {
  const id = ++dictSeq;
  return new Promise((resolve, reject) => {
    dictPending.set(id, { resolve, reject });
    getDictWorker().postMessage({ id, op, ...payload });
  });
}
