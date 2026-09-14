/** Himotoki dictionary + Convex defaults (production). */
export const HIMOTOKI_API_BASE = "https://himotoki.my.id";
export const HIMOTOKI_GLOSS_LANG = "eng";
export const HIMOTOKI_DICTS = "jitendex,jmdict";
export const HIMOTOKI_CONVEX_URL = "https://resolute-parakeet-238.convex.cloud";
/**
 * Offline dictionary downloaded on first run (built by scripts/build-dict.py, gzip of a trimmed
 * Jitendex SQLite, ~38 MB). Can be overridden at runtime via chrome.storage.local.himotokiDictUrl.
 */
export const HIMOTOKI_DICT_URL = "https://himotoki.my.id/dicts/jitendex-lite.sqlite.gz";
/** JSON manifest written next to the dictionary by scripts/build-dict.py (revision, sizes, sha256). */
export const dictManifestUrlFor = (dictUrl: string): string => dictUrl.replace(/\.sqlite(\.gz)?(\?.*)?$/, ".json");
/** Same Google Web client ID as himotoki-web — add chrome-extension://ID to Authorized JavaScript origins / redirect URIs. */
export const HIMOTOKI_GOOGLE_CLIENT_ID =
  "584773048392-114lmg42epe0gig6a9edmhshs20kkmti.apps.googleusercontent.com";

export const himotokiUrl = (path: string): string => {
  const base = HIMOTOKI_API_BASE.replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
};
