import { FC } from "react";

import type { TSubItem } from "@src/models/types";
import { useLookup } from "@src/pages/content/hooks/useLookup";
import { surfaceReading } from "@src/utils/furigana";

/**
 * Inline ruby furigana over a kanji token. Renders the reading from the local dictionary above the
 * surface with `<ruby><rt>`. Falls back to the plain surface while the lookup is pending or when no
 * reading is known, so text never disappears.
 */
export const TokenRuby: FC<{ subItem: TSubItem }> = ({ subItem }) => {
  const { translation } = useLookup(subItem);
  const reading =
    translation && !translation.error
      ? surfaceReading(subItem.text, translation.headword, translation.reading)
      : null;
  if (!reading) return <>{subItem.text}</>;
  return (
    <ruby>
      {subItem.text}
      <rt>{reading}</rt>
    </ruby>
  );
};
