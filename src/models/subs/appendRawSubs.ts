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
  if (lastSub.text != newSubs[0].text && lastSub.start != newSubs[0].start) {
    // Clamp the previous cue's end so it doesn't overlap the new one.
    const clampedLast = { ...lastSub, end: lastSub.start };
    return [...oldSubs.slice(0, -1), clampedLast, ...newSubs];
  }
  return oldSubs;
};
