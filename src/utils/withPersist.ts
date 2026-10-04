import { createEvent, StoreWritable } from "effector";
import { persistKeyFor } from "@src/shared/persistedSettings";

type PersistConfig = {
  key?: string;
  /**
   * false: never write the whole state from this store; storage is changed elsewhere (e.g. by
   * item-level operations applied in the background, see src/shared/wordStatusOps.ts) and this
   * store only hydrates and follows storage changes. Default true.
   */
  write?: boolean;
};

/**
 * Persist a store in chrome.storage.local under `persist:<name>` and keep it in sync with changes
 * made from other extension pages (options page, popup).
 *
 * Stores must be created with an explicit `name`: without the effector babel plugin, `shortName`
 * is a creation-order counter, so adding or removing a store would silently remap every saved
 * setting.
 */
export const withPersist = <State>(store: StoreWritable<State>, config: PersistConfig = {}) => {
  const name = config.key ?? store.shortName;
  if (!name || /^\d+$/.test(name)) {
    throw new Error("withPersist: store needs an explicit name (createStore(x, { name }))");
  }
  const persistKey = persistKeyFor(name);
  const rehydrate = createEvent<State>(`@PERSIST/REHYDRATE/${name}`);
  // Seeding lastSerialized with the current state stops the watch below from writing the
  // default over storage before the async get lands — that write's onChanged would then
  // rehydrate the store back to the default and wipe every saved setting.
  let lastSerialized = JSON.stringify(store.getState());
  const initialSerialized = lastSerialized;

  store.on(rehydrate, (_, value) => value);

  const applyRaw = (raw: unknown) => {
    if (typeof raw !== "string" || raw === lastSerialized) return;
    lastSerialized = raw;
    try {
      rehydrate(JSON.parse(raw));
    } catch {
      // ignore corrupt values
    }
  };

  // A storage change seen before the initial read lands carries a newer value than that read.
  let changedSinceInit = false;

  chrome.storage.local.get([persistKey], (result) => {
    if (changedSinceInit) return;
    // Hydrate only if nothing wrote to the store meanwhile: a local change already
    // persisted itself and must not be clobbered by a late-arriving stored value.
    // A non-writing store's local change is only optimistic (storage stays the source of
    // truth, and an operation that changed nothing in storage sends no change event), so it
    // always hydrates.
    if (config.write === false || JSON.stringify(store.getState()) === initialSerialized) {
      applyRaw(result[persistKey]);
    }
  });

  if (config.write !== false) {
    store.watch((state) => {
      const serialized = JSON.stringify(state);
      if (serialized === lastSerialized) return;
      lastSerialized = serialized;
      chrome.storage.local.set({ [persistKey]: serialized });
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !(persistKey in changes)) return;
    changedSinceInit = true;
    applyRaw(changes[persistKey]?.newValue);
  });

  return store;
};
