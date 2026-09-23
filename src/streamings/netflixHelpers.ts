/** Pure helpers for the Netflix adapter, split out so they can be unit-tested. */

export type TrackKey = { lang: string; postfix: string };

/**
 * Reduce a track title to its primary language subtag plus any [cc]/-forced postfix.
 * The subtitle cache is keyed off `track.language` ("ja") but getSubs is called with
 * `track.bcp47` ("ja-JP"); comparing primary keys lets the two formats resolve to one track.
 */
export const primaryTrackKey = (title: string): TrackKey => {
  let postfix = "";
  let base = title;
  if (base.endsWith("[cc]")) {
    postfix = "[cc]";
    base = base.slice(0, -"[cc]".length);
  } else if (base.endsWith("-forced")) {
    postfix = "-forced";
    base = base.slice(0, -"-forced".length);
  }
  const lang = base.split("-")[0];
  return { lang, postfix };
};

/** Total on-screen time of an ad break: the sum of each ad's own length (end - start). */
export const adBreakDurationMs = (ads: Array<{ startTimeMs: number; endTimeMs: number }>): number =>
  ads.reduce((total, ad) => total + (ad.endTimeMs - ad.startTimeMs), 0);

export type AdBreak = { locationMs: number; durationMs: number };

/**
 * Shift cue times by every ad break that starts before the cue — breaks are cumulative,
 * so a cue after two breaks moves by their combined duration. Pure; returns cue objects
 * unchanged (same references) when no break applies.
 */
export const resyncSubsWithAdBreaks = <T extends { start: number | string; end: number | string }>(
  subs: T[],
  adBreaks: readonly AdBreak[],
): T[] =>
  subs.map((sub) => {
    const start = Number(sub.start);
    const shift = adBreaks.reduce(
      (total, adBreak) => (start >= adBreak.locationMs ? total + adBreak.durationMs : total),
      0,
    );
    if (!shift) return sub;
    return { ...sub, start: start + shift, end: Number(sub.end) + shift };
  });
