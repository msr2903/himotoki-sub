import { createEffect, createEvent, createStore, sample } from "effector";

import { TSubItem, TWordTranslation } from "../types";
import { $translateLanguage, $translationService, $deeplApiKey } from "../settings";
import { $currentSubs, $subs } from "../subs";
import { HIMOTOKI_GLOSS_LANG } from "@src/shared/himotokiConfig";
import {
  himotokiEntryToWordTranslation,
  himotokiTokenToWordTranslation,
  type HimotokiEntry,
  type HimotokiToken,
} from "@src/utils/himotokiTypes";

/* ---------- Word lookup cache (Himotoki dictionary) ---------- */

/** Lookup results keyed by surface text; failed lookups are stored with `error` and retried on request. */
export const $lookups = createStore<Record<string, TWordTranslation>>({});
export const $lookupPendings = createStore<Record<string, boolean>>({});
export const lookupRequested = createEvent<TSubItem | string>();

export const lookupKeyOf = (payload: TSubItem | string): string =>
  typeof payload === "string" ? payload : payload.cleanedText || payload.text;

/* ---------- Token interaction state ---------- */

export const subItemMouseEntered = createEvent<string>();
/** Carries the leaving token's key: a stale leave (fired after the pointer already entered another token) must not clear it. */
export const subItemMouseLeft = createEvent<string>();
/**
 * Position key (cue id + token index) of the hovered token. Cleared whenever the processed
 * subtitles change (Segmenter paint → ONNX upgrade), because a remounted token never receives the
 * mouseleave of the node it replaced; the new node re-opens itself if still hovered.
 */
export const $activeHoverWord = createStore<string | null>(null)
  .on(subItemMouseEntered, (_, key) => key)
  .on(subItemMouseLeft, (current, key) => (current === key ? null : current))
  .reset($subs.updates);

export const tokenPinToggled = createEvent<string>();
export const tokenUnpinned = createEvent();
/** Position key of the token whose click action is pinned open (until Escape, outside click, or cue change). */
export const $pinnedWord = createStore<string | null>(null)
  .on(tokenPinToggled, (current, key) => (current === key ? null : key))
  .reset(tokenUnpinned)
  .reset($subs.updates)
  .reset($currentSubs.updates);

const emptyTranslation = (source: string, error?: string): TWordTranslation => ({
  source,
  mainTranslation: "",
  targetLanguage: "en",
  translations: [],
  transcription: "",
  error,
});

/** Offline SQLite dictionary (offscreen worker). Resolves null when it is not installed. */
const lookupLocal = async (source: string): Promise<TWordTranslation | null> => {
  const resp = await chrome.runtime.sendMessage({ type: "himotokiLookup", surface: source });
  if (!resp?.ok) throw new Error(resp?.error || "Local dictionary lookup failed");
  const data = resp.data as ({ available: boolean } & HimotokiToken) | undefined;
  if (!data || data.available === false) return null;
  const translation = himotokiTokenToWordTranslation(data, "en") ?? emptyTranslation(source);
  translation.lookupSource = "local";
  return translation;
};

/** Himotoki HTTP API, used only while the offline dictionary is not installed. */
const lookupApi = async (source: string): Promise<TWordTranslation> => {
  const resp = await chrome.runtime.sendMessage({
    type: "himotokiSearch",
    q: source,
    lang: HIMOTOKI_GLOSS_LANG,
    limit: 5,
  });
  if (!resp?.ok) throw new Error(resp?.error || "Himotoki search failed");
  const results = (resp.data || []) as HimotokiEntry[];
  const best = results[0];
  const translation = best ? himotokiEntryToWordTranslation(best, source, "en") : emptyTranslation(source);
  translation.lookupSource = "api";
  return translation;
};

export const fetchWordTranslationFx = createEffect<{ source: string }, TWordTranslation>(async ({ source }) => {
  try {
    let local: TWordTranslation | null = null;
    try {
      local = await lookupLocal(source);
    } catch (error) {
      console.warn("[himotoki] local dictionary failed, falling back to API", error);
    }
    if (local) return { ...local, source };
    return { ...(await lookupApi(source)), source };
  } catch (error) {
    console.error("[himotoki] word lookup failed", error);
    return emptyTranslation(source, error instanceof Error ? error.message : String(error));
  }
});

sample({
  clock: lookupRequested,
  source: { lookups: $lookups, pendings: $lookupPendings },
  filter: ({ lookups, pendings }, payload) => {
    const key = lookupKeyOf(payload);
    if (!key || pendings[key]) return false;
    const cached = lookups[key];
    return !cached || Boolean(cached.error);
  },
  fn: (_, payload) => ({ source: lookupKeyOf(payload) }),
  target: fetchWordTranslationFx,
});

$lookups.on(fetchWordTranslationFx.doneData, (all, translation) => ({ ...all, [translation.source]: translation }));
$lookupPendings.on(fetchWordTranslationFx, (pendings, { source }) => ({ ...pendings, [source]: true }));
$lookupPendings.on(fetchWordTranslationFx.finally, (pendings, { params: { source } }) => {
  const copy = { ...pendings };
  delete copy[source];
  return copy;
});

/* ---------- Whole-line machine translation (Google / DeepL) ---------- */

/** Translations keyed by line text; failures stored with `error` so the UI can show them and retry on request. */
export const $lineTranslations = createStore<Record<string, { text: string; error?: string }>>({});
export const $lineTranslationPendings = createStore<Record<string, boolean>>({});
export const lineTranslationRequested = createEvent<string>();

export const fetchSubTranslationFx = createEffect<
  {
    source: string;
    language: string;
    translationService: string;
    deeplApiKey: string;
  },
  string
>(async ({ source, language, translationService, deeplApiKey }) => {
  const resp = await chrome.runtime.sendMessage({
    type: "translateFullText",
    language,
    text: source,
    translationService,
    deeplApiKey,
  });
  if (resp?.error) throw new Error(resp.error);
  if (translationService === "deepl") return String(resp ?? "");
  const parsed = JSON.parse(resp);
  return (parsed.sentences as Array<{ trans?: string }>).map((sentence) => sentence.trans ?? "").join(" ");
});

sample({
  clock: lineTranslationRequested,
  source: {
    translations: $lineTranslations,
    pendings: $lineTranslationPendings,
    language: $translateLanguage,
    translationService: $translationService,
    deeplApiKey: $deeplApiKey,
  },
  filter: ({ translations, pendings }, source) => {
    const key = source.trim();
    if (!key || pendings[key]) return false;
    const cached = translations[key];
    return !cached || Boolean(cached.error);
  },
  fn: ({ language, translationService, deeplApiKey }, source) => ({
    source: source.trim(),
    language,
    translationService,
    deeplApiKey,
  }),
  target: fetchSubTranslationFx,
});

$lineTranslations
  .on(fetchSubTranslationFx.done, (all, { params, result }) => ({ ...all, [params.source]: { text: result } }))
  .on(fetchSubTranslationFx.fail, (all, { params, error }) => ({
    ...all,
    [params.source]: { text: "", error: error instanceof Error ? error.message : String(error) },
  }))
  // A different target language or service invalidates everything.
  .reset($translateLanguage.updates, $translationService.updates);
$lineTranslationPendings
  .on(fetchSubTranslationFx, (pendings, { source }) => ({ ...pendings, [source]: true }))
  .on(fetchSubTranslationFx.finally, (pendings, { params: { source } }) => {
    const copy = { ...pendings };
    delete copy[source];
    return copy;
  });
