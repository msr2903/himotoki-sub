import type { TAnkiCardTheme } from "@src/utils/ankiNote";

/**
 * Rich Anki cards (Language-Reactor-style sentence mining). When on, saving a word to Anki builds a
 * card with the context sentence (target word bolded), reading, JLPT tags, a screenshot of the video
 * frame and an audio clip of the cue — instead of a bare word/meaning card. Best-effort: media that
 * cannot be captured (e.g. DRM video, no audio track) is simply omitted.
 */
export const ANKI_RICH_CARDS_SETTING = "ankiRichCards";
export const DEFAULT_ANKI_RICH_CARDS = true;

/**
 * Theme for the generated Anki card. "auto" follows Anki's own night mode; "light"/"dark" force the
 * card's appearance regardless of Anki's mode.
 */
export const ANKI_CARD_THEME_SETTING = "ankiCardTheme";
export const DEFAULT_ANKI_CARD_THEME: TAnkiCardTheme = "auto";

export const ANKI_CARD_THEME_OPTIONS: ReadonlyArray<{ value: TAnkiCardTheme; label: string; description: string }> = [
  { value: "auto", label: "Auto (match Anki)", description: "Follow Anki's own light/dark (night mode)." },
  { value: "light", label: "Light", description: "Always render the card in light mode." },
  { value: "dark", label: "Dark", description: "Always render the card in dark mode." },
];

export const isAnkiCardTheme = (v: unknown): v is TAnkiCardTheme => v === "auto" || v === "light" || v === "dark";
