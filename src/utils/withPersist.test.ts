import { describe, it, expect, afterEach, vi } from "vitest";
import { createEvent, createStore } from "effector";
import { withPersist } from "./withPersist";

// Regression for the hydration race (#66): store.watch fires synchronously with the
// default state, so the naive implementation wrote the default over chrome.storage
// before the async get landed — then the write's onChanged rehydrated the store back
// to the default, wiping every saved setting on each page load.

type StorageData = Record<string, string>;

function fakeStorage(seed: StorageData = {}) {
  const data: StorageData = { ...seed };
  const setCalls: StorageData[] = [];
  const listeners: Array<(changes: Record<string, { newValue?: unknown }>, area: string) => void> = [];
  const chrome = {
    storage: {
      local: {
        get: (keys: string[], cb: (result: StorageData) => void) => {
          queueMicrotask(() =>
            cb(Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]!]))),
          );
        },
        set: (obj: StorageData, cb?: () => void) => {
          setCalls.push(obj);
          const changes: Record<string, { oldValue?: string; newValue: string }> = {};
          for (const [k, v] of Object.entries(obj)) {
            if (data[k] !== v) changes[k] = { oldValue: data[k], newValue: v };
            data[k] = v;
          }
          if (Object.keys(changes).length)
            queueMicrotask(() => listeners.forEach((l) => l(changes, "local")));
          cb?.();
        },
      },
      onChanged: {
        addListener: (l: (changes: Record<string, { newValue?: unknown }>, area: string) => void) =>
          listeners.push(l),
      },
    },
  };
  return { chrome, data, setCalls };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("withPersist", () => {
  it("hydrates the store from storage without ever writing the default back", async () => {
    const storage = fakeStorage({ "persist:greeting": '"stored"' });
    vi.stubGlobal("chrome", storage.chrome);
    const store = withPersist(createStore("default", { name: "greeting" }));
    await flush();
    expect(store.getState()).toBe("stored");
    expect(storage.data["persist:greeting"]).toBe('"stored"');
    expect(storage.setCalls.flatMap((c) => Object.values(c))).not.toContain('"default"');
  });

  it("keeps a local change that raced ahead of hydration", async () => {
    const storage = fakeStorage({ "persist:greeting": '"stored"' });
    vi.stubGlobal("chrome", storage.chrome);
    const store = withPersist(createStore("default", { name: "greeting" }));
    const setGreeting = createEvent<string>();
    store.on(setGreeting, (_, v) => v);
    setGreeting("local"); // lands before the async get resolves
    await flush();
    expect(store.getState()).toBe("local");
    expect(storage.data["persist:greeting"]).toBe('"local"');
  });

  it("writes nothing on a fresh install until the first real change", async () => {
    const storage = fakeStorage();
    vi.stubGlobal("chrome", storage.chrome);
    const store = withPersist(createStore("default", { name: "greeting" }));
    await flush();
    expect(storage.setCalls).toHaveLength(0);
    const setGreeting = createEvent<string>();
    store.on(setGreeting, (_, v) => v);
    setGreeting("changed");
    await flush();
    expect(storage.data["persist:greeting"]).toBe('"changed"');
  });

  it("still applies changes pushed from other extension pages", async () => {
    const storage = fakeStorage();
    vi.stubGlobal("chrome", storage.chrome);
    const store = withPersist(createStore("default", { name: "greeting" }));
    await flush();
    storage.chrome.storage.local.set({ "persist:greeting": '"from-options"' });
    await flush();
    expect(store.getState()).toBe("from-options");
  });
});
