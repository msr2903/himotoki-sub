import { Captions } from "../types";

/**
 * The observer reads media time when the caption mutates, so replaying a recorded cue reports a
 * start a little after the recorded one. Same text within this window is the same cue.
 */
const REVISIT_TOLERANCE_MS = 1000;

/**
 * Reducer for the `rawSubsAdded` event: services that surface captions one cue at
 * a time (MutationObserver-driven — Amazon/Plex/Kinopoisk/Udemy/in-flight Netflix)
 * emit a single incremental cue, which we append to the accumulated list.
 *
 * Pure and immutable: it never mutates a cue object already held in the store.
 * Returns the same `oldSubs` reference (a no-op for effector) when the incoming
 * cue is already recorded.
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
  const isRecorded = (cue: Captions[number]) =>
    cue.text === next.text && Math.abs(Number(cue.start) - nextStart) <= REVISIT_TOLERANCE_MS;
  if (lastSub.text === next.text && lastStart === nextStart) return oldSubs; // true duplicate
  if (nextStart === lastStart) {
    // Same moment: the observer emitted a revised cue — replace the last one.
    return [...oldSubs.slice(0, -1), ...newSubs];
  }
  if (nextStart < lastStart) return insertEarlierCue(oldSubs, next, isRecorded);
  if (isRecorded(lastSub)) return oldSubs; // replaying the newest cue after a rewind
  // Clamp the previous cue's end to the new cue's start so they don't overlap — but keep
  // its real duration (end = own start produced zero-length cues that could never replay).
  return [
    ...oldSubs.slice(0, -1),
    { ...lastSub, end: Math.min(Number(lastSub.end), nextStart) },
    ...newSubs,
  ];
};

/**
 * A cue earlier than the newest one comes from seeking backward. Replaying a recorded cue changes
 * nothing; a revision (same start) replaces that cue; a cue not seen before is inserted in time
 * order between its neighbours. A cleared caption carries no new line and is ignored.
 */
const insertEarlierCue = (
  oldSubs: Captions,
  next: Captions[number],
  isRecorded: (cue: Captions[number]) => boolean,
): Captions => {
  if (!next.text || oldSubs.some(isRecorded)) return oldSubs;
  const nextStart = Number(next.start);
  const at = oldSubs.findIndex((cue) => Number(cue.start) >= nextStart);
  const replaces = Number(oldSubs[at]!.start) === nextStart;
  const following = oldSubs[replaces ? at + 1 : at];
  const cue = following ? { ...next, end: Math.min(Number(next.end), Number(following.start)) } : next;
  const previous = oldSubs[at - 1];
  return [
    ...oldSubs.slice(0, Math.max(at - 1, 0)),
    ...(previous ? [{ ...previous, end: Math.min(Number(previous.end), nextStart) }] : []),
    cue,
    ...oldSubs.slice(replaces ? at + 1 : at),
  ];
};
