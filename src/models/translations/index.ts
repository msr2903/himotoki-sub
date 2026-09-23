import { createEffect, createEvent, createStore, sample } from "effector";

import { TSubItem, TWordTranslation } from "../types";
import { $translateLanguage, $translationService, $deeplApiKey } from "../settings";
import { $currentSubs, $subs } from "../subs";
import {
  entryLemma,
  himotokiEntryToWordTranslation,
  himotokiTokenToWordTranslation,
  type HimotokiToken,
} from "@src/utils/himotokiTypes";

/* ---------- Word lookup cache (Himotoki dictionary) ---------- */

/** Lookup results keyed by surface text; failed lookups are stored with `error` and retried on request. */
export const $lookups = createStore<Record<string, TWordTranslation>>({});
export const $lookupPendings = createStore<Record<string, boolean>>({});
export const lookupRequested = createEvent<TSubItem | string>();

export const lookupKeyOf = (payload: TSubItem | string): string =>
  typeof payload === "string" ? payload : payload.cleanedText || payload.text;

/* ---------- Offline dictionary availability ---------- */

/**
 * Whether the offline dictionary is installed and ready. Used to gate always-on furigana: without
 * the local dictionary every kanji token would fall back to the Himotoki HTTP API, so "always"
 * behaves like "hover" until the dictionary is ready (see Subs.tsx).
 */
export const $dictReady = createStore<boolean>(false);

/** Ask the offscreen worker (via the background) whether the dictionary is ready. */
export const checkDictReadyFx = createEffect<void, boolean>(async () => {
  const resp = await chrome.runtime.sendMessage({ type: "himotokiDictStatus" });
  return Boolean(resp?.ok) && (resp.data as { state?: string } | undefined)?.state === "ready";
});

$dictReady.on(checkDictReadyFx.doneData, (_, ready) => ready);

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
  // Other dictionary entries for the same surface become the popup's alternate entries.
  const lemma = entryLemma(data);
  const bestSeq = data.best?.seq;
  const alternatives = (data.entries ?? [])
    .filter((entry) => entry.seq !== bestSeq)
    .map((entry) => himotokiEntryToWordTranslation(entry, lemma, "en"));
  if (alternatives.length) translation.alternatives = alternatives;
  const tree = data.conjugation as
    | { root_text?: string; root_reading?: string; root_seq?: number; steps?: Array<{ conjType?: string; tip?: string }> }
    | undefined;
  if (tree?.steps?.length && tree.root_text) {
    translation.conjugation = {
      rootText: tree.root_text,
      rootReading: tree.root_reading,
      rootSeq: tree.root_seq,
      steps: tree.steps.map((st) => ({ label: String(st.conjType ?? ""), tip: st.tip })).filter((st) => st.label),
    };
  }
  translation.lookupSource = "local";
  return translation;
};

export const fetchWordTranslationFx = createEffect<{ source: string }, TWordTranslation>(async ({ source }) => {
  try {
    const local = await lookupLocal(source);
    if (local) return { ...local, source };
    // The offline dictionary is not installed. There is no online fallback (the extension is
    // self-contained); the popup prompts the user to install it.
    return { ...emptyTranslation(source), source, lookupSource: "none" };
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
    // A "none" result means the dictionary was not installed at lookup time — retry on the
    // next request instead of caching the install hint forever.
    return !cached || Boolean(cached.error) || cached.lookupSource === "none";
  },
  fn: (_, payload) => ({ source: lookupKeyOf(payload) }),
  target: fetchWordTranslationFx,
});

$lookups.on(fetchWordTranslationFx.doneData, (all, translation) => ({ ...all, [translation.source]: translation }));
// Dictionary installs/updates/removals flip $dictReady; cached entries resolved under the
// old availability (install hints, or entries from a removed dictionary) are invalidated.
$lookups.reset($dictReady.updates);
// Any resolved lookup tells us for free whether the local dictionary is currently serving.
$dictReady.on(fetchWordTranslationFx.doneData, (ready, translation) =>
  translation.lookupSource === "local" ? true : translation.lookupSource === "none" ? false : ready,
);
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

const lineTranslationDone = createEvent<{ source: string; text: string }>();
const lineTranslationFailed = createEvent<{ source: string; error: string }>();

// Results only land while the request's language/service still matches the current
// settings — a response that lands after a switch must not be cached under the new one.
sample({
  clock: fetchSubTranslationFx.done,
  source: { language: $translateLanguage, service: $translationService },
  filter: ({ language, service }, { params }) =>
    params.language === language && params.translationService === service,
  fn: (_, { params, result }) => ({ source: params.source, text: result }),
  target: lineTranslationDone,
});
sample({
  clock: fetchSubTranslationFx.fail,
  source: { language: $translateLanguage, service: $translationService },
  filter: ({ language, service }, { params }) =>
    params.language === language && params.translationService === service,
  fn: (_, { params, error }) => ({
    source: params.source,
    error: error instanceof Error ? error.message : String(error),
  }),
  target: lineTranslationFailed,
});

$lineTranslations
  .on(lineTranslationDone, (all, { source, text }) => ({ ...all, [source]: { text } }))
  .on(lineTranslationFailed, (all, { source, error }) => ({ ...all, [source]: { text: "", error } }))
  // A different target language or service invalidates everything.
  .reset($translateLanguage.updates, $translationService.updates);
$lineTranslationPendings
  .on(fetchSubTranslationFx, (pendings, { source }) => ({ ...pendings, [source]: true }))
  .on(fetchSubTranslationFx.finally, (pendings, { params: { source } }) => {
    const copy = { ...pendings };
    delete copy[source];
    return copy;
  });
