import { onPersistedChange, readPersisted } from "@src/shared/persistedSettings";
import { DEFAULT_THEME, THEME_SETTING, TTheme, isTheme } from "@src/shared/themeSettings";

// Mirrors the persisted theme so the page paints in the right colours before chrome.storage answers.
const CACHE_KEY = "himotoki-theme";

const apply = (theme: TTheme) => {
  document.documentElement.dataset.hmTheme = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    localStorage.setItem(CACHE_KEY, theme);
  } catch {
    // Storage may be unavailable; the persisted setting still applies.
  }
};

/** Apply the persisted theme to an extension page and follow later changes. */
export function initPageTheme(): void {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (isTheme(cached)) apply(cached);
  } catch {
    // Fall through to chrome.storage.
  }
  void readPersisted<unknown>(THEME_SETTING, DEFAULT_THEME).then((v) => apply(isTheme(v) ? v : DEFAULT_THEME));
  onPersistedChange<unknown>(THEME_SETTING, (v) => {
    if (isTheme(v)) apply(v);
  });
}
