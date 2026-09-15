import React from "react";
import { createRoot } from "react-dom/client";
import "../../../src/models/init";
import * as subs from "../../../src/models/subs";
import * as settings from "../../../src/models/settings";
import * as videos from "../../../src/models/videos";
import * as translations from "../../../src/models/translations";
import { $videoStats } from "../../../src/models/stats";
import { Subs } from "../../../src/pages/content/components/Subs/Subs";
import { VideoStats } from "../../../src/pages/content/components/Settings/VideoStats";
import { knownKeyOf } from "../../../src/shared/knownWords";
import { replayVideoClip, cancelVideoClip } from "../../../src/utils/replayVideoClip";

Object.assign(window, { audit: { subs, settings, videos, translations, $videoStats, knownKeyOf, replayVideoClip, cancelVideoClip } });
Object.assign(window, { renderAudit: () => createRoot(document.getElementById("root")!).render(<><Subs /><VideoStats /></>) });
