import { afterEach, describe, expect, it, vi } from "vitest";
import { createEvent, createStore } from "effector";
import { withPersist } from "./withPersist";

type Listener = (changes: Record<string, { newValue?: unknown }>, area: string) => void;

/** chrome.storage with a held initial read, so its ordering against change events is controlled. */
function heldStorage(seed: Record<string, string>) {
  const data = { ...seed };
  const listeners: Listener[] = [];
  const sets: Record<string, string>[] = [];
  let releaseGet!: () => void;
  const chrome = {
    storage: {
      local: {
        get: (keys: string[], cb: (r: Record<string, string>) => void) => {
          const snapshot = Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]]));
          releaseGet = () => cb(snapshot);
        },
        set: (items: Record<string, string>) => {
          sets.push(items);
          Object.assign(data, items);
        },
      },
      onChanged: { addListener: (l: Listener) => listeners.push(l) },
    },
  };
  const change = (key: string, value: string) => {
    data[key] = value;
    listeners.forEach((l) => l({ [key]: { newValue: value } }, "local"));
  };
  return { chrome, sets, change, releaseGet: () => releaseGet() };
}

afterEach(() => vi.unstubAllGlobals());

describe("withPersist", () => {
  it("ignores an initial read that lands after a newer storage change", () => {
    const s = heldStorage({ "persist:list": '["old"]' });
    vi.stubGlobal("chrome", s.chrome);
    const store = withPersist(createStore<string[]>([], { name: "list" }));
    s.change("persist:list", '["newer"]');
    s.releaseGet();
    expect(store.getState()).toEqual(["newer"]);
  });

  it("write: false never writes snapshots but hydrates over an optimistic local change", () => {
    const s = heldStorage({ "persist:list": '["stored"]' });
    vi.stubGlobal("chrome", s.chrome);
    const store = withPersist(createStore<string[]>([], { name: "list" }), { write: false });
    const add = createEvent<string>();
    store.on(add, (list, v) => [...list, v]);
    add("stored"); // optimistic; the stored value already has it, so storage won't change
    s.releaseGet();
    expect(store.getState()).toEqual(["stored"]);
    add("local");
    expect(s.sets).toEqual([]);
    s.change("persist:list", '["stored","local"]');
    expect(store.getState()).toEqual(["stored", "local"]);
  });
});
