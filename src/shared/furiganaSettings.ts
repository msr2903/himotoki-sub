import type { TFuriganaMode, TReadingLineMode } from "@src/models/types";

/** Ruby furigana over kanji tokens: always on, only the hovered token, or never. */
export const FURIGANA_SETTING = "furigana";
export const DEFAULT_FURIGANA: TFuriganaMode = "always";

export const FURIGANA_OPTIONS: Array<{ value: TFuriganaMode; label: string; description: string }> = [
  { value: "always", label: "Always", description: "Reading over every kanji word in the subtitles." },
  { value: "hover", label: "On hover", description: "Reading only over the word under the pointer." },
  { value: "never", label: "Never", description: "No inline reading." },
];

export const isFuriganaMode = (value: unknown): value is TFuriganaMode =>
  FURIGANA_OPTIONS.some((o) => o.value === value);

/**
 * What to do with a kana "reading line" some channels print under the kanji line: hide the
 * duplicate (per-token ruby covers readings), or keep it as a small text line.
 */
export const READING_LINE_SETTING = "readingLine";
export const DEFAULT_READING_LINE: TReadingLineMode = "hide";

export const READING_LINE_OPTIONS: Array<{ value: TReadingLineMode; label: string; description: string }> = [
  { value: "hide", label: "Hide", description: "Remove the channel's kana line (furigana already gives readings)." },
  { value: "text", label: "Show as text", description: "Keep the kana line under the Japanese." },
];

export const isReadingLineMode = (value: unknown): value is TReadingLineMode =>
  READING_LINE_OPTIONS.some((o) => o.value === value);
