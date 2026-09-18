/**
 * Rich Anki cards (Language-Reactor-style sentence mining). When on, saving a word to Anki builds a
 * card with the context sentence (target word bolded), reading, JLPT tags, a screenshot of the video
 * frame and an audio clip of the cue — instead of a bare Front=word / Back=gloss card. Best-effort:
 * media that cannot be captured (e.g. DRM video, no audio track) is simply omitted.
 */
export const ANKI_RICH_CARDS_SETTING = "ankiRichCards";
export const DEFAULT_ANKI_RICH_CARDS = true;
