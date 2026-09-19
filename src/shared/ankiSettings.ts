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

/**
 * Anki save customizations (Yomitan-style): the deck new cards go into and the tags attached to them.
 * The deck is created via AnkiConnect `createDeck` if it does not exist. Tags are separated by spaces
 * or commas (Anki tags cannot contain spaces themselves).
 */
export const ANKI_DECK_SETTING = "ankiDeck";
export const DEFAULT_ANKI_DECK = "Himotoki";
export const ANKI_TAGS_SETTING = "ankiTags";
export const DEFAULT_ANKI_TAGS = "himotoki";

/** Persisted set of words saved to Anki (stable keys from knownKeyOf), kept separate from known words. */
export const ANKI_SAVED_SETTING = "ankiSavedWords";

/** Parse a user tags string ("himotoki mining, jp") into clean Anki tags (no spaces, no empties). */
export const parseAnkiTags = (raw: string): string[] =>
  raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
