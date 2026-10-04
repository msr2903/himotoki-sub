import { describe, expect, it } from "vitest";
import { classifyDictHeader, readStreamHeader, replayStream } from "./download";

const sqliteHeader = new TextEncoder().encode("SQLite format 3\u0000rest-of-page");

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<number[]> {
  const out: number[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return out;
    out.push(...value);
  }
}

describe("classifyDictHeader", () => {
  it("recognises gzip, SQLite, HTML, empty and unknown payloads", () => {
    expect(classifyDictHeader(new Uint8Array([0x1f, 0x8b, 8]))).toBe("gzip");
    expect(classifyDictHeader(sqliteHeader)).toBe("sqlite");
    expect(classifyDictHeader(new TextEncoder().encode("<!doctype html>"))).toBe("html");
    expect(classifyDictHeader(new Uint8Array())).toBe("empty");
    expect(classifyDictHeader(new Uint8Array([0x1f]))).toBe("unknown");
    expect(classifyDictHeader(sqliteHeader.subarray(0, 15))).toBe("unknown");
  });
});

describe("readStreamHeader + replayStream", () => {
  it.each([[[1]], [[2]], [[1, 1, 1]], [[15]], [[16]], [[]]])(
    "accumulates the header across leading chunks %j and replays every byte once",
    async (splits) => {
      const chunks: Uint8Array[] = [];
      let offset = 0;
      for (const size of splits) {
        chunks.push(sqliteHeader.slice(offset, offset + size));
        offset += size;
      }
      chunks.push(sqliteHeader.slice(offset));
      const reader = streamOf(chunks).getReader();
      const header = await readStreamHeader(reader);
      expect(classifyDictHeader(header.head)).toBe("sqlite");
      expect(await collect(replayStream(header.chunks, reader, header.done))).toEqual([...sqliteHeader]);
    },
  );

  it("stops at end of stream for short bodies", async () => {
    const reader = streamOf([new Uint8Array([0x1f]), new Uint8Array([0x8b])]).getReader();
    const header = await readStreamHeader(reader);
    expect(header.done).toBe(true);
    expect([...header.head]).toEqual([0x1f, 0x8b]);
    expect(await collect(replayStream(header.chunks, reader, header.done))).toEqual([0x1f, 0x8b]);
  });

  it("handles an empty body", async () => {
    const reader = streamOf([]).getReader();
    const header = await readStreamHeader(reader);
    expect(header.done).toBe(true);
    expect(classifyDictHeader(header.head)).toBe("empty");
  });
});
