import { FC } from "react";

import type { TSubItem } from "@src/models/types";
import { useLookup } from "@src/pages/content/hooks/useLookup";
import { furiganaSegments } from "@src/utils/furigana";

/**
 * Inline ruby furigana over a kanji token. Ruby sits only over the kanji runs (food「た」べた), with
 * okurigana kept as plain text, using `furiganaSegments`. Falls back to the plain surface while the
 * lookup is pending or when no reading is known, so text never disappears.
 */
export const TokenRuby: FC<{ subItem: TSubItem }> = ({ subItem }) => {
  const { translation } = useLookup(subItem);
  const segments =
    translation && !translation.error
      ? furiganaSegments(subItem.text, translation.headword, translation.reading)
      : null;
  if (!segments) return <>{subItem.text}</>;
  return (
    <>
      {segments.map((seg, i) =>
        seg.rt ? (
          <ruby key={i}>
            {seg.text}
            <rt>{seg.rt}</rt>
          </ruby>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
};
