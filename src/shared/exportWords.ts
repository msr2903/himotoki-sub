/**
 * Pure serializers for exporting the user's saved words (known-word keys + optional status map) to
 * CSV or JSON. Reads the raw persisted values so it stays decoupled from the word-status feature:
 * `knownWords` (array of stable keys) and, when present, `wordStatuses` (Record<key, status>).
 *
 * Dictionary words are stored by sequence key (`seq:jitendex:1467640`), which holds no headword, so
 * the export resolves them from the lookup history and the offline dictionary (see DataPanel). A
 * row that could not be resolved says so in `note` instead of exporting a bare ID silently.
 */
export type ExportRow = {
  key: string;
  headword: string;
  source: string;
  seq: string;
  status: string;
  note: string;
};

export const UNRESOLVED_HEADWORD_NOTE = "headword unavailable: install the offline dictionary and export again";

/** Dictionary source whose sequence keys the installed offline dictionary can resolve. */
const LOCAL_DICT_SOURCE = "jitendex";

/** Parse a stable key (`hw:<headword>` or `seq:<source>:<seq>`) into its parts. Pure. */
export const parseKey = (key: string): { headword: string; source: string; seq: string } => {
  if (key.startsWith("hw:")) return { headword: key.slice(3), source: "", seq: "" };
  if (key.startsWith("seq:")) {
    const parts = key.split(":");
    return { headword: "", source: parts[1] || "", seq: parts.slice(2).join(":") };
  }
  return { headword: key, source: "", seq: "" };
};

/** Merge the known-word keys and the status map into export rows (deduped by key). Pure. */
export const buildRows = (
  knownKeys: readonly string[],
  statuses: Record<string, string> = {},
  /** Resolved headwords by stable key, for `seq:` keys. */
  headwords: Record<string, string> = {},
): ExportRow[] => {
  const keys = Array.from(new Set<string>([...knownKeys, ...Object.keys(statuses)]));
  return keys.map((key) => {
    const parsed = parseKey(key);
    const status = statuses[key] || (knownKeys.includes(key) ? "known" : "new");
    const headword = parsed.headword || headwords[key] || "";
    const note = headword ? "" : UNRESOLVED_HEADWORD_NOTE;
    return { key, headword, source: parsed.source, seq: parsed.seq, status, note };
  });
};

/** Headwords already recorded locally by key, from the persisted lookup history. Pure. */
export const headwordsFromHistory = (history: readonly unknown[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const item of history) {
    const { key, headword } = (item ?? {}) as { key?: unknown; headword?: unknown };
    if (typeof key === "string" && typeof headword === "string" && headword && !out[key]) out[key] = headword;
  }
  return out;
};

/** Sequence numbers of local-dictionary keys that still lack a headword. Pure. */
export const seqsToResolve = (keys: readonly string[], known: Record<string, string>): number[] => {
  const seqs = new Set<number>();
  for (const key of keys) {
    if (known[key] || !key.startsWith("seq:")) continue;
    const { source, seq } = parseKey(key);
    const n = Number(seq);
    if (source === LOCAL_DICT_SOURCE && Number.isInteger(n) && n > 0) seqs.add(n);
  }
  return [...seqs];
};

/** Map the dictionary's `{ [seq]: headword }` reply back onto stable keys. Pure. */
export const headwordsBySeqKey = (resolved: Record<string, unknown> | null | undefined): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [seq, headword] of Object.entries(resolved ?? {})) {
    if (typeof headword === "string" && headword) out[`seq:${LOCAL_DICT_SOURCE}:${seq}`] = headword;
  }
  return out;
};

export const toJson = (rows: ExportRow[]): string => JSON.stringify(rows, null, 2);

const csvField = (value: string): string => {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
};

const CSV_COLUMNS: (keyof ExportRow)[] = ["key", "headword", "source", "seq", "status", "note"];

export const toCsv = (rows: ExportRow[]): string => {
  const header = CSV_COLUMNS.join(",");
  const lines = rows.map((row) => CSV_COLUMNS.map((col) => csvField(String(row[col] ?? ""))).join(","));
  return [header, ...lines].join("\n");
};
