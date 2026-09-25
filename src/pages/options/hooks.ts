import { useEffect, useState } from "react";

import { onPersistedChange, readPersisted, writePersisted } from "@src/shared/persistedSettings";

/** A persisted setting shared live with the content script (see src/utils/withPersist.ts). */
export function usePersistedSetting<T>(name: string, fallback: T, validate: (v: unknown) => v is T) {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    void readPersisted<unknown>(name, fallback).then((v) => setValue(validate(v) ? v : fallback));
    return onPersistedChange<unknown>(name, (v) => {
      if (validate(v)) setValue(v);
    });
  }, [name]);
  const update = (next: T) => {
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
  useEffect(() => {
    void chrome.storage.local.get([key]).then((r) => setValue(typeof r[key] === "string" ? r[key] : ""));
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && key in changes) {
        const next = changes[key]?.newValue;
        setValue(typeof next === "string" ? next : "");
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [key]);
  const update = (next: string) => {
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
