import { FC } from "react";

import type { TSubItem } from "@src/models/types";
import { useLookup } from "@src/pages/content/hooks/useLookup";
import { shortGloss, surfaceReading } from "@src/utils/furigana";

/** Small annotation above a token: reading (furigana), short meaning, or both. */
export const TokenLabel: FC<{
  subItem: TSubItem;
  mode: "furigana" | "meaning" | "both";
  /** When ruby already shows the reading over this token, suppress the label's reading to avoid duplication. */
  showReading?: boolean;
  /** When ruby is drawn over this token, lift the label above the ruby so they do not overlap. */
  offsetForRuby?: boolean;
}> = ({ subItem, mode, showReading = true, offsetForRuby = false }) => {
  const { translation, pending } = useLookup(subItem);
  if (pending || !translation || translation.error) return null;

  const reading =
    mode !== "meaning" && showReading
      ? surfaceReading(subItem.text, translation.headword, translation.reading)
      : null;
  const meaning = mode !== "furigana" ? shortGloss(translation.mainTranslation) : null;
  if (!reading && !meaning) return null;

  return (
    <span className={`es-token-label${offsetForRuby ? " es-token-label--above-ruby" : ""}`}>
      {reading && <span className="es-token-label-reading">{reading}</span>}
      {meaning && <span className="es-token-label-meaning">{meaning}</span>}
    </span>
  );
};
