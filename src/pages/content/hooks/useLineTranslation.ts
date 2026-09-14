import { useEffect } from "react";
import { useUnit } from "effector-react";

import { $lineTranslationPendings, $lineTranslations, lineTranslationRequested } from "@src/models/translations";

/** Request (once) and read the machine translation of a subtitle line. */
export const useLineTranslation = (text: string): { translation: string | null; error: string | null; pending: boolean } => {
  const key = text.trim();
  const [translations, pendings, request] = useUnit([$lineTranslations, $lineTranslationPendings, lineTranslationRequested]);

  useEffect(() => {
    if (key) request(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const entry = translations[key];
  return { translation: entry?.text || null, error: entry?.error ?? null, pending: Boolean(pendings[key]) };
};
