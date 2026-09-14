import { createEvent, StoreWritable } from "effector";
import { persistKeyFor } from "@src/shared/persistedSettings";

type PersistConfig = {
  key?: string;
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
  let lastSerialized: string | null = null;

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

  // Read before the first write below so the stored value wins over the default.
  chrome.storage.local.get([persistKey], (result) => applyRaw(result[persistKey]));

  store.watch((state) => {
    const serialized = JSON.stringify(state);
    if (serialized === lastSerialized) return;
    lastSerialized = serialized;
    chrome.storage.local.set({ [persistKey]: serialized });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !(persistKey in changes)) return;
    applyRaw(changes[persistKey]?.newValue);
  });

  return store;
};
