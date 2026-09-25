import { createStore, createEvent, sample, createEffect } from "effector";
import { debug } from "patronum";

import { withPersist } from "@src/utils/withPersist";
import { TFuriganaLevel, TFuriganaMode, TLearningService, TMouseAction, TMouseButton, TReadingLineMode, TSecondarySubs, TTokenAction, TTranslationService } from "../types";
import { fetchCurrentStreamingFx } from "../streamings";
import {
  CLICK_ACTION_SETTING,
  DEFAULT_CLICK_ACTION,
  DEFAULT_HOVER_ACTION,
  HOVER_ACTION_SETTING,
} from "@src/shared/tokenActions";
import { UI_SCALE_DEFAULT, UI_SCALE_SETTING, clampUiScale } from "@src/shared/uiScale";
import { MEANING_SIZE_DEFAULT, MEANING_SIZE_SETTING, clampMeaningSize } from "@src/shared/labelSettings";
import { DEFAULT_SECONDARY_SUBS, SECONDARY_SUBS_SETTING, nextSecondarySubs } from "@src/shared/secondarySubs";
import { DEFAULT_FURIGANA, FURIGANA_SETTING } from "@src/shared/furiganaSettings";
import { DEFAULT_READING_LINE, READING_LINE_SETTING } from "@src/shared/furiganaSettings";
import { DEFAULT_FURIGANA_LEVEL, FURIGANA_LEVEL_SETTING } from "@src/shared/furiganaDifficulty";
import { COLOR_BY_DIFFICULTY_SETTING, DEFAULT_COLOR_BY_DIFFICULTY } from "@src/shared/tokenColor";
import { DEFAULT_DIM_KNOWN, DIM_KNOWN_SETTING, KNOWN_WORDS_SETTING } from "@src/shared/knownWords";
import { DEFAULT_WORD_STATUSES, TWordStatus, WORD_STATUSES_SETTING, setStatus } from "@src/shared/wordStatus";
import {
  ANKI_CARD_THEME_SETTING,
  ANKI_RICH_CARDS_SETTING,
  ANKI_DECK_SETTING,
  ANKI_TAGS_SETTING,
  ANKI_SAVED_SETTING,
  DEFAULT_ANKI_CARD_THEME,
  DEFAULT_ANKI_RICH_CARDS,
  DEFAULT_ANKI_DECK,
  DEFAULT_ANKI_TAGS,
} from "@src/shared/ankiSettings";
import type { TAnkiCardTheme } from "@src/utils/ankiNote";
import { PLAYBACK_RATE_DEFAULT, PLAYBACK_RATE_SETTING, PLAYBACK_RATE_STEP, clampRate, stepRate } from "@src/shared/playbackRate";
import { DEFAULT_LISTENING_MODE, LISTENING_MODE_SETTING } from "@src/shared/listeningMode";
import { DEFAULT_MOUSE_ACTION, MOUSE_BUTTONS } from "@src/shared/mouseActions";
import { DEFAULT_PITCH_DISPLAY, PITCH_DISPLAY_SETTING, TPitchDisplay } from "@src/shared/pitchSettings";

// Every persisted store carries an explicit name: it is the chrome.storage key (`persist:<name>`)
// and is shared with the options page. See src/utils/withPersist.ts.

export const $enabled = withPersist(createStore<boolean>(true, { name: "enabled" }));
export const enableToggleChanged = createEvent<boolean>();
export const enableToggleChangeFx = createEffect<boolean, boolean>(
  (isEnabled) => isEnabled,
);

export const $activeSettingsTab = withPersist(createStore<number>(0, { name: "activeSettingsTab" }));
export const activeSettingsTabChanged = createEvent<number>();

export const $progressBarEnabled = withPersist(createStore<boolean>(true, { name: "progressBarEnabled" }));
export const progressBarEnabledChanged = createEvent<boolean>();
export const progressBarEnabledChangeFx = createEffect<boolean, boolean>(
  (isEnabled) => isEnabled,
);

export const $autoStopEnabled = withPersist(createStore<boolean>(true, { name: "autoStopEnabled" }));
export const autoStopEnabledChanged = createEvent<boolean>();

export const $netflixOnFlightEnabled = withPersist(createStore<boolean>(false, { name: "netflixOnFlightEnabled" }));
export const netflixOnFlightEnabledChanged = createEvent<boolean>();
export const netflixOnFlightEnabledChangedFx = createEffect<boolean, void>(() =>
  location.reload(),
);

export const $moveBySubsEnabled = withPersist(createStore<boolean>(true, { name: "moveBySubsEnabled" }));
export const moveBySubsEnabledChanged = createEvent<boolean>();
// The keyboard listener is attached unconditionally (see Subs.tsx / keyboardHandler); this setting
// only gates the arrow keys, checked live inside keyboardHandler — so no add/remove wiring here.
$moveBySubsEnabled.on(moveBySubsEnabledChanged, (_, isEnabled) => isEnabled);

export const $translateLanguage = withPersist(
  createStore<string>(window.navigator.language.split("-")[0], { name: "translateLanguage" }),
);
export const translateLanguageChanged = createEvent<string>();
export const translateLanguageChangeFx = createEffect<string, string>(
  (value) => value,
);

export const $learningService = withPersist(
  createStore<TLearningService>("himotoki", { name: "learningService" }),
);
export const learningServiceChanged = createEvent<TLearningService>();
export const learningServiceChangeFx = createEffect<
  TLearningService,
  TLearningService
>((value) => value);

export const $translationService = withPersist(
  createStore<TTranslationService>("google", { name: "translationService" }),
);
export const translationServiceChanged = createEvent<TTranslationService>();
export const translationServiceChangeFx = createEffect<
  TTranslationService,
  TTranslationService
>((value) => value);

export const $deeplApiKey = withPersist(createStore<string>("", { name: "deeplApiKey" }));
export const deeplApiKeyChanged = createEvent<string>();
export const deeplApiKeyChangeFx = createEffect<string, string>(
  (value) => value,
);

export const $deeplApiKeyModalOpen = createStore<boolean>(false);
export const deeplApiKeyModalOpened = createEvent();
export const deeplApiKeyModalClosed = createEvent();

export const $subsFontSize = withPersist(createStore<number>(100, { name: "subsFontSize" }));
export const subsFontSizeButtonPressed = createEvent<number>();
export const subsFontSizeChangeFx = createEffect<number, number>(
  (value) => value,
);

export const $subsBackground = withPersist(createStore<boolean>(true, { name: "subsBackground" }));
export const subsBackgroundButtonPressed = createEvent<boolean>();
export const subsBackgroundToggleFx = createEffect<boolean, boolean>(
  (value) => value,
);

export const $subsBackgroundOpacity = withPersist(createStore<number>(50, { name: "subsBackgroundOpacity" }));
export const subsBackgroundOpacityButtonPressed = createEvent<number>();
export const subsBackgroundOpacityChangeFx = createEffect<number, number>(
  (value) => value,
);

export const $autoPause = withPersist(createStore<boolean>(false, { name: "autoPause" }));
export const autoPauseChanged = createEvent<boolean>();
$autoPause.on(autoPauseChanged, (_, value) => value);

/** What hovering a subtitle word does (see src/shared/tokenActions.ts). */
export const $hoverAction = withPersist(
  createStore<TTokenAction>(DEFAULT_HOVER_ACTION, { name: HOVER_ACTION_SETTING }),
);
export const hoverActionChanged = createEvent<TTokenAction>();
$hoverAction.on(hoverActionChanged, (_, value) => value);

/** What clicking a subtitle word does. Click results stay pinned until dismissed. */
export const $clickAction = withPersist(
  createStore<TTokenAction>(DEFAULT_CLICK_ACTION, { name: CLICK_ACTION_SETTING }),
);
export const clickActionChanged = createEvent<TTokenAction>();
$clickAction.on(clickActionChanged, (_, value) => value);

/** What the middle / side mouse buttons do over the video (see src/utils/mouseHandler.ts). */
const mouseActionStore = (button: TMouseButton) =>
  withPersist(createStore<TMouseAction>(DEFAULT_MOUSE_ACTION, { name: MOUSE_BUTTONS.find((b) => b.id === button)!.setting }));
export const $mouseActions: Record<TMouseButton, ReturnType<typeof mouseActionStore>> = {
  middle: mouseActionStore("middle"),
  back: mouseActionStore("back"),
  forward: mouseActionStore("forward"),
};
export const mouseActionChanged = createEvent<{ button: TMouseButton; action: TMouseAction }>();
for (const button of Object.keys($mouseActions) as TMouseButton[]) {
  $mouseActions[button].on(mouseActionChanged, (current, change) => (change.button === button ? change.action : current));
}

/** Size of the pop-up, hover labels and settings panel, in percent (50–150). */
export const $uiScale = withPersist(createStore<number>(UI_SCALE_DEFAULT, { name: UI_SCALE_SETTING }));
export const uiScaleChanged = createEvent<number>();
$uiScale.on(uiScaleChanged, (_, value) => clampUiScale(value));

/** Size of the meaning text in the hover label, in percent (see src/shared/labelSettings.ts). */
export const $meaningSize = withPersist(createStore<number>(MEANING_SIZE_DEFAULT, { name: MEANING_SIZE_SETTING }));
export const meaningSizeChanged = createEvent<number>();
$meaningSize.on(meaningSizeChanged, (_, value) => clampMeaningSize(value));

/** Pitch accent presentation in the dictionary pop-up. */
export const $pitchDisplay = withPersist(createStore<TPitchDisplay>(DEFAULT_PITCH_DISPLAY, { name: PITCH_DISPLAY_SETTING }));
export const pitchDisplayChanged = createEvent<TPitchDisplay>();
$pitchDisplay.on(pitchDisplayChanged, (_, value) => value);

/** Second subtitle line: off, subtitle track in the translate-to language, or machine translation. */
export const $secondarySubs = withPersist(
  createStore<TSecondarySubs>(DEFAULT_SECONDARY_SUBS, { name: SECONDARY_SUBS_SETTING }),
);
export const secondarySubsChanged = createEvent<TSecondarySubs>();
export const secondarySubsCycled = createEvent();
$secondarySubs.on(secondarySubsChanged, (_, value) => value).on(secondarySubsCycled, (current) => nextSecondarySubs(current));

/** Inline ruby furigana over kanji tokens (see src/shared/furiganaSettings.ts). */
export const $furigana = withPersist(createStore<TFuriganaMode>(DEFAULT_FURIGANA, { name: FURIGANA_SETTING }));
export const furiganaChanged = createEvent<TFuriganaMode>();
$furigana.on(furiganaChanged, (_, value) => value);

/** What to do with a channel's kana reading line: hide it or keep it as text. */
export const $readingLine = withPersist(createStore<TReadingLineMode>(DEFAULT_READING_LINE, { name: READING_LINE_SETTING }));
export const readingLineChanged = createEvent<TReadingLineMode>();
$readingLine.on(readingLineChanged, (_, value) => value);

/** Skip furigana on words at/below a JLPT level the learner knows (see src/shared/furiganaDifficulty.ts). */
export const $furiganaLevel = withPersist(createStore<TFuriganaLevel>(DEFAULT_FURIGANA_LEVEL, { name: FURIGANA_LEVEL_SETTING }));
export const furiganaLevelChanged = createEvent<TFuriganaLevel>();
$furiganaLevel.on(furiganaLevelChanged, (_, value) => value);

/** Words the user has marked as known (stable keys from knownKeyOf); persisted and synced across pages. */
export const $knownWords = withPersist(createStore<string[]>([], { name: KNOWN_WORDS_SETTING }));
export const wordMarkedKnown = createEvent<string>();
export const wordUnmarkedKnown = createEvent<string>();
/** Per-word learning status: New / Learning / Known / Ignored (see src/shared/wordStatus.ts). */
export const $wordStatuses = withPersist(
  createStore<Record<string, TWordStatus>>(DEFAULT_WORD_STATUSES, { name: WORD_STATUSES_SETTING }),
);
export const wordStatusSet = createEvent<{ key: string; status: TWordStatus }>();
export const wordStatusCleared = createEvent<string>();
$wordStatuses
  .on(wordStatusSet, (map, { key, status }) => setStatus(map, key, status))
  .on(wordStatusCleared, (map, key) => setStatus(map, key, "new"));

// Keep the legacy known-words array (coverage stats, export) mirrored to the "known" status.
$knownWords
  .on(wordMarkedKnown, (list, key) => (list.includes(key) ? list : [...list, key]))
  .on(wordUnmarkedKnown, (list, key) => list.filter((k) => k !== key))
  .on(wordStatusSet, (list, { key, status }) =>
    status === "known"
      ? list.includes(key)
        ? list
        : [...list, key]
      : list.filter((k) => k !== key),
  )
  .on(wordStatusCleared, (list, key) => list.filter((k) => k !== key));

/** Dim words already marked known (opt-in; requires resolving each visible token). */
export const $dimKnownWords = withPersist(createStore<boolean>(DEFAULT_DIM_KNOWN, { name: DIM_KNOWN_SETTING }));
export const dimKnownWordsChanged = createEvent<boolean>();
$dimKnownWords.on(dimKnownWordsChanged, (_, value) => value);

/** Colour words by JLPT difficulty (opt-in; resolves each visible token, see src/shared/tokenColor.ts). */
export const $colorByDifficulty = withPersist(createStore<boolean>(DEFAULT_COLOR_BY_DIFFICULTY, { name: COLOR_BY_DIFFICULTY_SETTING }));
export const colorByDifficultyChanged = createEvent<boolean>();
$colorByDifficulty.on(colorByDifficultyChanged, (_, value) => value);

/** Build rich sentence-mining Anki cards (context + screenshot + audio) when saving to Anki. */
export const $ankiRichCards = withPersist(
  createStore<boolean>(DEFAULT_ANKI_RICH_CARDS, { name: ANKI_RICH_CARDS_SETTING }),
);
export const ankiRichCardsChanged = createEvent<boolean>();
$ankiRichCards.on(ankiRichCardsChanged, (_, value) => value);

/** Theme for generated Anki cards: auto (match Anki) / light / dark (see src/shared/ankiSettings.ts). */
export const $ankiCardTheme = withPersist(
  createStore<TAnkiCardTheme>(DEFAULT_ANKI_CARD_THEME, { name: ANKI_CARD_THEME_SETTING }),
);
export const ankiCardThemeChanged = createEvent<TAnkiCardTheme>();
$ankiCardTheme.on(ankiCardThemeChanged, (_, value) => value);

/** Deck new Anki cards go into (created if missing). */
export const $ankiDeck = withPersist(createStore<string>(DEFAULT_ANKI_DECK, { name: ANKI_DECK_SETTING }));
export const ankiDeckChanged = createEvent<string>();
$ankiDeck.on(ankiDeckChanged, (_, value) => value);

/** Tags attached to new Anki cards (space/comma separated; see parseAnkiTags). */
export const $ankiTags = withPersist(createStore<string>(DEFAULT_ANKI_TAGS, { name: ANKI_TAGS_SETTING }));
export const ankiTagsChanged = createEvent<string>();
$ankiTags.on(ankiTagsChanged, (_, value) => value);

/**
 * Words saved to Anki (stable keys from knownKeyOf). Tracked separately from $knownWords so that
 * saving to Anki does not mark a word "known" (that is reserved for saving to Himotoki); it only
 * flips the popup's Anki save icon to a check.
 */
export const $ankiSavedWords = withPersist(createStore<string[]>([], { name: ANKI_SAVED_SETTING }));
export const ankiWordSaved = createEvent<string>();
$ankiSavedWords.on(ankiWordSaved, (list, key) => (list.includes(key) ? list : [...list, key]));

/** Video playback speed (see src/shared/playbackRate.ts). Applied to the video in videos/init.ts. */
export const $playbackRate = withPersist(createStore<number>(PLAYBACK_RATE_DEFAULT, { name: PLAYBACK_RATE_SETTING }));
export const playbackRateChanged = createEvent<number>();
export const playbackRateSpeedUp = createEvent();
export const playbackRateSpeedDown = createEvent();
$playbackRate
  .on(playbackRateChanged, (_, value) => clampRate(value))
  .on(playbackRateSpeedUp, (rate) => stepRate(rate, PLAYBACK_RATE_STEP))
  .on(playbackRateSpeedDown, (rate) => stepRate(rate, -PLAYBACK_RATE_STEP));

/** Listening mode: blur subtitle text; reveal on hover or the H peek toggle (see src/shared/listeningMode.ts). */
export const $listeningMode = withPersist(createStore<boolean>(DEFAULT_LISTENING_MODE, { name: LISTENING_MODE_SETTING }));
export const listeningModeChanged = createEvent<boolean>();
$listeningMode.on(listeningModeChanged, (_, value) => value);

/** Transient "peek" toggle (H): reveal the blurred text until toggled off. Reset when mode changes. */
export const $listeningPeek = createStore<boolean>(false);
export const listeningPeekToggled = createEvent();
$listeningPeek.on(listeningPeekToggled, (peek) => !peek).reset(listeningModeChanged);

export const esRenderSetings = createEvent();

sample({
  clock: enableToggleChanged,
  target: enableToggleChangeFx,
});

sample({
  clock: progressBarEnabledChanged,
  target: progressBarEnabledChangeFx,
});

sample({
  clock: translateLanguageChanged,
  target: translateLanguageChangeFx,
});

sample({
  clock: learningServiceChanged,
  target: learningServiceChangeFx,
});

sample({
  clock: translationServiceChanged,
  target: translationServiceChangeFx,
});

sample({
  clock: translationServiceChanged,
  filter: (service) => service === "deepl",
  target: deeplApiKeyModalOpened,
});

sample({
  clock: deeplApiKeyChanged,
  target: deeplApiKeyChangeFx,
});

sample({
  clock: subsFontSizeButtonPressed,
  target: subsFontSizeChangeFx,
});

sample({
  clock: subsBackgroundButtonPressed,
  target: subsBackgroundToggleFx,
});

sample({
  clock: subsBackgroundOpacityButtonPressed,
  filter: (value) => value >= 0 && value <= 100,
  target: subsBackgroundOpacityChangeFx,
});

$enabled.on(enableToggleChangeFx.doneData, (_, isEnabled) => isEnabled);
$progressBarEnabled.on(
  progressBarEnabledChangeFx.doneData,
  (_, isEnabled) => isEnabled,
);
$autoStopEnabled.on(autoStopEnabledChanged, (_, isEnabled) => isEnabled);
$netflixOnFlightEnabled.on(
  netflixOnFlightEnabledChanged,
  (_, isEnabled) => isEnabled,
);
$translateLanguage.on(
  translateLanguageChangeFx.doneData,
  (_, language) => language,
);
$learningService.on(learningServiceChangeFx.doneData, (_, service) => service);
$translationService.on(
  translationServiceChangeFx.doneData,
  (_, service) => service,
);
$deeplApiKey.on(deeplApiKeyChangeFx.doneData, (_, key) => key);
$deeplApiKeyModalOpen.on(deeplApiKeyModalOpened, () => true);
$deeplApiKeyModalOpen.on(deeplApiKeyModalClosed, () => false);
$subsFontSize.on(
  subsFontSizeChangeFx.doneData,
  (_, subsFontSize) => subsFontSize,
);
$subsBackground.on(subsBackgroundToggleFx.doneData, (_, value) => value);
$subsBackgroundOpacity.on(
  subsBackgroundOpacityChangeFx.doneData,
  (_, value) => value,
);
$activeSettingsTab.on(activeSettingsTabChanged, (_, value) => value);

$enabled.watch((isEnabled) => {
  document.body.classList.toggle("es-enabled", isEnabled);
});

sample({
  clock: netflixOnFlightEnabledChanged,
  target: netflixOnFlightEnabledChangedFx,
});

$progressBarEnabled.watch((isEnabled) => {
  document.body.classList.toggle("es-progress-bar-enabled", isEnabled);
});
$moveBySubsEnabled.watch((isEnabled) => {
  document.body.classList.toggle("es-move-by-subs-enabled", isEnabled);
});
$netflixOnFlightEnabled.watch((isEnabled) => {
  document.body.classList.toggle("es-netflix-on-flight", isEnabled);
  fetchCurrentStreamingFx();
});

debug(
  $enabled,
  $translateLanguage,
  $learningService,
  $translationService,
  $subsFontSize,
  $subsBackground,
  $moveBySubsEnabled,
  $hoverAction,
  $clickAction,
);
