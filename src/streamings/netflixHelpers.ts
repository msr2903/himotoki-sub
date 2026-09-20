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
