import { useEffect } from "react";
import { useStoreMap, useUnit } from "effector-react";

import { $lookupPendings, $lookups, lookupKeyOf, lookupRequested } from "@src/models/translations";
import type { TSubItem, TWordTranslation } from "@src/models/types";
import { ownEntry } from "@src/shared/ownEntry";

/** Request (once) and read the dictionary result for a token. Safe for many tokens at once. */
export const useLookup = (
  subItem: TSubItem | string,
  enabled = true,
): { translation: TWordTranslation | null; pending: boolean } => {
  const key = lookupKeyOf(subItem);
  const request = useUnit(lookupRequested);
  const translation = useStoreMap({
    store: $lookups,
    keys: [key, enabled],
    fn: (lookups, [key, enabled]) => (enabled ? ownEntry(lookups, key) ?? null : null),
  });
  const pending = useStoreMap({
    store: $lookupPendings,
    keys: [key, enabled],
    fn: (pendings, [key, enabled]) => enabled && Boolean(ownEntry(pendings, key)),
  });

  useEffect(() => {
    if (key && enabled) request(key);
  }, [key, enabled, request]);

  return { translation, pending };
};
