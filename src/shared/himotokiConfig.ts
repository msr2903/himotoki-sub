/** Himotoki Convex + dictionary defaults (production). Only the optional "Save to Himotoki" account
 * feature talks to a Himotoki backend (Convex); word lookups run entirely on the offline dictionary. */
export const HIMOTOKI_CONVEX_URL = "https://resolute-parakeet-238.convex.cloud";
/**
 * Offline dictionary downloaded on first run (built by scripts/build-dict.py, gzip of a trimmed
 * Jitendex SQLite, ~38 MB). Self-hosted as a GitHub release asset so the offline dictionary does
 * not depend on himotoki.my.id; `latest/download` always resolves to the newest published build,
 * which drives the in-app "update available" prompt. Can be overridden at runtime via
 * chrome.storage.local.himotokiDictUrl.
 */
export const HIMOTOKI_DICT_URL =
  "https://github.com/msr2903/himotoki-sub/releases/latest/download/jitendex-lite.sqlite.gz";
/** JSON manifest written next to the dictionary by scripts/build-dict.py (revision, sizes, sha256). */
export const dictManifestUrlFor = (dictUrl: string): string => dictUrl.replace(/\.sqlite(\.gz)?(\?.*)?$/, ".json");
/** Same Google Web client ID as himotoki-web — add chrome-extension://ID to Authorized JavaScript origins / redirect URIs. */
export const HIMOTOKI_GOOGLE_CLIENT_ID =
  "584773048392-114lmg42epe0gig6a9edmhshs20kkmti.apps.googleusercontent.com";
