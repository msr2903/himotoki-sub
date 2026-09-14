import type { TTokenAction } from "@src/models/types";

/** What hovering / clicking a subtitle word does. Shared by the in-player panel and the options page. */
export const TOKEN_ACTIONS: Array<{ value: TTokenAction; label: string; description: string }> = [
  { value: "both", label: "Furigana + meaning", description: "Reading and a short gloss above the word." },
  { value: "furigana", label: "Furigana", description: "Reading above the word." },
  { value: "meaning", label: "Meaning", description: "A short gloss above the word." },
  { value: "popup", label: "Pop-up dictionary", description: "Full dictionary entry with save buttons." },
  { value: "none", label: "No action", description: "Do nothing." },
];

export const DEFAULT_HOVER_ACTION: TTokenAction = "both";
export const DEFAULT_CLICK_ACTION: TTokenAction = "popup";

export const HOVER_ACTION_SETTING = "hoverAction";
export const CLICK_ACTION_SETTING = "clickAction";

export const isTokenAction = (value: unknown): value is TTokenAction =>
  TOKEN_ACTIONS.some((a) => a.value === value);
