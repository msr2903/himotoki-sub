import { useUnit } from "effector-react";

import type { TSubItem } from "@src/models/types";
import { $furiganaLevel } from "@src/models/settings";
import { useLookup } from "@src/pages/content/hooks/useLookup";
import { furiganaSegments, RubySegment } from "@src/utils/furigana";
import { showFuriganaForLevel } from "@src/shared/furiganaDifficulty";

/**
 * The ruby segments a token would render, or null when ruby falls back to plain text — while the
 * lookup is pending/failed, when the difficulty gate suppresses the reading, or when the dictionary
 * has no reading. Shared by TokenRuby and SubItem's hover label so the label shows the reading
 * exactly when ruby does not.
 */
export const useRubySegments = (subItem: TSubItem, enabled: boolean): RubySegment[] | null => {
  const { translation } = useLookup(subItem, enabled);
  const furiganaLevel = useUnit($furiganaLevel);
  if (!enabled || !translation || translation.error) return null;
  if (!showFuriganaForLevel(translation.jlpt, furiganaLevel)) return null;
  return furiganaSegments(subItem.text, translation.headword, translation.reading);
};
