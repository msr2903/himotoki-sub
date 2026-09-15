import { wordEase } from "./furiganaDifficulty";

/**
 * Colour subtitle words by JLPT difficulty (opt-in), so the difficulty of a line reads at a glance.
 * Uses the JLPT data folded into the dictionary. Resolving each token has a cost, so this is off by
 * default and only enables per-token lookups when turned on.
 */
export const COLOR_BY_DIFFICULTY_SETTING = "colorByDifficulty";
export const DEFAULT_COLOR_BY_DIFFICULTY = false;

/** CSS class for a word's JLPT difficulty band, or "" when it should keep the default colour. */
export const jlptColorClass = (jlpt?: string[]): string => {
  const ease = wordEase(jlpt); // 5 = N5 (easy) … 1 = N1 (hard); 0 = unlisted
  switch (ease) {
    case 5:
      return "es-jlpt-n5";
    case 4:
      return "es-jlpt-n4";
    case 3:
      return "es-jlpt-n3";
    case 2:
      return "es-jlpt-n2";
    case 1:
      return "es-jlpt-n1";
    default:
      return ""; // unlisted / rare: leave at default colour
  }
};
