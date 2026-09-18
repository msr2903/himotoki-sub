/**
 * Pure serializers for exporting the user's saved words (known-word keys + optional status map) to
 * CSV or JSON. Reads the raw persisted values so it stays decoupled from the word-status feature:
 * `knownWords` (array of stable keys) and, when present, `wordStatuses` (Record<key, status>).
 */
export type ExportRow = {
  key: string;
  headword: string;
  source: string;
  seq: string;
  status: string;
};

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
): ExportRow[] => {
  const keys = Array.from(new Set<string>([...knownKeys, ...Object.keys(statuses)]));
  return keys.map((key) => {
    const parsed = parseKey(key);
    const status = statuses[key] || (knownKeys.includes(key) ? "known" : "new");
    return { key, headword: parsed.headword, source: parsed.source, seq: parsed.seq, status };
  });
};

export const toJson = (rows: ExportRow[]): string => JSON.stringify(rows, null, 2);

const csvField = (value: string): string => {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
};

const CSV_COLUMNS: (keyof ExportRow)[] = ["key", "headword", "source", "seq", "status"];

export const toCsv = (rows: ExportRow[]): string => {
  const header = CSV_COLUMNS.join(",");
  const lines = rows.map((row) => CSV_COLUMNS.map((col) => csvField(String(row[col] ?? ""))).join(","));
  return [header, ...lines].join("\n");
};
