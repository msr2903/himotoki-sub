import { afterEach, describe, expect, it, vi } from "vitest";
import { createWordStatusMutator } from "@src/shared/wordStatusOps";

const CAT = "seq:jitendex:1467640";
const DOG = "seq:jitendex:1259970";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

type Listener = (changes: Record<string, { oldValue?: string; newValue?: string }>, area: string) => void;

/**
 * Two real settings graphs (two tabs) over one chrome.storage, with change notifications held
 * until `deliver()` and a background owner reached through runtime.sendMessage.
 */
async function twoTabs() {
  const data: Record<string, string> = {};
  const pending: Record<string, { oldValue?: string; newValue?: string }>[] = [];
  const listeners: Listener[] = [];
  const local = {
    get: (keys: string[], cb?: (r: Record<string, string>) => void) => {
      const result = Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]]));
      if (cb) {
        queueMicrotask(() => cb(result));
        return undefined;
      }
      return Promise.resolve(result);
    },
    set: (items: Record<string, string>) => {
      const changes: Record<string, { oldValue?: string; newValue?: string }> = {};
      for (const [k, v] of Object.entries(items)) {
        if (data[k] !== v) changes[k] = { oldValue: data[k], newValue: v };
        data[k] = v;
      }
      if (Object.keys(changes).length) pending.push(changes);
      return Promise.resolve();
    },
  };
  const background = createWordStatusMutator({ get: (keys) => local.get(keys)!, set: local.set });
  vi.spyOn(console, "info").mockImplementation(() => {}); // patronum debug() output
  vi.stubGlobal("window", { navigator: { language: "en" } });
  vi.stubGlobal("document", { body: { classList: { toggle() {} } } });
  vi.stubGlobal("chrome", {
    storage: { local, onChanged: { addListener: (l: Listener) => listeners.push(l) } },
    runtime: {
      sendMessage: async (message: { op: Parameters<typeof background>[0] }) => {
        await background(message.op);
        return { ok: true };
      },
    },
  });
  const a = await import("./index");
  vi.resetModules();
  const b = await import("./index");
  await new Promise((r) => setTimeout(r, 0));
  const deliver = async () => {
    await new Promise((r) => setTimeout(r, 0));
    while (pending.length) {
      const change = pending.shift()!;
      for (const l of listeners) l(change, "local");
    }
  };
  return { a, b, data, deliver };
}

describe("word status edits in two tabs (#110)", () => {
  it("marking different words before either tab hears of the other keeps both", async () => {
    const { a, b, data, deliver } = await twoTabs();
    a.wordStatusSet({ key: CAT, status: "known" });
    b.wordStatusSet({ key: DOG, status: "known" });
    await deliver();
    expect(JSON.parse(data["persist:wordStatuses"])).toEqual({ [CAT]: "known", [DOG]: "known" });
    expect(JSON.parse(data["persist:knownWords"]).sort()).toEqual([CAT, DOG].sort());
    for (const tab of [a, b]) {
      expect(tab.$wordStatuses.getState()).toEqual({ [CAT]: "known", [DOG]: "known" });
      expect([...tab.$knownWords.getState()].sort()).toEqual([CAT, DOG].sort());
    }
  });

  it("a removal in one tab and an add in the other: no resurrection", async () => {
    const { a, b, data, deliver } = await twoTabs();
    a.wordStatusSet({ key: CAT, status: "known" });
    await deliver();
    expect(b.$wordStatuses.getState()).toEqual({ [CAT]: "known" });
    a.wordStatusSet({ key: CAT, status: "new" });
    b.wordStatusSet({ key: DOG, status: "learning" });
    await deliver();
    expect(JSON.parse(data["persist:wordStatuses"])).toEqual({ [DOG]: "learning" });
    expect(JSON.parse(data["persist:knownWords"])).toEqual([]);
    for (const tab of [a, b]) {
      expect(tab.$wordStatuses.getState()).toEqual({ [DOG]: "learning" });
      expect(tab.$knownWords.getState()).toEqual([]);
    }
  });

  it("updates the tab's own stores immediately", async () => {
    const { a } = await twoTabs();
    a.wordStatusSet({ key: CAT, status: "known" });
    expect(a.$wordStatuses.getState()).toEqual({ [CAT]: "known" });
    expect(a.$knownWords.getState()).toEqual([CAT]);
  });
});
