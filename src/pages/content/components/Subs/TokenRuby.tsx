import { FC } from "react";
import { useUnit } from "effector-react";

import type { TSubItem } from "@src/models/types";
import { $furiganaLevel } from "@src/models/settings";
import { useLookup } from "@src/pages/content/hooks/useLookup";
import { furiganaSegments } from "@src/utils/furigana";
import { showFuriganaForLevel } from "@src/shared/furiganaDifficulty";

/**
 * Inline ruby furigana over a kanji token. Ruby sits only over the kanji runs (food「た」べた), with
 * okurigana kept as plain text, using `furiganaSegments`. Words the learner already knows (by the
 * JLPT difficulty gate) render as plain text. Falls back to the plain surface while the lookup is
 * pending or when no reading is known, so text never disappears.
 */
export const TokenRuby: FC<{ subItem: TSubItem }> = ({ subItem }) => {
  const { translation } = useLookup(subItem);
  const furiganaLevel = useUnit($furiganaLevel);
  const gatedOut = Boolean(translation) && !showFuriganaForLevel(translation?.jlpt, furiganaLevel);
  const segments =
    translation && !translation.error && !gatedOut
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
