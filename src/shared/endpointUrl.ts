import { originMatchPattern } from "./runtimeConfig";

export type TEndpointSave = { ok: true; value: string } | { ok: false; error: string };

/**
 * Validate a custom endpoint URL and obtain host permission for its origin, before anything is
 * saved: a URL the extension can't fetch must never become the active endpoint. A blank value
 * means "use the default". `request` is chrome.permissions.request's origin form; it must run from
 * a user gesture (the Save click).
 */
export async function prepareEndpointUrl(
  value: string,
  request: (origins: string[]) => Promise<boolean>,
): Promise<TEndpointSave> {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: "" };
  let pattern: string | null = null;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" || url.protocol === "http:") pattern = originMatchPattern(trimmed);
  } catch {
    // Reported below.
  }
  if (!pattern) return { ok: false, error: "Enter a valid HTTP or HTTPS URL." };
  let granted = false;
  try {
    granted = await request([pattern]);
  } catch {
    granted = false;
  }
  if (!granted) return { ok: false, error: "Host permission was not granted. The previous URL is still active." };
  return { ok: true, value: trimmed };
}
