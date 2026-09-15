import { sample } from "effector";

import { $subs } from "../subs";
import { checkDictReadyFx } from ".";

// Learn whether the offline dictionary is ready at startup and again whenever a new caption track
// is processed, so always-on furigana can be gated on it without spamming the HTTP API.
checkDictReadyFx();
sample({ clock: $subs.updates, target: checkDictReadyFx });
