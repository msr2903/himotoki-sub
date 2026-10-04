/// <reference lib="webworker" />
/**
 * Dictionary worker: hosts SQLite (WebAssembly) over an OPFS-backed Jitendex database and
 * answers lookup / repair requests from the offscreen document. Workers have no chrome.* APIs,
 * so URLs are passed in by the caller.
 */
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { Dictionary, type LookupResult } from "@src/dict/lookup";
import { Sha256 } from "@src/dict/sha256";
import { classifyDictHeader, readStreamHeader, replayStream } from "@src/dict/download";
import { entryHeadword } from "@src/utils/himotokiTypes";

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
/** Which slot the open `db` handle reads (DB_FILE normally; DB_TMP only after a failed promotion). */
let liveFile: string | null = null;
let vfsPromise: Promise<void> | null = null;
let bootPromise: Promise<void> | null = null;
let installing: Promise<void> | null = null;
let removing: Promise<void> | null = null;
/** Bumped by remove(): an install started under an older generation must not write anything back. */
let generation = 0;
let installAbort: AbortController | null = null;

class InstallCancelled extends Error {
  constructor() {
    super("dictionary install was cancelled because the dictionary was removed");
  }
}

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

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const hasFile = (name: string) => Boolean(poolUtil?.getFileNames().includes(name));
const unlinkIfPresent = (name: string) => {
  if (poolUtil && hasFile(name)) poolUtil.unlink(name);
};

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
      status.error = messageOf(error);
      throw error;
    });
  }
  await vfsPromise;
}

async function boot(): Promise<void> {
  if (!bootPromise) {
    bootPromise = (async () => {
      await ensureVfs();
      // A corrupt or schema-incompatible DB file must NOT brick the worker: surface the error but
      // leave the VFS ready so install (re-download) and remove (delete) can still recover it.
      const error = await openBestAvailable();
      if (db) return;
      if (error) {
        status.state = "error";
        status.error = messageOf(error);
      } else {
        status.state = "missing";
      }
    })().catch((error) => {
      bootPromise = null;
      status.state = "error";
      status.error = messageOf(error);
      throw error;
    });
  }
  await bootPromise;
}

type OpenedDb = { file: string; db: Sqlite3Db; dict: Dictionary; revision: string; title: string; terms: number; bytes: number };

/**
 * Open `file` on a handle of its own and prove it is a usable dictionary (metadata, a non-empty
 * term table and a representative lookup). Nothing global changes; on failure the handle is closed.
 */
function openValidated(file: string): OpenedDb {
  if (!poolUtil) throw new Error("VFS not ready");
  const handle = new poolUtil.OpfsSAHPoolDb(file);
  try {
    const query = (sql: string, params: unknown[] = []) =>
      handle.exec({ sql, bind: params, rowMode: "object", returnValue: "resultRows" }) as Array<Record<string, unknown>>;
    handle.exec({ sql: "PRAGMA case_sensitive_like = ON" });
    handle.exec({ sql: "PRAGMA temp_store = MEMORY" });
    const meta = Object.fromEntries(
      (query("SELECT key, value FROM meta") as Array<{ key: string; value: string }>).map((r) => [r.key, r.value]),
    );
    const terms = Number(query("SELECT COUNT(*) AS n FROM term")[0]?.n ?? 0);
    if (!(terms > 0)) throw new Error("dictionary file has no entries");
    const pages = query("PRAGMA page_count")[0] as Record<string, unknown> | undefined;
    const pageSize = query("PRAGMA page_size")[0] as Record<string, unknown> | undefined;
    const opened = new Dictionary(query);
    // Exercises the lookup/deinflection queries, so a file missing their columns fails here.
    opened.lookupSegment("猫");
    opened.clearCaches();
    return {
      file,
      db: handle,
      dict: opened,
      revision: String(meta.revision ?? ""),
      title: String(meta.title ?? "Jitendex"),
      terms,
      bytes: Number(pages?.page_count ?? 0) * Number(pageSize?.page_size ?? 0),
    };
  } catch (error) {
    try {
      handle.close();
    } catch {
      /* ignore */
    }
    throw error;
  }
}

/** Make a validated handle the live dictionary (closing the previous one). */
function activate(opened: OpenedDb): void {
  closeDb();
  db = opened.db;
  dict = opened.dict;
  liveFile = opened.file;
  status.revision = opened.revision;
  status.title = opened.title;
  status.terms = opened.terms;
  status.bytes = opened.bytes;
  status.state = "ready";
  status.error = "";
}

function closeDb(): void {
  dict = null;
  liveFile = null;
  if (db) {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    db = null;
  }
}

function closeQuietly(opened: OpenedDb | null): void {
  if (!opened || opened.db === db) return;
  try {
    opened.db.close();
  } catch {
    /* ignore */
  }
}

/** Copy the validated staging file into DB_FILE and serve from it; DB_TMP is dropped only afterwards. */
async function promoteStaged(): Promise<void> {
  const pool = poolUtil!;
  // DB_TMP may stay open (and keep answering lookups) while its bytes are copied.
  const bytes = pool.exportFile(DB_TMP);
  if (liveFile === DB_FILE) closeDb();
  unlinkIfPresent(DB_FILE);
  await pool.importDb(DB_FILE, bufferSource(bytes));
  activate(openValidated(DB_FILE));
  unlinkIfPresent(DB_TMP);
}

/**
 * Open whichever slot holds a working dictionary. DB_FILE wins; a DB_TMP next to a working DB_FILE
 * is an interrupted download and is dropped. A DB_TMP without a working DB_FILE is a verified update
 * whose swap was interrupted: promote it, or serve it directly if even that fails. Returns the
 * first error when nothing usable remains.
 */
async function openBestAvailable(): Promise<unknown> {
  let firstError: unknown = null;
  if (hasFile(DB_FILE)) {
    try {
      activate(openValidated(DB_FILE));
      unlinkIfPresent(DB_TMP);
      return null;
    } catch (error) {
      firstError = error;
    }
  }
  if (hasFile(DB_TMP)) {
    let staged: OpenedDb | null = null;
    try {
      staged = openValidated(DB_TMP);
    } catch {
      unlinkIfPresent(DB_TMP);
    }
    if (staged) {
      activate(staged);
      try {
        await promoteStaged();
      } catch (error) {
        console.warn("[himotoki-dict] could not promote the staged dictionary", error);
        if (!db) {
          try {
            activate(openValidated(DB_TMP));
          } catch (reopenError) {
            firstError ??= reopenError;
          }
        }
      }
      if (db) return null;
    }
  }
  return firstError;
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
  // A Remove in progress owns the files; start a new install only once it has finished.
  while (removing) await removing.catch(() => undefined);
  if (installing) return installing;
  const myGeneration = generation;
  const abort = new AbortController();
  installAbort = abort;
  const checkCurrent = () => {
    if (myGeneration !== generation) throw new InstallCancelled();
  };
  // The new download goes into the slot that is not serving lookups; the live dictionary stays open
  // (and keeps answering) until the download is verified and its schema validated.
  const stage = liveFile === DB_FILE ? DB_TMP : DB_FILE;
  let staged: OpenedDb | null = null;
  installing = (async () => {
    if (!poolUtil) throw new Error("VFS not ready");
    const pool = poolUtil;
    unlinkIfPresent(stage); // a stale partial download, or a DB_FILE that was already unusable
    if (liveFile !== DB_TMP) unlinkIfPresent(DB_TMP);
    status.state = "downloading";
    status.received = 0;
    status.total = 0;
    status.error = "";
    const resp = await fetch(url, { signal: abort.signal });
    checkCurrent();
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
    // Chunk boundaries are arbitrary, so accumulate enough bytes for the header before deciding.
    const raw = counted.getReader();
    const header = await readStreamHeader(raw);
    checkCurrent();
    const kind = classifyDictHeader(header.head);
    if (kind === "empty") throw new Error("dictionary download was empty");
    // If it's not gzip, it must already be a raw SQLite database. Detect the common misconfiguration
    // where the URL serves something else (usually an SPA index.html because the file isn't deployed)
    // and fail with an actionable message instead of the cryptic "not an SQLite3 database header".
    if (kind === "html" || kind === "unknown") {
      void raw.cancel();
      const contentType = resp.headers.get("content-type") || "unknown";
      throw new Error(
        kind === "html"
          ? `The dictionary URL returned an HTML page (content-type: ${contentType}), not the dictionary file — it is probably not deployed at ${url}.`
          : `The dictionary URL returned data that is neither gzip nor a SQLite database (content-type: ${contentType}) at ${url}.`,
      );
    }
    const source = replayStream(header.chunks, raw, header.done);
    const stream = kind === "gzip" ? source.pipeThrough(new DecompressionStream("gzip")) : source;
    const reader = stream.getReader();
    // Extra capacity for the staged file during an update (alongside the still-present old DB).
    const wantCapacity = stage === DB_TMP ? 4 : 2;
    if (pool.getCapacity() < wantCapacity) await pool.addCapacity(wantCapacity);
    checkCurrent();
    let sawData = false;
    const hasher = new Sha256();
    await pool.importDb(stage, async () => {
      checkCurrent();
      const { done, value } = await reader.read();
      if (done) {
        status.state = "importing";
        return undefined;
      }
      sawData = true;
      hasher.update(value);
      return value;
    });
    checkCurrent();
    if (!sawData) throw new Error("dictionary download was empty");
    if (expectedSha256 && hasher.hex() !== expectedSha256.toLowerCase()) {
      throw new Error("downloaded dictionary is corrupt (checksum mismatch); please try again");
    }
    // Validate the staged copy before anything happens to the installed one.
    staged = openValidated(stage);
    checkCurrent();
    status.verified = expectedSha256 ? "ok" : "skipped";
    activate(staged);
    if (stage === DB_TMP) {
      // The SAH pool has no rename: copy the verified bytes into DB_FILE. The staged copy is
      // deleted only after DB_FILE has been rebuilt and validated, so a failure here leaves it to
      // serve lookups (and to be promoted again on the next boot).
      try {
        await promoteStaged();
      } catch (error) {
        console.warn("[himotoki-dict] could not promote the updated dictionary; serving the staged copy", error);
        if (!db) activate(openValidated(DB_TMP));
      }
    } else {
      unlinkIfPresent(DB_TMP);
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
      closeQuietly(staged);
      // remove() is waiting for this install to settle and owns the files and status from here.
      if (error instanceof InstallCancelled || myGeneration !== generation) throw new InstallCancelled();
      // Never leave the user without a dictionary because an install failed: drop the failed
      // download, keep (or reopen) whatever working dictionary remains, and report it accurately.
      let recoveryError: unknown = null;
      try {
        if (db) {
          if (stage !== liveFile) unlinkIfPresent(stage);
        } else {
          // Without a live handle, a failed DB_FILE stage is the failed download itself.
          if (stage === DB_FILE) unlinkIfPresent(DB_FILE);
          recoveryError = await openBestAvailable();
        }
      } catch (e) {
        recoveryError = e;
      }
      if (db) {
        // A working dictionary survived; the failed-update error still reaches the caller via the
        // rejected promise / toast.
        status.state = "ready";
        status.error = "";
      } else {
        status.state = "error";
        status.error = messageOf(error);
        if (recoveryError) console.warn("[himotoki-dict] recovery after failed install", recoveryError);
      }
      throw error;
    })
    .finally(() => {
      installing = null;
      if (installAbort === abort) installAbort = null;
    });
  return installing;
}

/**
 * Remove the dictionary. Cancels an in-flight install (from any extension page) and waits for it
 * to settle first, so the install can never write the file back after Remove has reported Missing.
 */
async function remove(): Promise<void> {
  generation += 1;
  installAbort?.abort();
  if (!removing) {
    removing = (async () => {
      while (installing) await installing.catch(() => undefined);
      closeDb();
      unlinkIfPresent(DB_FILE);
      unlinkIfPresent(DB_TMP);
      status.state = "missing";
      status.received = 0;
      status.total = 0;
      status.revision = "";
      status.terms = 0;
      status.bytes = 0;
      status.verified = "";
      status.error = "";
    })().finally(() => {
      removing = null;
    });
  }
  await removing;
}

type Request = { id: number; op: string; url?: string; expectedSha256?: string; expectedRevision?: string; surface?: string; surfaces?: string[]; cues?: string[][]; seq?: number; seqs?: number[] };

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
        await remove();
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
      case "headwords": {
        // Headwords for stored sequence keys (saved-word export).
        if (!dict) {
          reply(true, { available: false });
          return;
        }
        const headwords: Record<string, string> = {};
        for (const seq of msg.seqs ?? []) {
          const headword = entryHeadword(dict.getEntry(Number(seq)));
          if (headword) headwords[String(seq)] = headword;
        }
        reply(true, { available: true, headwords });
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
