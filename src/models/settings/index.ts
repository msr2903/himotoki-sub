import { createStore, createEvent, sample, createEffect } from "effector";
import { debug } from "patronum";

import { withPersist } from "@src/utils/withPersist";
import {
  addKeyboardEventsListeners,
  removeKeyboardEventsListeners,
} from "@src/utils/keyboardHandler";
import { TLearningService, TSecondarySubs, TTokenAction, TTranslationService } from "../types";
import { fetchCurrentStreamingFx } from "../streamings";
import {
  CLICK_ACTION_SETTING,
  DEFAULT_CLICK_ACTION,
  DEFAULT_HOVER_ACTION,
  HOVER_ACTION_SETTING,
} from "@src/shared/tokenActions";
import { UI_SCALE_DEFAULT, UI_SCALE_SETTING, clampUiScale } from "@src/shared/uiScale";
import { DEFAULT_SECONDARY_SUBS, SECONDARY_SUBS_SETTING, nextSecondarySubs } from "@src/shared/secondarySubs";

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
export const moveBySubsEnabledChangeFx = createEffect<boolean, boolean>(
  (isEnabled) => {
    if (isEnabled) {
      addKeyboardEventsListeners();
    } else {
      removeKeyboardEventsListeners();
    }
    return isEnabled;
  },
);

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

/** Size of the pop-up, hover labels and settings panel, in percent (50–150). */
export const $uiScale = withPersist(createStore<number>(UI_SCALE_DEFAULT, { name: UI_SCALE_SETTING }));
export const uiScaleChanged = createEvent<number>();
$uiScale.on(uiScaleChanged, (_, value) => clampUiScale(value));

/** Second subtitle line: off, subtitle track in the translate-to language, or machine translation. */
export const $secondarySubs = withPersist(
  createStore<TSecondarySubs>(DEFAULT_SECONDARY_SUBS, { name: SECONDARY_SUBS_SETTING }),
);
export const secondarySubsChanged = createEvent<TSecondarySubs>();
export const secondarySubsCycled = createEvent();
$secondarySubs.on(secondarySubsChanged, (_, value) => value).on(secondarySubsCycled, (current) => nextSecondarySubs(current));

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
  clock: moveBySubsEnabledChanged,
  target: moveBySubsEnabledChangeFx,
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
$moveBySubsEnabled.on(
  moveBySubsEnabledChangeFx.doneData,
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
