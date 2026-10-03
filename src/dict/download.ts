/**
 * Pure helpers for the dictionary download stream (used by the dictionary worker).
 *
 * ReadableStream chunk boundaries are arbitrary, so the file type must be decided from enough
 * accumulated bytes rather than from whatever the first read() happened to return.
 */

/** Bytes needed to recognise both formats: gzip magic is 2 bytes, the SQLite header string is 16. */
export const DICT_HEADER_BYTES = 16;

export type DictPayloadKind = "empty" | "gzip" | "sqlite" | "html" | "unknown";

const SQLITE_MAGIC = "SQLite format 3\u0000";

/** Classify a download from its leading bytes (pass at least DICT_HEADER_BYTES unless the body was shorter). */
export function classifyDictHeader(head: Uint8Array): DictPayloadKind {
  if (!head.length) return "empty";
  if (head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b) return "gzip";
  if (head.length >= SQLITE_MAGIC.length) {
    let sqlite = true;
    for (let i = 0; i < SQLITE_MAGIC.length; i++) {
      if (head[i] !== SQLITE_MAGIC.charCodeAt(i)) {
        sqlite = false;
        break;
      }
    }
    if (sqlite) return "sqlite";
  }
  return head[0] === 0x3c ? "html" : "unknown"; // '<'
}

/**
 * Read chunks until at least `minBytes` have arrived or the stream ends. The chunks are returned
 * unmodified so they can be replayed exactly once, followed by the rest of the reader.
 */
export async function readStreamHeader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  minBytes = DICT_HEADER_BYTES,
): Promise<{ chunks: Uint8Array[]; head: Uint8Array; done: boolean }> {
  const chunks: Uint8Array[] = [];
  let length = 0;
  let done = false;
  while (length < minBytes) {
    const next = await reader.read();
    if (next.done) {
      done = true;
      break;
    }
    if (next.value?.byteLength) {
      chunks.push(next.value);
      length += next.value.byteLength;
    }
  }
  const head = new Uint8Array(Math.min(length, minBytes));
  let offset = 0;
  for (const chunk of chunks) {
    if (offset >= head.length) break;
    const part = chunk.subarray(0, head.length - offset);
    head.set(part, offset);
    offset += part.length;
  }
  return { chunks, head, done };
}

/** A stream that yields `chunks` first, then the remainder of `reader` (cancel propagates to it). */
export function replayStream(
  chunks: Uint8Array[],
  reader: ReadableStreamDefaultReader<Uint8Array>,
  done: boolean,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      if (done) controller.close();
    },
    async pull(controller) {
      const next = await reader.read();
      if (next.done) controller.close();
      else if (next.value) controller.enqueue(next.value);
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });
}
