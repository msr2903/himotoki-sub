import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

// Runs the real dictionary worker against real SQLite files (node:sqlite). Only the OPFS SAH pool
// is replaced, by a memory-backed adapter that opens each stored file as a real database.

type NativeDb = {
  exec: (sql: string) => void;
  prepare: (sql: string) => { all: (...params: unknown[]) => unknown[] };
  close: () => void;
};
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => NativeDb;
};

const env = vi.hoisted(() => ({ pool: null as unknown }));
vi.mock("@sqlite.org/sqlite-wasm", () => ({
  default: async () => ({ installOpfsSAHPoolVfs: async () => env.pool }),
}));

const MAIN = "/jitendex-lite.sqlite";
const STAGE = "/jitendex-lite.tmp.sqlite";

let tempDir = "";
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  tempDir = mkdtempSync(join(tmpdir(), "himotoki-dict-worker-"));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
  rmSync(tempDir, { recursive: true, force: true });
});

function sqliteFile(kind: "valid" | "incompatible", revision = "old"): Uint8Array {
  const path = join(tempDir, `fixture-${Math.random()}.sqlite`);
  const db = new DatabaseSync(path);
  db.exec(
    kind === "valid"
      ? `CREATE TABLE meta(key TEXT, value TEXT);
         INSERT INTO meta VALUES('revision', '${revision}');
         CREATE TABLE term(id INTEGER PRIMARY KEY, expression TEXT, reading TEXT, def_tags TEXT, rules TEXT,
           score INTEGER, sequence INTEGER, term_tags TEXT, glossary_json TEXT, expression_raw TEXT,
           pitch TEXT, freq INTEGER, jlpt TEXT);
         INSERT INTO term VALUES(1, '猫', 'ねこ', '', 'n', 100, 1467640, '', '["cat"]', '猫', '[]', 1, '[]');`
      : "CREATE TABLE unrelated(value TEXT);",
  );
  db.close();
  return new Uint8Array(readFileSync(path));
}

const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const same = (a: Uint8Array | undefined, b: Uint8Array) => Boolean(a) && Buffer.from(a!).equals(Buffer.from(b));

function memoryPool(files: Map<string, Uint8Array>, opts: { failImport?: (name: string, attempt: number) => boolean } = {}) {
  const attempts = new Map<string, number>();
  return {
    getFileNames: () => [...files.keys()],
    getCapacity: () => 4,
    addCapacity: async () => 4,
    unlink: (name: string) => files.delete(name),
    exportFile: (name: string) => files.get(name)!,
    importDb: async (name: string, read: () => Promise<Uint8Array | undefined>) => {
      const attempt = (attempts.get(name) ?? 0) + 1;
      attempts.set(name, attempt);
      const chunks: Uint8Array[] = [];
      for (;;) {
        const chunk = await read();
        if (!chunk) break;
        chunks.push(chunk);
      }
      if (opts.failImport?.(name, attempt)) {
        files.delete(name);
        throw new Error("QuotaExceededError: simulated");
      }
      files.set(name, new Uint8Array(Buffer.concat(chunks)));
      return files.get(name)!.length;
    },
    OpfsSAHPoolDb: class {
      native: NativeDb;
      constructor(name: string) {
        const path = join(tempDir, `${Math.random()}.sqlite`);
        writeFileSync(path, files.get(name)!);
        this.native = new DatabaseSync(path);
      }
      exec({ sql, bind, rowMode }: { sql: string; bind?: unknown[]; rowMode?: string }) {
        if (rowMode) return this.native.prepare(sql).all(...(bind ?? []));
        this.native.exec(sql);
        return undefined;
      }
      close() {
        this.native.close();
      }
    },
  };
}

type Reply = { id: number; ok: boolean; data?: Record<string, any>; error?: string };

async function bootWorker(files: Map<string, Uint8Array>, opts: Parameters<typeof memoryPool>[1] = {}) {
  env.pool = memoryPool(files, opts);
  const replies: Reply[] = [];
  const worker: { postMessage: (r: Reply) => void; onmessage?: (e: { data: Record<string, unknown> }) => Promise<void> } = {
    postMessage: (r) => replies.push(r),
  };
  vi.stubGlobal("self", worker);
  await import("./dict.worker");
  let id = 0;
  const send = async (data: Record<string, unknown>): Promise<Reply> => {
    const myId = ++id;
    await worker.onmessage!({ data: { id: myId, ...data } });
    return replies.find((r) => r.id === myId)!;
  };
  return { send, replies };
}

/** fetch stub serving `body` split into the given leading chunk sizes, then the rest. */
function serve(body: Uint8Array, splits: number[] = []) {
  return vi.fn(async (_url: string, init?: { signal?: AbortSignal }) => {
    init?.signal?.throwIfAborted();
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          let offset = 0;
          for (const size of splits) {
            controller.enqueue(body.slice(offset, offset + size));
            offset += size;
          }
          if (offset < body.length) controller.enqueue(body.slice(offset));
          controller.close();
        },
      }),
    );
  });
}

describe("dictionary update keeps the working dictionary (#106)", () => {
  it("rejects a checksum-valid but incompatible update without touching the installed file", async () => {
    const old = sqliteFile("valid");
    const wrong = sqliteFile("incompatible");
    const files = new Map([[MAIN, old]]);
    const { send } = await bootWorker(files);
    expect((await send({ op: "status" })).data!.state).toBe("ready");
    vi.stubGlobal("fetch", serve(wrong));

    const install = await send({ op: "install", url: "https://dict.test/x", expectedSha256: sha(wrong) });
    expect(install.ok).toBe(false);
    expect(install.error).toContain("no such table: meta");
    expect(same(files.get(MAIN), old)).toBe(true);
    expect(files.has(STAGE)).toBe(false);
    const status = (await send({ op: "status" })).data!;
    expect(status.state).toBe("ready");
    expect(status.revision).toBe("old");
    expect((await send({ op: "lookup", surface: "猫" })).data!.best.seq).toBe(1467640);
  });

  it("swaps in a valid update and removes the staged copy", async () => {
    const files = new Map([[MAIN, sqliteFile("valid", "old")]]);
    const { send } = await bootWorker(files);
    const next = sqliteFile("valid", "new");
    vi.stubGlobal("fetch", serve(next));
    const install = await send({ op: "install", url: "https://dict.test/x", expectedSha256: sha(next) });
    expect(install.ok).toBe(true);
    expect(install.data!.state).toBe("ready");
    expect(install.data!.revision).toBe("new");
    expect(same(files.get(MAIN), next)).toBe(true);
    expect(files.has(STAGE)).toBe(false);
    expect((await send({ op: "lookup", surface: "猫" })).data!.available).toBe(true);
  });

  it("keeps serving the verified staged copy when the copy into place fails, and promotes it on next boot", async () => {
    const files = new Map([[MAIN, sqliteFile("valid", "old")]]);
    const next = sqliteFile("valid", "new");
    const { send } = await bootWorker(files, { failImport: (name) => name === MAIN });
    vi.stubGlobal("fetch", serve(next));
    const install = await send({ op: "install", url: "https://dict.test/x", expectedSha256: sha(next) });
    expect(install.ok).toBe(true);
    expect(install.data!.state).toBe("ready");
    expect(install.data!.revision).toBe("new");
    expect(files.has(MAIN)).toBe(false);
    expect(same(files.get(STAGE), next)).toBe(true);
    expect((await send({ op: "lookup", surface: "猫" })).data!.available).toBe(true);

    vi.resetModules();
    const rebooted = await bootWorker(files);
    const status = (await rebooted.send({ op: "status" })).data!;
    expect(status.state).toBe("ready");
    expect(status.revision).toBe("new");
    expect(same(files.get(MAIN), next)).toBe(true);
    expect(files.has(STAGE)).toBe(false);
  });

  it("drops a stale partial download found next to a working dictionary at boot", async () => {
    const old = sqliteFile("valid", "old");
    const files = new Map([
      [MAIN, old],
      [STAGE, new Uint8Array([1, 2, 3])],
    ]);
    const { send } = await bootWorker(files);
    expect((await send({ op: "status" })).data!.state).toBe("ready");
    expect(files.has(STAGE)).toBe(false);
    expect(same(files.get(MAIN), old)).toBe(true);
  });

  it("reports an error (not Ready) when a first install is incompatible, and leaves no files", async () => {
    const files = new Map<string, Uint8Array>();
    const { send } = await bootWorker(files);
    expect((await send({ op: "status" })).data!.state).toBe("missing");
    const wrong = sqliteFile("incompatible");
    vi.stubGlobal("fetch", serve(wrong));
    const install = await send({ op: "install", url: "https://dict.test/x", expectedSha256: sha(wrong) });
    expect(install.ok).toBe(false);
    const status = (await send({ op: "status" })).data!;
    expect(status.state).toBe("error");
    expect(status.error).toContain("no such table: meta");
    expect(files.size).toBe(0);
    expect((await send({ op: "lookup", surface: "猫" })).data!.available).toBe(false);
  });
});

describe("dictionary download header detection (#109)", () => {
  it.each([
    ["raw", [1]],
    ["raw", [2]],
    ["raw", [15]],
    ["raw", [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]],
    ["raw", []],
    ["gzip", [1]],
    ["gzip", [2]],
    ["gzip", [15]],
    ["gzip", []],
  ] as const)("installs a %s download whose leading chunks are %j bytes", async (format, splits) => {
    const files = new Map<string, Uint8Array>();
    const { send } = await bootWorker(files);
    const raw = sqliteFile("valid", "chunked");
    const body = format === "gzip" ? new Uint8Array(gzipSync(raw)) : raw;
    vi.stubGlobal("fetch", serve(body, [...splits]));
    const install = await send({ op: "install", url: "https://dict.test/x", expectedSha256: sha(raw) });
    expect(install.error).toBeUndefined();
    expect(install.data!.state).toBe("ready");
    expect(same(files.get(MAIN), raw)).toBe(true);
    expect((await send({ op: "lookup", surface: "猫" })).data!.best.seq).toBe(1467640);
  });

  it.each([
    ["an empty body", new Uint8Array(0), "dictionary download was empty"],
    ["an HTML page", new TextEncoder().encode("<!doctype html><html></html>"), "HTML page"],
    ["a short non-dictionary body", new Uint8Array([0x1f]), "neither gzip nor a SQLite database"],
    ["garbage", new TextEncoder().encode("hello world, not a dictionary file"), "neither gzip nor a SQLite database"],
  ])("rejects %s", async (_label, body, message) => {
    const files = new Map<string, Uint8Array>();
    const { send } = await bootWorker(files);
    vi.stubGlobal("fetch", serve(body, [1]));
    const install = await send({ op: "install", url: "https://dict.test/x" });
    expect(install.ok).toBe(false);
    expect(install.error).toContain(message);
    expect(files.size).toBe(0);
  });
});

describe("remove versus an in-flight install (#112)", () => {
  /** fetch that waits for release() and honours AbortSignal like the browser's fetch. */
  function heldFetch() {
    let release!: (body: Uint8Array) => void;
    const body = new Promise<Uint8Array>((resolve) => (release = resolve));
    const fetcher = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          void body.then((bytes) => resolve(new Response(bytes)));
        }),
    );
    return { fetcher, release };
  }

  it("a removal during an update cannot be undone by the download finishing", async () => {
    const files = new Map([[MAIN, sqliteFile("valid", "old")]]);
    const { send } = await bootWorker(files);
    const { fetcher, release } = heldFetch();
    vi.stubGlobal("fetch", fetcher);
    const next = sqliteFile("valid", "new");
    const install = send({ op: "install", url: "https://dict.test/x", expectedSha256: sha(next) });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalled());

    const removed = await send({ op: "remove" });
    expect(removed.data!.state).toBe("missing");
    expect(files.size).toBe(0);
    release(next);
    const installed = await install;
    expect(installed.ok).toBe(false);
    expect(installed.error).toContain("cancelled");
    expect(files.size).toBe(0);
    expect((await send({ op: "status" })).data!.state).toBe("missing");
    expect((await send({ op: "lookup", surface: "猫" })).data!.available).toBe(false);
  });

  it("a removal that arrives after the download completes still wins", async () => {
    const files = new Map<string, Uint8Array>();
    const { send } = await bootWorker(files);
    // A fetch that ignores the abort signal: removal must still serialize behind the install.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const next = sqliteFile("valid", "new");
    vi.stubGlobal("fetch", vi.fn(async () => (await gate, new Response(next))));
    const install = send({ op: "install", url: "https://dict.test/x" });
    await Promise.resolve();
    const removed = send({ op: "remove" });
    release();
    const [installed, removal] = await Promise.all([install, removed]);
    expect(installed.ok).toBe(false);
    expect(removal.data!.state).toBe("missing");
    expect(files.size).toBe(0);
  });

  it("an install requested after Remove works normally", async () => {
    const files = new Map([[MAIN, sqliteFile("valid", "old")]]);
    const { send } = await bootWorker(files);
    expect((await send({ op: "remove" })).data!.state).toBe("missing");
    const next = sqliteFile("valid", "fresh");
    vi.stubGlobal("fetch", serve(next));
    const install = await send({ op: "install", url: "https://dict.test/x", expectedSha256: sha(next) });
    expect(install.data!.state).toBe("ready");
    expect(install.data!.revision).toBe("fresh");
  });

  it("a failed fetch after Remove does not resurrect anything", async () => {
    const files = new Map([[MAIN, sqliteFile("valid", "old")]]);
    const { send } = await bootWorker(files);
    await send({ op: "remove" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));
    const install = await send({ op: "install", url: "https://dict.test/x" });
    expect(install.ok).toBe(false);
    expect(files.size).toBe(0);
    expect((await send({ op: "status" })).data!.state).toBe("error");
  });
});
