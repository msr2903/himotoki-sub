import { FC } from "react";

import { useLineTranslation } from "@src/pages/content/hooks/useLineTranslation";

/** Whole-line translation bubble shown when a subtitle line is clicked. */
export const SubFullTranslation: FC<{ text: string }> = ({ text }) => {
  const { translation, error, pending } = useLineTranslation(text);
  if (pending || (!translation && !error)) return null;
  return <div className="es-full-translation">{translation ?? `Translation failed: ${error}`}</div>;
};

/** Second subtitle line in "translate" mode: the current line's machine translation, inline under the Japanese. */
export const SecondaryTranslation: FC<{ text: string }> = ({ text }) => {
  const { translation, error, pending } = useLineTranslation(text);
  if (pending) return <div className="es-sub-secondary es-sub-secondary--pending">…</div>;
  if (error) return <div className="es-sub-secondary es-sub-secondary--error">Translation failed</div>;
  if (!translation) return null;
  return <div className="es-sub-secondary">{translation}</div>;
};
