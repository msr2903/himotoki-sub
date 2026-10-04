/**
 * Offscreen document: hosts onnxruntime-web (Himotoki split model) and the SQLite dictionary worker.
 */
import { split, resetModelCache } from "@src/split";
import { dictCall } from "./dictBridge";

let ready: Promise<void> | null = null;
// onnxruntime-web rejects overlapping run() calls on one session ("Session already started"),
// so inference must be sequential — not just within one batch message but across all messages
// (cue-at-a-time services, delay resyncs and multiple tabs all overlap). Serialize every split
// and the model warmup through one module-level promise chain. Inference is ~2 ms per cue, so
// this is not a bottleneck.
const BATCH_CONCURRENCY = 1;

let inferenceChain: Promise<unknown> = Promise.resolve();
const runExclusive = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = inferenceChain.then(fn, fn);
  inferenceChain = run;
  return run;
};

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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "offscreen-split") return false;

  if (message.type === "himotokiSplitPing") {
    sendResponse({ ok: true, data: "pong" });
    return false;
  }

  if (message.type === "himotokiSplit") {
    void (async () => {
      try {
        const result = await runExclusive(async () => {
          await ensureReady();
          return split(String(message.text ?? ""));
        });
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
        const texts: string[] = Array.isArray(message.texts) ? message.texts : [];
        // Warmup goes through the chain too, so a concurrent message's warmup split can't overlap
        // another batch's items.
        await runExclusive(() => ensureReady());
        const results = await mapPool(texts, BATCH_CONCURRENCY, (text) =>
          runExclusive(() => split(String(text ?? ""))),
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
