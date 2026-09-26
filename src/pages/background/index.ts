import reloadOnUpdate from "virtual:reload-on-update-in-background-script";

import { googleTranslateSingleFetcher } from "@src/utils/googleTranslateSingleFetcher";
import { deeplTranslateFetcher } from "@src/utils/deeplTranslateFetcher";
import { createHimotokiAccount, type HimotokiSession } from "@src/utils/himotokiAccount";
import {
  dictManifestUrlFor,
  HIMOTOKI_FIREBASE_API_KEY,
  HIMOTOKI_FIREBASE_PROJECT_ID,
} from "@src/shared/himotokiConfig";
import { resolveEndpoint } from "@src/shared/runtimeConfig";

/** Firebase session for Save to Himotoki (see utils/himotokiAccount.ts). */
const HIMOTOKI_SESSION_KEY = "himotokiSession";
/** Keys from the retired Convex backend — never valid again, cleared on sight. */
const LEGACY_HIMOTOKI_KEYS = ["himotokiAccessToken", "himotokiUser"];

const himotokiAccount = createHimotokiAccount({
  apiKey: HIMOTOKI_FIREBASE_API_KEY,
  projectId: HIMOTOKI_FIREBASE_PROJECT_ID,
  fetch: (input, init) => fetch(input, init),
  storage: {
    async get() {
      return (await chrome.storage.local.get([HIMOTOKI_SESSION_KEY]))[HIMOTOKI_SESSION_KEY];
    },
    async set(session: HimotokiSession) {
      await chrome.storage.local.set({ [HIMOTOKI_SESSION_KEY]: session });
    },
    async remove() {
      await chrome.storage.local.remove([HIMOTOKI_SESSION_KEY, ...LEGACY_HIMOTOKI_KEYS]);
    },
  },
  launchAuthFlow: (url) => chrome.identity.launchWebAuthFlow({ url, interactive: true }),
  redirectUrl: chrome.identity?.getRedirectURL?.() ?? "",
});

export type DictManifest = { name?: string; revision?: string; sha256?: string; bytes?: number; gzipBytes?: number; title?: string };

/** Dictionary URL: runtime override (himotokiDictUrl) or the compiled default. */
async function resolveDictUrl(): Promise<string> {
  return resolveEndpoint("himotokiDictUrl");
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

  if (message.type === "himotokiSignIn") {
    void (async () => {
      try {
        const clientId = await resolveEndpoint("himotokiGoogleClientId");
        await chrome.storage.local.remove(LEGACY_HIMOTOKI_KEYS);
        const user = await himotokiAccount.signIn(clientId);
        sendResponse({ ok: true, data: { user } });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  }

  if (message.type === "himotokiSignOut") {
    void himotokiAccount.signOut().then(() => {
      sendResponse({ ok: true });
    });
  }

  if (message.type === "himotokiGetSession") {
    void (async () => {
      sendResponse({
        ok: true,
        data: {
          user: await himotokiAccount.getUser(),
          // Shown on the options page: it must be an Authorized redirect URI of the client.
          redirectUrl: chrome.identity?.getRedirectURL?.() ?? "",
        },
      });
    })();
  }

  if (message.type === "himotokiAddFavorite") {
    void (async () => {
      try {
        const result = await himotokiAccount.addFavorite(message.favorite);
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

