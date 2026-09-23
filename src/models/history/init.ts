import { sample } from "effector";

import { fetchWordTranslationFx } from "@src/models/translations";
import { $video } from "@src/models/videos";
import { TLookupHistoryItem, historyItemFromTranslation, lookupRecorded } from ".";

// Record every resolved lookup, remembering the video position so the panel can jump back to it.
const lookupHistoryCandidate = sample({
  clock: fetchWordTranslationFx.doneData,
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
