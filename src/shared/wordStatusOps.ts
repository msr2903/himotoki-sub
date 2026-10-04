/**
 * Word-status mutations as item-level operations, applied by one owner (the background service
 * worker) to the stored collections. Every tab updates its own stores optimistically, but storage
 * is only ever changed by applying the operation to the *current* stored value, so two tabs editing
 * different words at the same time both keep their edit, and a removal is never undone by a stale
 * snapshot from another tab. `wordStatuses` and the legacy `knownWords` array are written together.
 */
import { KNOWN_WORDS_SETTING } from "./knownWords";
import { persistKeyFor } from "./persistedSettings";
import { TWordStatus, WORD_STATUS_ORDER, WORD_STATUSES_SETTING, setStatus } from "./wordStatus";

export type TWordStatusOp =
  /** wordStatusSet / wordStatusCleared ("new" clears). Mirrors "known" into the legacy array. */
  | { kind: "status"; key: string; status: TWordStatus }
  /** wordMarkedKnown / wordUnmarkedKnown: the legacy array only. */
  | { kind: "known"; key: string; known: boolean }
  /** "Forget all" known words: empties the legacy array and drops "known" statuses. */
  | { kind: "forgetKnown" };

export type TWordStatusState = { statuses: Record<string, TWordStatus>; known: string[] };

export const WORD_STATUS_OP_MESSAGE = "himotokiWordStatusOp";

const STATUSES_KEY = persistKeyFor(WORD_STATUSES_SETTING);
const KNOWN_KEY = persistKeyFor(KNOWN_WORDS_SETTING);

export const isWordStatusOp = (v: unknown): v is TWordStatusOp => {
  if (typeof v !== "object" || v === null) return false;
  const op = v as Record<string, unknown>;
  if (op.kind === "forgetKnown") return true;
  if (typeof op.key !== "string" || !op.key) return false;
  if (op.kind === "status") return WORD_STATUS_ORDER.includes(op.status as TWordStatus);
  if (op.kind === "known") return typeof op.known === "boolean";
  return false;
};

/** The status map after `op`. Returns the same reference when unchanged. Pure. */
export const applyOpToStatuses = (
  map: Record<string, TWordStatus>,
  op: TWordStatusOp,
): Record<string, TWordStatus> => {
  switch (op.kind) {
    case "status":
      return (map[op.key] ?? "new") === op.status ? map : setStatus(map, op.key, op.status);
    case "known":
      return map;
    case "forgetKnown":
      return Object.values(map).includes("known")
        ? Object.fromEntries(Object.entries(map).filter(([, s]) => s !== "known"))
        : map;
  }
};

/** The legacy known-words array after `op`. Returns the same reference when unchanged. Pure. */
export const applyOpToKnown = (list: string[], op: TWordStatusOp): string[] => {
  if (op.kind === "forgetKnown") return list.length ? [] : list;
  const known = op.kind === "known" ? op.known : op.status === "known";
  if (known) return list.includes(op.key) ? list : [...list, op.key];
  return list.includes(op.key) ? list.filter((k) => k !== op.key) : list;
};

export const applyWordStatusOp = (state: TWordStatusState, op: TWordStatusOp): TWordStatusState => ({
  statuses: applyOpToStatuses(state.statuses, op),
  known: applyOpToKnown(state.known, op),
});

const parseJson = (raw: unknown): unknown => {
  if (typeof raw !== "string") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

/** Stored `persist:` values → state; anything malformed reads as empty. Pure. */
export const parseWordStatusState = (stored: Record<string, unknown>): TWordStatusState => {
  const statuses = parseJson(stored[STATUSES_KEY]);
  const known = parseJson(stored[KNOWN_KEY]);
  return {
    statuses:
      typeof statuses === "object" && statuses !== null && !Array.isArray(statuses)
        ? Object.fromEntries(
            Object.entries(statuses).filter(([, s]) => WORD_STATUS_ORDER.includes(s as TWordStatus) && s !== "new"),
          )
        : {},
    known: Array.isArray(known) ? known.filter((k): k is string => typeof k === "string") : [],
  };
};

export type WordStatusStorage = {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, string>): Promise<void>;
};

/**
 * Applies operations one at a time, each to the latest stored value (read → apply → write both
 * keys in one set). Run it in a single owner so operations from every tab are serialized.
 */
export function createWordStatusMutator(storage: WordStatusStorage) {
  let queue: Promise<unknown> = Promise.resolve();
  return (op: TWordStatusOp): Promise<void> => {
    const run = queue.then(async () => {
      const current = parseWordStatusState(await storage.get([STATUSES_KEY, KNOWN_KEY]));
      const next = applyWordStatusOp(current, op);
      if (next.statuses === current.statuses && next.known === current.known) return;
      await storage.set({ [STATUSES_KEY]: JSON.stringify(next.statuses), [KNOWN_KEY]: JSON.stringify(next.known) });
    });
    queue = run.catch(() => undefined);
    return run;
  };
}

export const chromeWordStatusStorage: WordStatusStorage = {
  get: (keys) => chrome.storage.local.get(keys),
  set: (items) => chrome.storage.local.set(items),
};

let localMutator: ((op: TWordStatusOp) => Promise<void>) | null = null;

/**
 * Sends `op` to the background owner. Falls back to applying it here (still read-modify-write)
 * when the background can't be reached, e.g. after the extension was reloaded under the page.
 */
export async function sendWordStatusOp(op: TWordStatusOp): Promise<void> {
  try {
    const resp = await chrome.runtime.sendMessage({ type: WORD_STATUS_OP_MESSAGE, op });
    if (resp?.ok) return;
  } catch {
    /* fall through */
  }
  localMutator ??= createWordStatusMutator(chromeWordStatusStorage);
  await localMutator(op);
}
