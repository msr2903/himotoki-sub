/**
 * Offscreen document: hosts onnxruntime-web (Himotoki split model) and the SQLite dictionary worker.
 */
import { split, resetModelCache } from "@src/split";

let ready: Promise<void> | null = null;
// onnxruntime-web rejects overlapping run() calls on one session ("Session already started"),
// so batches must be sequential. Inference is ~2 ms per cue, so this is not a bottleneck.
const BATCH_CONCURRENCY = 1;

async function ensureReady(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await split("テスト");
    })().catch((error) => {
      // Allow retries after a failed WASM/model load.
      ready = null;
      resetModelCache();
      throw error;
    });
  }
  await ready;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) || 1 }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  });

  await Promise.all(workers);
  return results;
}

/* ---------------- dictionary worker bridge ---------------- */

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

function dictCall(op: string, payload: Record<string, unknown>): Promise<unknown> {
  const id = ++dictSeq;
  return new Promise((resolve, reject) => {
    dictPending.set(id, { resolve, reject });
    getDictWorker().postMessage({
      id,
      op,
      wasmUrl: chrome.runtime.getURL("sqlite/sqlite3.wasm"),
      ...payload,
    });
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "offscreen-split") return false;

  if (message.type === "himotokiSplitPing") {
    sendResponse({ ok: true, data: "pong" });
    return false;
  }

  if (message.type === "himotokiSplit") {
    void (async () => {
      try {
        await ensureReady();
        const result = await split(String(message.text ?? ""));
        sendResponse({ ok: true, data: result });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  }

  if (message.type === "himotokiSplitBatch") {
    void (async () => {
      try {
        await ensureReady();
        const texts: string[] = Array.isArray(message.texts) ? message.texts : [];
        const results = await mapPool(texts, BATCH_CONCURRENCY, (text) =>
          split(String(text ?? "")),
        );
        sendResponse({ ok: true, data: results });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  }

  if (message.type === "himotokiDict") {
    void (async () => {
      try {
        const { op, ...payload } = message as { op: string } & Record<string, unknown>;
        delete (payload as Record<string, unknown>).target;
        delete (payload as Record<string, unknown>).type;
        const data = await dictCall(op, payload);
        sendResponse({ ok: true, data });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return true;
  }

  return false;
});
