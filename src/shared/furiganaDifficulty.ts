import type { TFuriganaLevel } from "@src/models/types";

/**
 * Difficulty gate for furigana: hide readings on words the learner already knows (by JLPT level),
 * so only harder words get ruby. Leverages the JLPT data folded into the dictionary.
 */
export const FURIGANA_LEVEL_SETTING = "furiganaLevel";
export const DEFAULT_FURIGANA_LEVEL: TFuriganaLevel = "off";

export const FURIGANA_LEVEL_OPTIONS: Array<{ value: TFuriganaLevel; label: string; description: string }> = [
  { value: "off", label: "All words", description: "Show furigana on every kanji word." },
  { value: "n5", label: "Skip N5", description: "Hide furigana on N5 words; show it on N4 and harder." },
  { value: "n4", label: "Skip N5–N4", description: "Hide furigana up to N4; show N3 and harder." },
  { value: "n3", label: "Skip N5–N3", description: "Hide furigana up to N3; show N2 and harder." },
  { value: "n2", label: "Skip N5–N2", description: "Hide furigana up to N2; show only N1 and unlisted words." },
  { value: "n1", label: "Only rare words", description: "Hide furigana on all JLPT words; show only unlisted (rare) ones." },
];

export const isFuriganaLevel = (value: unknown): value is TFuriganaLevel =>
  FURIGANA_LEVEL_OPTIONS.some((o) => o.value === value);

/**
 * A word's "ease": N5=5 (easiest) … N1=1 (hardest); 0 when the word is not in any JLPT list
 * (unknown/rare, so always worth annotating). Uses the easiest listing.
 */
export const wordEase = (jlpt?: string[]): number => {
  if (!jlpt || !jlpt.length) return 0;
  let ease = 0;
  for (const tag of jlpt) {
    const n = Number(String(tag).replace(/[^0-9]/g, ""));
    if (n >= 1 && n <= 5) ease = Math.max(ease, n);
  }
  return ease;
};

/**
 * Should a word get furigana under this difficulty setting? Hide it when it is at or easier than the
 * chosen known level; always show unlisted (ease 0) and everything when the gate is off.
 */
export const showFuriganaForLevel = (jlpt: string[] | undefined, level: TFuriganaLevel): boolean => {
  if (level === "off") return true;
  const ease = wordEase(jlpt);
  if (ease === 0) return true; // unknown/rare word
  // "Skip N5" hides ease 5; "skip up to N3" hides ease 5,4,3; etc. The number in the level name is
  // exactly the easiest ease still hidden, so hide when ease >= that number.
  const hideEaseAtLeast = Number(level.slice(1)); // n5->5 … n1->1
  return ease < hideEaseAtLeast;
};
