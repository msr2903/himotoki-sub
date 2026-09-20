/// <reference lib="webworker" />
/**
 * Dictionary worker: hosts SQLite (WebAssembly) over an OPFS-backed Jitendex database and
 * answers lookup / repair requests from the offscreen document. Workers have no chrome.* APIs,
 * so URLs are passed in by the caller.
 */
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { Dictionary, type LookupResult } from "@src/dict/lookup";
import { Sha256 } from "@src/dict/sha256";

type DictState = "booting" | "missing" | "downloading" | "importing" | "ready" | "error";

export type DictStatus = {
  state: DictState;
  received: number;
  total: number;
  error: string;
  revision: string;
  title: string;
  terms: number;
  bytes: number;
  /** "ok" when the installed file matched the manifest sha256, "skipped" when no manifest was available. */
  verified: "ok" | "skipped" | "";
};

const DB_FILE = "/jitendex-lite.sqlite";
// A new dictionary is downloaded here first, then swapped into DB_FILE only once verified, so a
// failed/aborted update never destroys the dictionary the user already had installed.
const DB_TMP = "/jitendex-lite.tmp.sqlite";
const VFS_NAME = "himotoki-dict";
const VFS_DIR = ".himotoki-dict";

// Types for the parts of the sqlite3 API we use; the package's own typings are loosely structured.
type Sqlite3Db = {
  exec: (opts: { sql: string; bind?: unknown[]; rowMode?: string; returnValue?: string }) => unknown;
  close: () => void;
};
type PoolUtil = {
  OpfsSAHPoolDb: new (filename: string) => Sqlite3Db;
  importDb: (name: string, data: () => Promise<Uint8Array | undefined>) => Promise<number>;
  exportFile: (name: string) => Uint8Array;
  getFileNames: () => string[];
  unlink: (name: string) => boolean;
  getCapacity: () => number;
  addCapacity: (n: number) => Promise<number>;
};

let poolUtil: PoolUtil | null = null;
let db: Sqlite3Db | null = null;
let dict: Dictionary | null = null;
let vfsPromise: Promise<void> | null = null;
let bootPromise: Promise<void> | null = null;
let installing: Promise<void> | null = null;

const status: DictStatus = {
  state: "booting",
  received: 0,
  total: 0,
  error: "",
  revision: "",
  title: "",
  terms: 0,
  bytes: 0,
  verified: "",
};

function query(sql: string, params: unknown[] = []): Array<Record<string, unknown>> {
  if (!db) throw new Error("dictionary database is not open");
  return db.exec({ sql, bind: params, rowMode: "object", returnValue: "resultRows" }) as Array<
    Record<string, unknown>
  >;
}

// Bring up the OPFS VFS. This is the part that install/remove genuinely require; it is kept separate
// from opening an existing DB so a corrupt DB (below) cannot prevent re-downloading or deleting it.
async function ensureVfs(): Promise<void> {
  if (!vfsPromise) {
    vfsPromise = (async () => {
      // The bundler build resolves sqlite3.wasm relative to the worker script itself (Vite emits it as
      // an asset); passing a custom Emscripten config here breaks the one-shot API bootstrap.
      // The API bootstrap merges globalThis.sqlite3ApiConfig over its defaults; in the bundled
      // build the logging defaults are missing, which crashes with "reading 'bind'" otherwise.
      (globalThis as unknown as Record<string, unknown>).sqlite3ApiConfig = {
        debug: () => undefined,
        log: () => undefined,
        warn: (...args: unknown[]) => console.warn("[himotoki-dict]", ...args),
        error: (...args: unknown[]) => console.error("[himotoki-dict]", ...args),
      };
      const sqlite3 = (await sqlite3InitModule()) as unknown as Record<string, unknown>;
      const install = (sqlite3 as { installOpfsSAHPoolVfs: (o: Record<string, unknown>) => Promise<PoolUtil> })
        .installOpfsSAHPoolVfs;
      poolUtil = await install.call(sqlite3, { name: VFS_NAME, directory: VFS_DIR, initialCapacity: 4 });
    })().catch((error) => {
      vfsPromise = null;
      status.state = "error";
      status.error = error instanceof Error ? error.message : String(error);
      throw error;
    });
  }
  await vfsPromise;
}

async function boot(): Promise<void> {
  if (!bootPromise) {
    bootPromise = (async () => {
      await ensureVfs();
      if (poolUtil!.getFileNames().includes(DB_FILE)) {
        try {
          openDb();
        } catch (error) {
          // A corrupt or schema-incompatible DB file must NOT brick the worker: surface the error but
          // leave the VFS ready so install (re-download) and remove (delete) can still recover it.
          closeDb();
          status.state = "error";
          status.error = error instanceof Error ? error.message : String(error);
        }
      } else {
        status.state = "missing";
      }
    })().catch((error) => {
      bootPromise = null;
      status.state = "error";
      status.error = error instanceof Error ? error.message : String(error);
      throw error;
    });
  }
  await bootPromise;
}

function openDb(): void {
  if (!poolUtil) throw new Error("VFS not ready");
  db = new poolUtil.OpfsSAHPoolDb(DB_FILE);
  db.exec({ sql: "PRAGMA case_sensitive_like = ON" });
  db.exec({ sql: "PRAGMA temp_store = MEMORY" });
  const meta = Object.fromEntries(
    (query("SELECT key, value FROM meta") as Array<{ key: string; value: string }>).map((r) => [r.key, r.value]),
  );
  const count = query("SELECT COUNT(*) AS n FROM term")[0];
  const pages = query("PRAGMA page_count")[0] as Record<string, unknown> | undefined;
  const pageSize = query("PRAGMA page_size")[0] as Record<string, unknown> | undefined;
  dict = new Dictionary(query);
  status.revision = String(meta.revision ?? "");
  status.title = String(meta.title ?? "Jitendex");
  status.terms = Number(count?.n ?? 0);
  status.bytes = Number(pages?.page_count ?? 0) * Number(pageSize?.page_size ?? 0);
  status.state = "ready";
  status.error = "";
}

function closeDb(): void {
  dict = null;
  if (db) {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    db = null;
  }
}

/** Feed an already-in-memory buffer to importDb via its streaming callback (one chunk, then done). */
function bufferSource(bytes: Uint8Array): () => Promise<Uint8Array | undefined> {
  let sent = false;
  return async () => {
    if (sent) return undefined;
    sent = true;
    return bytes;
  };
}

async function install(url: string, expectedSha256?: string, expectedRevision?: string): Promise<void> {
  if (installing) return installing;
  // Tracked outside the IIFE so the .catch below knows whether a prior dictionary existed.
  let hadExisting = false;
  installing = (async () => {
    if (!poolUtil) throw new Error("VFS not ready");
    const pool = poolUtil;
    // If a dictionary is already installed, download the new one into a temp file and swap only after
    // it verifies — the old DB stays intact and usable if anything fails. A fresh install has nothing
    // to lose, so it imports straight to DB_FILE (unchanged behaviour).
    hadExisting = pool.getFileNames().includes(DB_FILE);
    const target = hadExisting ? DB_TMP : DB_FILE;
    if (!hadExisting) closeDb();
    if (pool.getFileNames().includes(DB_TMP)) pool.unlink(DB_TMP); // clear any stale temp
    status.state = "downloading";
    status.received = 0;
    status.total = 0;
    status.error = "";
    const resp = await fetch(url);
    if (!resp.ok || !resp.body) throw new Error(`dictionary download failed (${resp.status})`);
    status.total = Number(resp.headers.get("content-length") || 0);
    const counted = resp.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          status.received += chunk.byteLength;
          controller.enqueue(chunk);
        },
      }),
    );
    // Decide whether to inflate by inspecting the bytes, not the URL/headers: some servers send the
    // .gz file with `Content-Encoding: gzip`, so fetch already inflated the body — piping that through
    // DecompressionStream again throws "The compressed data was not valid: incorrect header check".
    // Peek the first chunk for the gzip magic (0x1f 0x8b) and only decompress a still-compressed body.
    const raw = counted.getReader();
    const firstChunk = await raw.read();
    const head = firstChunk.value;
    const isGzip = !!head && head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b;
    // If it's not gzip, it must already be a raw SQLite database. Detect the common misconfiguration
    // where the URL serves something else (usually an SPA index.html because the file isn't deployed)
    // and fail with an actionable message instead of the cryptic "not an SQLite3 database header".
    if (!isGzip && head && head.length) {
      const looksSqlite =
        head.length >= 16 && new TextDecoder().decode(head.subarray(0, 15)) === "SQLite format 3";
      if (!looksSqlite) {
        const contentType = resp.headers.get("content-type") || "unknown";
        const looksHtml = head[0] === 0x3c; // '<'
        throw new Error(
          looksHtml
            ? `The dictionary URL returned an HTML page (content-type: ${contentType}), not the dictionary file — it is probably not deployed at ${url}.`
            : `The dictionary URL returned data that is neither gzip nor a SQLite database (content-type: ${contentType}) at ${url}.`,
        );
      }
    }
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        if (head && head.length) controller.enqueue(head);
        if (firstChunk.done) controller.close();
      },
      async pull(controller) {
        const { done, value } = await raw.read();
        if (done) controller.close();
        else if (value) controller.enqueue(value);
      },
      cancel(reason) {
        void raw.cancel(reason);
      },
    });
    const stream = isGzip ? source.pipeThrough(new DecompressionStream("gzip")) : source;
    const reader = stream.getReader();
    // Extra capacity for the temp file during an update (temp alongside the still-present old DB).
    const wantCapacity = hadExisting ? 4 : 2;
    if (pool.getCapacity() < wantCapacity) await pool.addCapacity(wantCapacity);
    let sawData = false;
    const hasher = new Sha256();
    await pool.importDb(target, async () => {
      const { done, value } = await reader.read();
      if (done) {
        status.state = "importing";
        return undefined;
      }
      sawData = true;
      hasher.update(value);
      return value;
    });
    if (!sawData) throw new Error("dictionary download was empty");
    if (expectedSha256) {
      const digest = hasher.hex();
      if (digest !== expectedSha256.toLowerCase()) {
        throw new Error("downloaded dictionary is corrupt (checksum mismatch); please try again");
      }
      status.verified = "ok";
    } else {
      status.verified = "skipped";
    }
    if (hadExisting) {
      // Verified: replace the old DB with the temp copy. The SAH pool has no rename, so copy the
      // bytes across and drop the temp only after DB_FILE is rebuilt and opens cleanly.
      closeDb();
      const bytes = pool.exportFile(DB_TMP);
      if (pool.getFileNames().includes(DB_FILE)) pool.unlink(DB_FILE);
      await pool.importDb(DB_FILE, bufferSource(bytes));
      openDb();
      pool.unlink(DB_TMP);
    } else {
      openDb();
    }
    if (expectedRevision && status.revision && status.revision !== expectedRevision) {
      console.warn(
        "[himotoki-dict] installed dictionary revision",
        status.revision,
        "does not match expected revision",
        expectedRevision,
      );
    }
  })()
    .catch(async (error) => {
      status.state = "error";
      status.error = error instanceof Error ? error.message : String(error);
      // Never leave the user without a dictionary because an install failed.
      const pool = poolUtil;
      try {
        const files = pool?.getFileNames() ?? [];
        if (!hadExisting) {
          // A failed first install may leave a partial DB_FILE — clean it up (no prior data to lose).
          closeDb();
          if (pool && files.includes(DB_FILE)) pool.unlink(DB_FILE);
        } else if (pool && !files.includes(DB_FILE) && files.includes(DB_TMP)) {
          // The swap was interrupted after DB_FILE was removed but the verified temp survived —
          // promote it so a working dictionary remains.
          const bytes = pool.exportFile(DB_TMP);
          await pool.importDb(DB_FILE, bufferSource(bytes));
        }
        if (pool?.getFileNames().includes(DB_TMP)) pool.unlink(DB_TMP);
        // Reopen whatever valid DB remains so lookups keep working after a failed update.
        if (!db && pool?.getFileNames().includes(DB_FILE)) openDb();
        // A working dictionary survived; reflect that (the failed-update error is still delivered to
        // the caller via the rejected promise / toast).
        if (db) {
          status.state = "ready";
          status.error = "";
        }
      } catch {
        /* best-effort recovery */
      }
      throw error;
    })
    .finally(() => {
      installing = null;
    });
  return installing;
}

function remove(): void {
  closeDb();
  if (poolUtil?.getFileNames().includes(DB_FILE)) poolUtil.unlink(DB_FILE);
  if (poolUtil?.getFileNames().includes(DB_TMP)) poolUtil.unlink(DB_TMP);
  status.state = "missing";
  status.revision = "";
  status.terms = 0;
  status.bytes = 0;
  status.verified = "";
  status.error = "";
}

type Request = { id: number; op: string; url?: string; expectedSha256?: string; expectedRevision?: string; surface?: string; surfaces?: string[]; cues?: string[][]; seq?: number };

self.onmessage = async (event: MessageEvent<Request>) => {
  const msg = event.data;
  const reply = (ok: boolean, data?: unknown, error?: string) => self.postMessage({ id: msg.id, ok, data, error });
  try {
    if (msg.op !== "status") await boot();
    else await boot().catch(() => undefined);

    switch (msg.op) {
      case "status":
        reply(true, { ...status });
        return;
      case "install":
        if (!msg.url) throw new Error("missing dictionary url");
        await install(msg.url, msg.expectedSha256, msg.expectedRevision);
        reply(true, { ...status });
        return;
      case "remove":
        remove();
        reply(true, { ...status });
        return;
      case "conjTable": {
        if (!dict) {
          reply(true, { available: false });
          return;
        }
        reply(true, { available: true, forms: dict.getEntryConjugations(Number(msg.seq)) });
        return;
      }
      case "lookup": {
        if (!dict) {
          reply(true, { available: false });
          return;
        }
        const result: LookupResult = dict.lookupSegment(String(msg.surface ?? ""));
        reply(true, { available: true, ...result });
        return;
      }
      case "lookupBatch": {
        if (!dict) {
          reply(true, { available: false });
          return;
        }
        const d = dict;
        reply(true, { available: true, results: (msg.surfaces ?? []).map((s) => d.lookupSegment(s)) });
        return;
      }
      case "repair": {
        if (!dict) {
          reply(true, { available: false, cues: msg.cues ?? [] });
          return;
        }
        const d = dict;
        reply(true, { available: true, cues: (msg.cues ?? []).map((segs) => d.repairSplitSegments(segs)) });
        return;
      }
      default:
        throw new Error(`unknown op ${msg.op}`);
    }
  } catch (error) {
    const detail = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
    console.error("[himotoki-dict] op failed", msg.op, detail);
    reply(false, undefined, detail);
  }
};
