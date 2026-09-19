import reloadOnUpdate from "virtual:reload-on-update-in-background-script";

import { googleTranslateSingleFetcher } from "@src/utils/googleTranslateSingleFetcher";
import { deeplTranslateFetcher } from "@src/utils/deeplTranslateFetcher";
import { himotokiEntry, himotokiSearch } from "@src/utils/himotokiApi";
import {
  HIMOTOKI_CONVEX_URL,
  HIMOTOKI_GOOGLE_CLIENT_ID,
} from "@src/shared/himotokiConfig";
import { signInWithGoogleIdToken, addHimotokiFavorite } from "@src/utils/himotokiConvex";
import { HIMOTOKI_DICT_URL, dictManifestUrlFor } from "@src/shared/himotokiConfig";

export type DictManifest = { name?: string; revision?: string; sha256?: string; bytes?: number; gzipBytes?: number; title?: string };

async function resolveDictUrl(): Promise<string> {
  const stored = await chrome.storage.local.get(["himotokiDictUrl"]);
  return (stored.himotokiDictUrl as string | undefined) || HIMOTOKI_DICT_URL;
}

async function fetchDictManifest(): Promise<DictManifest | null> {
  try {
    const resp = await fetch(dictManifestUrlFor(await resolveDictUrl()), { cache: "no-cache" });
    if (!resp.ok) return null;
    return (await resp.json()) as DictManifest;
  } catch {
    return null;
  }
}

/** Content-script / popup message types that map onto dictionary worker operations. */
const DICT_OPS: Record<string, string> = {
  himotokiDictStatus: "status",
  himotokiDictInstall: "install",
  himotokiDictRemove: "remove",
  himotokiLookup: "lookup",
  himotokiLookupBatch: "lookupBatch",
  himotokiRepairSegments: "repair",
  himotokiConjTable: "conjTable",
};

import "webext-dynamic-content-scripts";

reloadOnUpdate("pages/background");
reloadOnUpdate("pages/content/style.scss");

const OFFSCREEN_PATH = "src/pages/offscreen/index.html";
const OFFSCREEN_REASON = "WORKERS" as chrome.offscreen.Reason;
const OFFSCREEN_JUSTIFICATION = "Run Himotoki ONNX Japanese subtitle segmentation";

async function hasOffscreenDocument(): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts?.({
    contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)],
  });
  if (contexts) return contexts.length > 0;

  // Fallback for older Chrome
  const clientsList = await (self as unknown as { clients?: { matchAll: () => Promise<Array<{ url: string }>> } })
    .clients?.matchAll?.();
  return Boolean(clientsList?.some((c) => c.url.includes(OFFSCREEN_PATH)));
}

let offscreenCreating: Promise<void> | null = null;

/** Serialized: concurrent callers must not both call createDocument ("Only a single offscreen document"). */
async function setupOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) return;
  if (!offscreenCreating) {
    offscreenCreating = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_PATH,
        reasons: [OFFSCREEN_REASON],
        justification: OFFSCREEN_JUSTIFICATION,
      })
      .catch(async (error: Error) => {
        // Another context won the race; fine as long as a document now exists.
        if (!(await hasOffscreenDocument())) throw error;
      })
      .finally(() => {
        offscreenCreating = null;
      });
  }
  await offscreenCreating;
}

async function waitForOffscreenReady(timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await chrome.runtime.sendMessage({
        target: "offscreen-split",
        type: "himotokiSplitPing",
      });
      if (resp?.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(
    `Offscreen split document not ready: ${
      lastError instanceof Error ? lastError.message : String(lastError ?? "timeout")
    }`,
  );
}

async function sendToOffscreen<T>(
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  await setupOffscreenDocument();
  await waitForOffscreenReady();
  const resp = await chrome.runtime.sendMessage({
    target: "offscreen-split",
    ...payload,
  });
  if (!resp) {
    return { ok: false, error: "No response from offscreen split worker" };
  }
  return resp as { ok: boolean; data?: T; error?: string };
}

chrome.runtime.onInstalled.addListener(function (object) {
  if (object.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/pages/welcome/index.html") });
  }
});

// Message types this listener answers asynchronously; only for these do we keep the response channel
// open (return true). Returning true for an unhandled type would leave the sender's promise hanging.
const HANDLED_MESSAGE_TYPES = new Set([
  "translateFullText",
  "himotokiSplit",
  "himotokiSplitBatch",
  "himotokiDictManifest",
  "openOptionsPage",
  "himotokiSearch",
  "himotokiEntry",
  "himotokiSignIn",
  "himotokiSignOut",
  "himotokiGetSession",
  "himotokiAddFavorite",
  "post",
]);

chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
  if (message?.target === "offscreen-split") {
    // Offscreen document owns these messages; do not keep this SW channel open.
    return false;
  }

  const type: unknown = message?.type;
  if (typeof type !== "string") return false;

  if (message.type === "translateFullText") {
    const translationService = message.translationService || "google";

    if (translationService === "deepl") {
      deeplTranslateFetcher.setApiKey(message.deeplApiKey);
      deeplTranslateFetcher
        .getFullTextTranslation({ text: message.text, lang: message.language })
        .then((respData: string) => sendResponse(respData))
        .catch((error: Error) => sendResponse({ error: error.message }));
    } else {
      googleTranslateSingleFetcher
        .getFullTextTranslation({ text: message.text, lang: message.language })
        .then((respData: unknown) => sendResponse(respData))
        .catch((error: Error) => sendResponse({ error: error.message }));
    }
  }

  if (message.type === "himotokiSplit") {
    sendToOffscreen({ type: "himotokiSplit", text: message.text })
      .then((resp) => sendResponse(resp))
      .catch((error: Error) => sendResponse({ ok: false, error: error.message }));
  }

  if (message.type === "himotokiSplitBatch") {
    sendToOffscreen({ type: "himotokiSplitBatch", texts: message.texts })
      .then((resp) => sendResponse(resp))
      .catch((error: Error) => sendResponse({ ok: false, error: error.message }));
  }

  if (message.type === "himotokiDictManifest") {
    void fetchDictManifest().then((manifest) => sendResponse({ ok: true, data: manifest }));
  }

  if (message.type === "openOptionsPage") {
    chrome.runtime.openOptionsPage(() => sendResponse({ ok: true }));
  }

  if (message.type in DICT_OPS) {
    void (async () => {
      try {
        const op = DICT_OPS[message.type]!;
        const { type: _type, ...payload } = message as { type: string } & Record<string, unknown>;
        if (op === "install") {
          payload.url = await resolveDictUrl();
          const manifest = await fetchDictManifest();
          if (manifest?.sha256) payload.expectedSha256 = manifest.sha256;
          if (manifest?.revision) payload.expectedRevision = manifest.revision;
        }
        const resp = await sendToOffscreen({ ...payload, type: "himotokiDict", op });
        sendResponse(resp);
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();
  }

  if (message.type === "himotokiSearch") {
    himotokiSearch(message.q, message.lang, message.limit)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error: Error) => sendResponse({ ok: false, error: error.message }));
  }

  if (message.type === "himotokiEntry") {
    himotokiEntry(message.source, message.seq, message.lang)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error: Error) => sendResponse({ ok: false, error: error.message }));
  }

  if (message.type === "himotokiSignIn") {
    void (async () => {
      try {
        const idToken = await getGoogleIdTokenInteractive();
        const session = await signInWithGoogleIdToken(idToken);
        await chrome.storage.local.set({
          himotokiAccessToken: session.access_token,
          himotokiUser: session.user,
        });
        sendResponse({ ok: true, data: session });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  }

  if (message.type === "himotokiSignOut") {
    void chrome.storage.local.remove(["himotokiAccessToken", "himotokiUser"]).then(() => {
      sendResponse({ ok: true });
    });
  }

  if (message.type === "himotokiGetSession") {
    void chrome.storage.local.get(["himotokiAccessToken", "himotokiUser"]).then((data) => {
      sendResponse({
        ok: true,
        data: {
          accessToken: data.himotokiAccessToken ?? null,
          user: data.himotokiUser ?? null,
          convexUrl: HIMOTOKI_CONVEX_URL,
          googleClientId: HIMOTOKI_GOOGLE_CLIENT_ID,
        },
      });
    });
  }

  if (message.type === "himotokiAddFavorite") {
    void (async () => {
      try {
        const stored = await chrome.storage.local.get(["himotokiAccessToken"]);
        const token = stored.himotokiAccessToken as string | undefined;
        if (!token) {
          sendResponse({ ok: false, error: "Sign in via the extension popup first." });
          return;
        }
        const result = await addHimotokiFavorite(token, message.favorite);
        sendResponse({ ok: true, data: result });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  }

  // Generic JSON POST used by the Anki (AnkiConnect) learning service.
  if (message.type === "post") {
    fetch(message.url, {
      method: "POST",
      body: JSON.stringify(message.data),
    })
      .then((resp) => {
        if (!resp.ok) {
          throw new Error(`HTTP error! status: ${resp.status}`);
        }
        return resp.json();
      })
      .then((data) => sendResponse(data))
      .catch((error) => {
        sendResponse({ error: error.message || error });
      });
  }

  // Keep the channel open only for a type we actually handle; otherwise let it close immediately so
  // the sender's sendMessage promise resolves (undefined) instead of hanging until the port dies.
  return HANDLED_MESSAGE_TYPES.has(type) || type in DICT_OPS;
});

/**
 * Obtain a Google ID token for Himotoki Convex sign-in.
 * Uses launchWebAuthFlow against Google's OAuth endpoint (implicit id_token).
 */
async function getGoogleIdTokenInteractive(): Promise<string> {
  const redirectUrl = chrome.identity.getRedirectURL();
  const nonce = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: HIMOTOKI_GOOGLE_CLIENT_ID,
    response_type: "id_token",
    redirect_uri: redirectUrl,
    scope: "openid email profile",
    nonce,
    prompt: "select_account",
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });
  if (!responseUrl) throw new Error("Google sign-in was cancelled");
  const hash = new URL(responseUrl).hash.replace(/^#/, "");
  const result = new URLSearchParams(hash);
  const idToken = result.get("id_token");
  if (!idToken) throw new Error("No id_token returned from Google");
  return idToken;
}
