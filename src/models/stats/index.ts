import { combine } from "effector";
import { $coverageKeys, $subs } from "../subs";
import { $knownWords } from "../settings";

/** Live coverage stats for the loaded video, derived from resolved keys + the known-word set. */
export const $videoStats = combine(
  $coverageKeys,
  $knownWords,
  $subs,
  (keys, known, subs) => {
    const uniqueKeys = new Set<string>();
    for (const key of Object.values(keys)) if (key) uniqueKeys.add(key);
    const total = uniqueKeys.size;
    if (!total) return null;
    const knownSet = new Set(known);
    let knownCount = 0;
    for (const key of uniqueKeys) if (knownSet.has(key)) knownCount += 1;
    // i+1: cues with exactly one resolved, not-yet-known word.
    let i1 = 0;
    for (const sub of subs) {
      const cueKeys = new Set<string>();
      let unresolved = false;
      for (const item of sub.items) {
        if (item.type !== "word") continue;
        const key = keys[item.cleanedText || item.text];
        if (key) cueKeys.add(key);
        else unresolved = true;
      }
      let unknown = 0;
      for (const key of cueKeys) if (!knownSet.has(key)) unknown += 1;
      if (!unresolved && unknown === 1) i1 += 1;
    }
    return { total, known: knownCount, percent: Math.round((knownCount / total) * 100), i1 };
  },
);
