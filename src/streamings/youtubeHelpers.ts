/** Pure helpers for the YouTube adapter, split out so they can be unit-tested. */

/**
 * Extract the video id from a YouTube URL. Covers watch?v=, youtu.be, /v/, /u/x/,
 * /embed/, /live/ (stream permalinks) and /shorts/ — the last two are normal watch
 * players with caption tracks, so they must not return "".
 */
export const videoIdFromUrl = (url: string): string => {
  const match = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|live\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/);
  return match && match[2]!.length === 11 ? match[2]! : "";
};
