import { FC } from "react";

import type { TSubItem } from "@src/models/types";
import { useRubySegments } from "@src/pages/content/hooks/useRubySegments";

/**
 * Inline ruby furigana over a kanji token. Ruby sits only over the kanji runs (food「た」べた), with
 * okurigana kept as plain text, using `furiganaSegments`. Words the learner already knows (by the
 * JLPT difficulty gate) render as plain text. Falls back to the plain surface while the lookup is
 * pending or when no reading is known, so text never disappears.
 */
export const TokenRuby: FC<{ subItem: TSubItem }> = ({ subItem }) => {
  const segments = useRubySegments(subItem, true);
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
