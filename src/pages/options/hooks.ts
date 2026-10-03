import { useEffect, useRef, useState } from "react";

import { onPersistedChange, readPersisted, writePersisted } from "@src/shared/persistedSettings";
import { syncSetting } from "@src/shared/settingSync";

/** A persisted setting shared live with the content script (see src/utils/withPersist.ts). */
export function usePersistedSetting<T>(name: string, fallback: T, validate: (v: unknown) => v is T) {
  const [value, setValue] = useState<T>(fallback);
  const sync = useRef<{ supersede(): void } | null>(null);
  useEffect(() => {
    const s = syncSetting<T>({
      read: () => readPersisted<unknown>(name, fallback).then((v) => (validate(v) ? v : fallback)),
      subscribe: (callback) =>
        onPersistedChange<unknown>(name, (v) => {
          if (validate(v)) callback(v);
        }),
      apply: setValue,
    });
    sync.current = s;
    return () => s.stop();
  }, [name]);
  const update = (next: T) => {
    sync.current?.supersede();
    setValue(next);
    void writePersisted(name, next);
  };
  return [value, update] as const;
}

export const isBool = (v: unknown): v is boolean => typeof v === "boolean";
export const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export const isString = (v: unknown): v is string => typeof v === "string";

/**
 * A plain (non-`persist:`) chrome.storage.local string key, used for runtime endpoint overrides.
 * An empty value removes the key so the compiled-in default applies.
 */
export function useRawStringSetting(key: string): readonly [string, (next: string) => void] {
  const [value, setValue] = useState("");
  const sync = useRef<{ supersede(): void } | null>(null);
  useEffect(() => {
    const s = syncSetting<string>({
      read: () => chrome.storage.local.get([key]).then((r) => (typeof r[key] === "string" ? r[key] : "")),
      subscribe: (callback) => {
        const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
          if (area === "local" && key in changes) {
            const next = changes[key]?.newValue;
            callback(typeof next === "string" ? next : "");
          }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
      },
      apply: setValue,
    });
    sync.current = s;
    return () => s.stop();
  }, [key]);
  const update = (next: string) => {
    sync.current?.supersede();
    setValue(next);
    const trimmed = next.trim();
    void (trimmed ? chrome.storage.local.set({ [key]: trimmed }) : chrome.storage.local.remove([key]));
  };
  return [value, update] as const;
}

/** The open drill-in panel, kept in `?panel=` so the browser back button closes it. */
export function usePanelParam<T extends string>(isPanel: (v: string | null) => v is T) {
  const read = () => {
    const p = new URLSearchParams(location.search).get("panel");
    return isPanel(p) ? p : null;
  };
  const [panel, setPanel] = useState<T | null>(read);
  useEffect(() => {
    const onPop = () => setPanel(read());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const open = (next: T | null) => {
    const url = new URL(location.href);
    if (next) url.searchParams.set("panel", next);
    else url.searchParams.delete("panel");
    history.pushState(null, "", url);
    setPanel(next);
    window.scrollTo({ top: 0 });
  };
  return [panel, open] as const;
}
