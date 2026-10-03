import { FC, useEffect, useRef, useState } from "react";

import { createDictStatusPoller, isDictBusy, type DictStatus, type DictStatusPoller } from "./dictPolling";

export type { DictStatus } from "./dictPolling";

type DictManifest = { revision?: string; gzipBytes?: number; title?: string } | null;

const formatMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Offline dictionary status / download / remove. Used by the popup and the options page. */
export const DictionaryPanel: FC<{ compact?: boolean }> = ({ compact }) => {
  const [dict, setDict] = useState<DictStatus | null>(null);
  const [manifest, setManifest] = useState<DictManifest>(null);
  // Install/remove failures (shown until the next action) and status-request failures (cleared as
  // soon as the worker answers again) are kept apart so a successful poll cannot hide an install error.
  const [error, setError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const pollerRef = useRef<DictStatusPoller | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const poller = createDictStatusPoller({
      request: () => chrome.runtime.sendMessage({ type: "himotokiDictStatus" }),
      onStatus: setDict,
      onError: setStatusError,
    });
    pollerRef.current = poller;
    void poller.refresh();
    void chrome.runtime
      .sendMessage({ type: "himotokiDictManifest" })
      .then((resp) => {
        if (mountedRef.current && resp?.ok) setManifest((resp.data as DictManifest) ?? null);
      })
      .catch(() => undefined);
    return () => {
      mountedRef.current = false;
      poller.dispose();
      if (pollerRef.current === poller) pollerRef.current = null;
    };
  }, []);

  const handleInstall = () => {
    setError(null);
    setDict((d) => (d ? { ...d, state: "downloading", received: 0, total: 0 } : d));
    // The background fetches the manifest before the worker starts, so the first polls can still
    // see "missing": keep polling until the install request itself settles.
    const poller = pollerRef.current;
    poller?.setInstallPending(true);
    void chrome.runtime
      .sendMessage({ type: "himotokiDictInstall" })
      .then(
        (resp) => {
          if (mountedRef.current && !resp?.ok) setError(resp?.error || "Dictionary install failed");
        },
        (e) => {
          if (mountedRef.current) setError(messageOf(e) || "Dictionary install failed");
        },
      )
      .finally(() => {
        poller?.setInstallPending(false);
        void poller?.refresh();
      });
  };

  const handleRemove = async () => {
    setError(null);
    const poller = pollerRef.current;
    try {
      const resp = await chrome.runtime.sendMessage({ type: "himotokiDictRemove" });
      if (mountedRef.current && !resp?.ok) setError(resp?.error || "Could not remove dictionary");
    } catch (e) {
      if (mountedRef.current) setError(messageOf(e) || "Could not remove dictionary");
    }
    await poller?.refresh();
  };

  const busy = isDictBusy(dict);
  const percent = dict && dict.total > 0 ? Math.min(100, Math.round((dict.received / dict.total) * 100)) : null;
  const updateAvailable =
    dict?.state === "ready" && Boolean(manifest?.revision) && Boolean(dict.revision) && manifest!.revision !== dict.revision;
  const downloadMb = manifest?.gzipBytes ? formatMb(manifest.gzipBytes) : "about 38 MB";

  return (
    <div className="es-dict-panel">
      {!dict && !error && !statusError && <p className="es-popup-hint">Checking…</p>}
      {dict?.state === "ready" && (
        <>
          <p className="es-popup-hint">
            {dict.title || "Jitendex"} · {dict.terms.toLocaleString()} entries · {formatMb(dict.bytes)} on disk
            {dict.verified === "ok" ? " · verified" : ""}
          </p>
          {updateAvailable && (
            <>
              <p className="es-popup-hint">
                Update available: {manifest?.title || manifest?.revision} ({downloadMb}).
              </p>
              <button className="es-popup-btn es-popup-btn-primary" onClick={handleInstall}>
                Update dictionary
              </button>
            </>
          )}
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
            {dict.state === "error"
              ? `The dictionary could not be loaded. Download Jitendex again (${downloadMb}) to look up words.`
              : `Download Jitendex (${downloadMb}) to look up words. Word meanings, readings and furigana need this dictionary; whole-line translation works without it.`}
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
      {dict?.state === "unsupported" && (
        <p className="es-popup-hint">
          The offline dictionary cannot run in this browser, so word meanings, readings and furigana are unavailable.
          Whole-line translation still works.
        </p>
      )}
      {(error || statusError || dict?.error) && (
        <div className="es-popup-error">{error || statusError || dict?.error}</div>
      )}
    </div>
  );
};
