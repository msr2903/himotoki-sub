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
import { useLookup } from "../../../src/pages/content/hooks/useLookup";
import { useLineTranslation } from "../../../src/pages/content/hooks/useLineTranslation";
import { convertJapaneseSubsWithLocalSplit } from "../../../src/utils/convertRawSubs";

// Render probes exercise the real hooks without relying on React Profiler (disabled
// in the production bundle). Unrelated cache writes must not rerender these nodes.
const hookRenders = { word: 0, disabled: 0, line: 0 };
function WordProbe({ enabled }: { enabled: boolean }) {
  const value = useLookup("audit-word", enabled);
  hookRenders[enabled ? "word" : "disabled"] += 1;
  return <output id={enabled ? "audit-word" : "audit-disabled"}>{JSON.stringify(value)}</output>;
}
function LineProbe() {
  const value = useLineTranslation("audit-line");
  hookRenders.line += 1;
  return <output id="audit-line">{JSON.stringify(value)}</output>;
}
Object.assign(window, {
  hookRenders,
  convertJapaneseSubsWithLocalSplit,
  mountHookProbes: () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    root.render(<><WordProbe enabled /><WordProbe enabled={false} /><LineProbe /></>);
    return () => { root.unmount(); host.remove(); };
  },
});

Object.assign(window, { audit: { subs, settings, videos, translations, $videoStats, knownKeyOf, replayVideoClip, cancelVideoClip } });
Object.assign(window, { renderAudit: () => createRoot(document.getElementById("root")!).render(<><Subs /><VideoStats /></>) });
