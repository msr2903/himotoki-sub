/** Colour theme of the extension pages (settings, toolbar popup, welcome). The in-player UI stays dark. */
export type TTheme = "light" | "dark";

export const THEME_SETTING = "theme";
export const DEFAULT_THEME: TTheme = "dark";

export const isTheme = (value: unknown): value is TTheme => value === "light" || value === "dark";
