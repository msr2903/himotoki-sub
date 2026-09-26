/**
 * Himotoki defaults (production). Only the optional "Save to Himotoki" account feature talks to a
 * Himotoki backend — the same Firebase project as himotoki.web.app and the mobile app; word
 * lookups run entirely on the offline dictionary.
 *
 * The Firebase web API key and project ID are public identifiers, not secrets: access is enforced
 * by Firebase Auth and Himotoki's Firestore security rules (each user can only touch their own
 * `saved/{uid}` document).
 */
export const HIMOTOKI_FIREBASE_API_KEY = "AIzaSyBWnRUvmoBqDiskcY6krGgNG87vz8bzcnQ";
export const HIMOTOKI_FIREBASE_PROJECT_ID = "himotoki";
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
/**
 * The `himotoki` project's Google "Web client" — the one Firebase Auth's Google provider uses, so
 * the ID token it mints is accepted by `signInWithIdp`. Sign-in works once this extension's
 * redirect URL (`https://<extension-id>.chromiumapp.org/`, shown on the options page) is listed
 * under the client's Authorized redirect URIs in the Google Cloud console.
 */
export const HIMOTOKI_GOOGLE_CLIENT_ID =
  "330567228503-kjfajrdp071c6vlfk4ca974bhi2v0mav.apps.googleusercontent.com";
