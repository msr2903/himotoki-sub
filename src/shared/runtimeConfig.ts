/**
 * Runtime-overridable endpoints. Every deployment-tied URL/ID has a compiled-in default (from
 * himotokiConfig.ts) that can be overridden at runtime via a plain chrome.storage.local key — so a
 * domain / backend move needs no rebuild, just a value change in the options page (Advanced) or in
 * chrome.storage.local directly. An empty/missing override falls back to the default.
 *
 * These are raw storage keys (not the `persist:` JSON format) so the value is a plain string and
 * end-to-end scripts / power users can set them directly.
 */
import { HIMOTOKI_DICT_URL, HIMOTOKI_CONVEX_URL, HIMOTOKI_GOOGLE_CLIENT_ID } from "./himotokiConfig";

export type EndpointKey = "himotokiDictUrl" | "himotokiConvexUrl" | "himotokiGoogleClientId";

/** Compiled-in defaults, used whenever there is no runtime override. */
export const ENDPOINT_DEFAULTS: Record<EndpointKey, string> = {
  himotokiDictUrl: HIMOTOKI_DICT_URL,
  himotokiConvexUrl: HIMOTOKI_CONVEX_URL,
  himotokiGoogleClientId: HIMOTOKI_GOOGLE_CLIENT_ID,
};

export const ENDPOINT_KEYS = Object.keys(ENDPOINT_DEFAULTS) as EndpointKey[];

export type EndpointConfig = Record<EndpointKey, string>;

/** Resolve one endpoint: a non-empty stored override wins over the compiled default. */
export async function resolveEndpoint(key: EndpointKey): Promise<string> {
  const stored = await chrome.storage.local.get([key]);
  const value = typeof stored[key] === "string" ? (stored[key] as string).trim() : "";
  return value || ENDPOINT_DEFAULTS[key];
}

/** Resolve every endpoint at once (one storage read). */
export async function resolveEndpoints(): Promise<EndpointConfig> {
  const stored = await chrome.storage.local.get(ENDPOINT_KEYS);
  const out = {} as EndpointConfig;
  for (const key of ENDPOINT_KEYS) {
    const value = typeof stored[key] === "string" ? (stored[key] as string).trim() : "";
    out[key] = value || ENDPOINT_DEFAULTS[key];
  }
  return out;
}

/** `https://host/*` match pattern for a URL, for chrome.permissions.request; null if not parseable. */
export function originMatchPattern(url: string): string | null {
  try {
    return `${new URL(url).origin}/*`;
  } catch {
    return null;
  }
}
