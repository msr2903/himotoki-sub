import type { TSecondarySubs } from "@src/models/types";

export const SECONDARY_SUBS_SETTING = "secondarySubs";
export const DEFAULT_SECONDARY_SUBS: TSecondarySubs = "off";

export const SECONDARY_SUBS_OPTIONS: Array<{ value: TSecondarySubs; label: string; description: string }> = [
  { value: "off", label: "Off", description: "Japanese only." },
  {
    value: "track",
    label: "Subtitle track",
    description: "The video's own subtitles in your translate-to language (on YouTube, its auto-translation when there is no such track).",
  },
  { value: "translate", label: "Translation", description: "Machine translation of the current line (Google or DeepL)." },
];

export const isSecondarySubs = (value: unknown): value is TSecondarySubs =>
  SECONDARY_SUBS_OPTIONS.some((o) => o.value === value);

export const nextSecondarySubs = (current: TSecondarySubs): TSecondarySubs => {
  const order = SECONDARY_SUBS_OPTIONS.map((o) => o.value);
  return order[(order.indexOf(current) + 1) % order.length]!;
};
