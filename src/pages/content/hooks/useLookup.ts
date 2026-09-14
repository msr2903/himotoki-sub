import { useEffect } from "react";
import { useUnit } from "effector-react";

import { $lookupPendings, $lookups, lookupKeyOf, lookupRequested } from "@src/models/translations";
import type { TSubItem, TWordTranslation } from "@src/models/types";

/** Request (once) and read the dictionary result for a token. Safe for many tokens at once. */
export const useLookup = (
  subItem: TSubItem | string,
  enabled = true,
): { translation: TWordTranslation | null; pending: boolean } => {
  const key = lookupKeyOf(subItem);
  const [lookups, pendings, request] = useUnit([$lookups, $lookupPendings, lookupRequested]);

  useEffect(() => {
    if (key && enabled) request(subItem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  if (!enabled) return { translation: null, pending: false };
  return { translation: lookups[key] ?? null, pending: Boolean(pendings[key]) };
};
