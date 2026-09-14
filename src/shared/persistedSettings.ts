/**
 * Storage format shared by the content-script Effector stores (`withPersist`) and plain extension
 * pages (options, popup): chrome.storage.local, key `persist:<name>`, JSON-serialised value.
 */
export const persistKeyFor = (name: string): string => `persist:${name}`;

export async function readPersisted<T>(name: string, fallback: T): Promise<T> {
  const key = persistKeyFor(name);
  const result = await chrome.storage.local.get([key]);
  const raw = result[key];
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writePersisted<T>(name: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [persistKeyFor(name)]: JSON.stringify(value) });
}

export function onPersistedChange<T>(name: string, callback: (value: T) => void): () => void {
  const key = persistKeyFor(name);
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== "local" || !(key in changes)) return;
    const raw = changes[key]?.newValue;
    if (typeof raw !== "string") return;
    try {
      callback(JSON.parse(raw) as T);
    } catch {
      // ignore
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
