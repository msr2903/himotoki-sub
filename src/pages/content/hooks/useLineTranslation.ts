import { useEffect } from "react";
import { useStoreMap, useUnit } from "effector-react";

import { $lineTranslationGeneration, $lineTranslationPendings, $lineTranslations, lineTranslationRequested } from "@src/models/translations";
import { ownEntry } from "@src/shared/ownEntry";

/** Request (once) and read the machine translation of a subtitle line. */
export const useLineTranslation = (text: string): { translation: string | null; error: string | null; pending: boolean } => {
  const key = text.trim();
  const [generation, request] = useUnit([$lineTranslationGeneration, lineTranslationRequested]);
  const entry = useStoreMap({
    store: $lineTranslations,
    keys: [key],
    fn: (translations, [key]) => ownEntry(translations, key) ?? null,
  });
  const pending = useStoreMap({
    store: $lineTranslationPendings,
    keys: [key],
    fn: (pendings, [key]) => Boolean(ownEntry(pendings, key)),
  });

  useEffect(() => {
    if (key) request(key);
  }, [key, generation, request]);

  return { translation: entry?.text || null, error: entry?.error ?? null, pending };
};
