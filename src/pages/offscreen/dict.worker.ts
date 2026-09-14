/// <reference lib="webworker" />
/**
 * Dictionary worker: hosts SQLite (WebAssembly) over an OPFS-backed Jitendex database and
 * answers lookup / repair requests from the offscreen document. Workers have no chrome.* APIs,
 * so URLs are passed in by the caller.
 */
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { Dictionary, type LookupResult } from "@src/dict/lookup";

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
};

const DB_FILE = "/jitendex-lite.sqlite";
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
  getFileNames: () => string[];
  unlink: (name: string) => boolean;
  getCapacity: () => number;
  addCapacity: (n: number) => Promise<number>;
};

let poolUtil: PoolUtil | null = null;
let db: Sqlite3Db | null = null;
let dict: Dictionary | null = null;
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
};

function query(sql: string, params: unknown[] = []): Array<Record<string, unknown>> {
  if (!db) throw new Error("dictionary database is not open");
  return db.exec({ sql, bind: params, rowMode: "object", returnValue: "resultRows" }) as Array<
    Record<string, unknown>
  >;
}

async function boot(wasmUrl: string): Promise<void> {
  if (!bootPromise) {
    bootPromise = (async () => {
      // The bundler build resolves sqlite3.wasm relative to the worker script itself (Vite emits it as
      // an asset); passing a custom Emscripten config here breaks the one-shot API bootstrap.
      void wasmUrl;
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
      if (poolUtil.getFileNames().includes(DB_FILE)) {
        openDb();
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

async function install(url: string): Promise<void> {
  if (installing) return installing;
  installing = (async () => {
    if (!poolUtil) throw new Error("VFS not ready");
    closeDb();
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
    const isGzip = /\.gz($|\?)/.test(url) || (resp.headers.get("content-type") || "").includes("gzip");
    const stream = isGzip ? counted.pipeThrough(new DecompressionStream("gzip")) : counted;
    const reader = stream.getReader();
    if (poolUtil.getFileNames().includes(DB_FILE)) poolUtil.unlink(DB_FILE);
    if (poolUtil.getCapacity() < 2) await poolUtil.addCapacity(2);
    let sawData = false;
    await poolUtil.importDb(DB_FILE, async () => {
      const { done, value } = await reader.read();
      if (done) {
        status.state = "importing";
        return undefined;
      }
      sawData = true;
      return value;
    });
    if (!sawData) throw new Error("dictionary download was empty");
    openDb();
  })()
    .catch((error) => {
      status.state = "error";
      status.error = error instanceof Error ? error.message : String(error);
      try {
        poolUtil?.unlink(DB_FILE);
      } catch {
        /* ignore */
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
  status.state = "missing";
  status.revision = "";
  status.terms = 0;
  status.bytes = 0;
}

type Request = { id: number; op: string; wasmUrl: string; url?: string; surface?: string; surfaces?: string[]; cues?: string[][] };

self.onmessage = async (event: MessageEvent<Request>) => {
  const msg = event.data;
  const reply = (ok: boolean, data?: unknown, error?: string) => self.postMessage({ id: msg.id, ok, data, error });
  try {
    if (msg.op !== "status") await boot(msg.wasmUrl);
    else await boot(msg.wasmUrl).catch(() => undefined);

    switch (msg.op) {
      case "status":
        reply(true, { ...status });
        return;
      case "install":
        if (!msg.url) throw new Error("missing dictionary url");
        await install(msg.url);
        reply(true, { ...status });
        return;
      case "remove":
        remove();
        reply(true, { ...status });
        return;
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
