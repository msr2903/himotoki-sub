import { createStore, sample } from "effector";

import { $lookups, fetchWordTranslationFx, lookupKeyOf, lookupVisited } from "@src/models/translations";
import type { TWordTranslation } from "@src/models/types";
import { $video } from "@src/models/videos";
import { ownEntry } from "@src/shared/ownEntry";
import { TLookupHistoryItem, historyItemFromTranslation, lookupRecorded } from ".";

const usable = (tx: TWordTranslation | undefined): tx is TWordTranslation =>
  Boolean(tx && !tx.error && tx.lookupSource !== "none");

// A visit is recorded as soon as its result is known: immediately on a cache hit, otherwise when the
// lookup it is waiting for resolves. Keys visited before their result arrived wait here.
const $awaitingVisit = createStore<Record<string, true>>({});

const visit = sample({
  clock: lookupVisited,
  source: $lookups,
  fn: (lookups, payload) => {
    const key = lookupKeyOf(payload);
    const cached = ownEntry(lookups, key);
    return { key, cached: usable(cached) ? cached : null };
  },
});
const cachedVisit = sample({
  clock: visit,
  filter: (v): v is { key: string; cached: TWordTranslation } => Boolean(v.key) && v.cached !== null,
  fn: (v) => v.cached,
});
const awaitedVisitResolved = sample({
  clock: fetchWordTranslationFx.doneData,
  source: $awaitingVisit,
  filter: (awaiting, tx) => Boolean(ownEntry(awaiting, tx.source)),
  fn: (_, tx) => tx,
});
$awaitingVisit
  .on(visit, (awaiting, { key, cached }) => (!key || cached ? awaiting : { ...awaiting, [key]: true }))
  .on(awaitedVisitResolved, (awaiting, tx) => {
    const copy = { ...awaiting };
    delete copy[tx.source];
    return copy;
  });

// Record the visit with the current page and video position so the panel can jump back to it.
const lookupHistoryCandidate = sample({
  clock: [cachedVisit, awaitedVisitResolved],
  source: $video,
  fn: (video, translation) =>
    historyItemFromTranslation(
      translation,
      video ? Math.floor(video.currentTime * 1000) : undefined,
      typeof document !== "undefined" ? document.title : undefined,
      typeof location !== "undefined" ? location.href : undefined,
    ),
});

sample({
  clock: lookupHistoryCandidate,
  filter: (item): item is TLookupHistoryItem => item !== null,
  target: lookupRecorded,
});
