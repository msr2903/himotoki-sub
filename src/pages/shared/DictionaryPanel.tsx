import { FC, useEffect, useRef, useState } from "react";

export type DictStatus = {
  state: "booting" | "missing" | "downloading" | "importing" | "ready" | "error";
  received: number;
  total: number;
  error: string;
  revision: string;
  title: string;
  terms: number;
  bytes: number;
};

const formatMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;
const isBusy = (s: DictStatus | null) => s?.state === "downloading" || s?.state === "importing" || s?.state === "booting";

/** Offline dictionary status / download / remove. Used by the popup and the options page. */
export const DictionaryPanel: FC<{ compact?: boolean }> = ({ compact }) => {
  const [dict, setDict] = useState<DictStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const refresh = async (): Promise<DictStatus | null> => {
    const resp = await chrome.runtime.sendMessage({ type: "himotokiDictStatus" });
    if (resp?.ok) {
      setDict(resp.data as DictStatus);
      return resp.data as DictStatus;
    }
    setError(resp?.error || "Could not reach the dictionary worker");
    return null;
  };

  const stopPolling = () => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const pollWhileBusy = () => {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      const status = await refresh();
      if (!isBusy(status)) stopPolling();
    }, 500);
  };

  useEffect(() => {
    void refresh().then((status) => {
      if (isBusy(status)) pollWhileBusy();
    });
    return stopPolling;
  }, []);

  const handleInstall = () => {
    setError(null);
    setDict((d) => (d ? { ...d, state: "downloading", received: 0, total: 0 } : d));
    void chrome.runtime.sendMessage({ type: "himotokiDictInstall" }).then((resp) => {
      if (!resp?.ok) setError(resp?.error || "Dictionary install failed");
      void refresh();
    });
    pollWhileBusy();
  };

  const handleRemove = async () => {
    setError(null);
    const resp = await chrome.runtime.sendMessage({ type: "himotokiDictRemove" });
    if (!resp?.ok) setError(resp?.error || "Could not remove dictionary");
    await refresh();
  };

  const busy = isBusy(dict);
  const percent = dict && dict.total > 0 ? Math.min(100, Math.round((dict.received / dict.total) * 100)) : null;

  return (
    <div className="es-dict-panel">
      {!dict && !error && <p className="es-popup-hint">Checking…</p>}
      {dict?.state === "ready" && (
        <>
          <p className="es-popup-hint">
            {dict.title || "Jitendex"} · {dict.terms.toLocaleString()} entries · {formatMb(dict.bytes)} on disk
          </p>
          {!compact && (
            <p className="es-popup-hint">
              Lookups run offline in a few milliseconds. Jitendex is © Stephen Kraus, CC BY-SA 4.0, built from JMdict
              (EDRDG) and Tatoeba.
            </p>
          )}
          <button className="es-popup-btn" onClick={handleRemove}>
            Remove dictionary
          </button>
        </>
      )}
      {(dict?.state === "missing" || dict?.state === "error") && (
        <>
          <p className="es-popup-hint">
            Download Jitendex (about 38 MB) for instant lookups without the network. Until then, words are looked up
            online.
          </p>
          <button className="es-popup-btn es-popup-btn-primary" onClick={handleInstall}>
            Download dictionary
          </button>
        </>
      )}
      {busy && (
        <>
          <p className="es-popup-hint">
            {dict?.state === "importing"
              ? "Importing into local storage…"
              : dict?.state === "booting"
                ? "Starting…"
                : percent != null
                  ? `Downloading… ${percent}% (${formatMb(dict!.received)} of ${formatMb(dict!.total)})`
                  : `Downloading… ${formatMb(dict?.received ?? 0)}`}
          </p>
          <div className="es-popup-progress">
            <div
              className="es-popup-progress-bar"
              style={{ width: `${percent ?? (dict?.state === "importing" ? 100 : 5)}%` }}
            />
          </div>
        </>
      )}
      {(error || dict?.error) && <div className="es-popup-error">{error || dict?.error}</div>}
    </div>
  );
};
