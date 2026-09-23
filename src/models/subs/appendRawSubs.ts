import { Captions } from "../types";

/**
 * Reducer for the `rawSubsAdded` event: services that surface captions one cue at
 * a time (MutationObserver-driven — Amazon/Plex/Kinopoisk/Udemy/in-flight Netflix)
 * emit a single incremental cue, which we append to the accumulated list.
 *
 * Pure and immutable: it never mutates a cue object already held in the store.
 * Returns the same `oldSubs` reference (a no-op for effector) when the incoming
 * cue duplicates the last one.
 */
export const appendRawSubs = (oldSubs: Captions, newSubs: Captions): Captions => {
  const lastSub = oldSubs[oldSubs.length - 1];
  if (!lastSub) {
    return [...oldSubs, ...newSubs];
  }
  const next = newSubs[0];
  if (!next) return oldSubs;
  const nextStart = Number(next.start);
  const lastStart = Number(lastSub.start);
  if (lastSub.text === next.text && lastStart === nextStart) return oldSubs; // true duplicate
  if (nextStart <= lastStart) {
    // Same moment or out-of-order: the observer emitted a revised cue — replace the last one.
    return [...oldSubs.slice(0, -1), ...newSubs];
  }
  // Clamp the previous cue's end to the new cue's start so they don't overlap — but keep
  // its real duration (end = own start produced zero-length cues that could never replay).
  return [
    ...oldSubs.slice(0, -1),
    { ...lastSub, end: Math.min(Number(lastSub.end), nextStart) },
    ...newSubs,
  ];
};
