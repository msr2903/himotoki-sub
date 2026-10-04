import { describe, expect, it } from "vitest";
import {
  applyWordStatusOp,
  createWordStatusMutator,
  isWordStatusOp,
  parseWordStatusState,
  type TWordStatusOp,
  type WordStatusStorage,
} from "./wordStatusOps";

const CAT = "seq:jitendex:1467640";
const DOG = "seq:jitendex:1259970";

/** chrome.storage-like store with async get/set, so concurrent read-modify-writes can interleave. */
function memoryStorage(seed: Record<string, string> = {}) {
  const data: Record<string, string> = { ...seed };
  const storage: WordStatusStorage = {
    get: async (keys) => {
      await new Promise((r) => setTimeout(r, 0));
      return Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]]));
    },
    set: async (items) => {
      await new Promise((r) => setTimeout(r, 0));
      Object.assign(data, items);
    },
  };
  const state = () => parseWordStatusState(data);
  return { storage, data, state };
}

describe("applyWordStatusOp", () => {
  const empty = { statuses: {}, known: [] };

  it("mirrors known into the legacy array and clears it for other statuses", () => {
    const known = applyWordStatusOp(empty, { kind: "status", key: CAT, status: "known" });
    expect(known).toEqual({ statuses: { [CAT]: "known" }, known: [CAT] });
    const learning = applyWordStatusOp(known, { kind: "status", key: CAT, status: "learning" });
    expect(learning).toEqual({ statuses: { [CAT]: "learning" }, known: [] });
    expect(applyWordStatusOp(learning, { kind: "status", key: CAT, status: "new" })).toEqual(empty);
  });

  it("legacy known ops only touch the array", () => {
    const s = applyWordStatusOp({ statuses: { [DOG]: "learning" }, known: [] }, { kind: "known", key: CAT, known: true });
    expect(s).toEqual({ statuses: { [DOG]: "learning" }, known: [CAT] });
    expect(applyWordStatusOp(s, { kind: "known", key: CAT, known: false }).known).toEqual([]);
  });

  it("forget all drops known words and statuses but keeps others", () => {
    const s = { statuses: { [CAT]: "known" as const, [DOG]: "learning" as const }, known: [CAT, "hw:鳥"] };
    expect(applyWordStatusOp(s, { kind: "forgetKnown" })).toEqual({ statuses: { [DOG]: "learning" }, known: [] });
  });

  it("returns the same references for no-op changes", () => {
    const s = { statuses: { [CAT]: "known" as const }, known: [CAT] };
    const next = applyWordStatusOp(s, { kind: "status", key: CAT, status: "known" });
    expect(next.statuses).toBe(s.statuses);
    expect(next.known).toBe(s.known);
  });

  it("validates messages", () => {
    expect(isWordStatusOp({ kind: "status", key: CAT, status: "known" })).toBe(true);
    expect(isWordStatusOp({ kind: "status", key: CAT, status: "bogus" })).toBe(false);
    expect(isWordStatusOp({ kind: "known", key: "", known: true })).toBe(false);
    expect(isWordStatusOp({ kind: "forgetKnown" })).toBe(true);
    expect(isWordStatusOp(null)).toBe(false);
  });

  it("parses malformed storage as empty", () => {
    expect(parseWordStatusState({ "persist:wordStatuses": "{bad", "persist:knownWords": '{"a":1}' })).toEqual(empty);
  });
});

describe("createWordStatusMutator (#110)", () => {
  const run = async (ops: TWordStatusOp[], seed: Record<string, string> = {}) => {
    const m = memoryStorage(seed);
    const apply = createWordStatusMutator(m.storage);
    await Promise.all(ops.map((op) => apply(op))); // issued concurrently, like two tabs
    return m;
  };

  it("two tabs adding different words keep both", async () => {
    const m = await run([
      { kind: "status", key: CAT, status: "known" },
      { kind: "status", key: DOG, status: "known" },
    ]);
    expect(m.state()).toEqual({ statuses: { [CAT]: "known", [DOG]: "known" }, known: [CAT, DOG] });
  });

  it("an add in one tab and a removal in another: the removal is not resurrected", async () => {
    const seed = { "persist:wordStatuses": JSON.stringify({ [CAT]: "known" }), "persist:knownWords": JSON.stringify([CAT]) };
    const m = await run(
      [
        { kind: "status", key: CAT, status: "new" },
        { kind: "status", key: DOG, status: "known" },
      ],
      seed,
    );
    expect(m.state()).toEqual({ statuses: { [DOG]: "known" }, known: [DOG] });
  });

  it("different statuses for different words are both kept", async () => {
    const m = await run([
      { kind: "status", key: CAT, status: "learning" },
      { kind: "status", key: DOG, status: "ignored" },
    ]);
    expect(m.state()).toEqual({ statuses: { [CAT]: "learning", [DOG]: "ignored" }, known: [] });
  });

  it("keeps running after a failed write", async () => {
    const m = memoryStorage();
    let fail = true;
    const apply = createWordStatusMutator({
      get: m.storage.get,
      set: async (items) => {
        if (fail) {
          fail = false;
          throw new Error("quota");
        }
        await m.storage.set(items);
      },
    });
    await expect(apply({ kind: "status", key: CAT, status: "known" })).rejects.toThrow("quota");
    await apply({ kind: "status", key: DOG, status: "known" });
    expect(m.state().known).toEqual([DOG]);
  });
});
