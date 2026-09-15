import { FC, useEffect, useState } from "react";
import { useUnit } from "effector-react";

import { $currentSubs, sentenceClosed } from "@src/models/subs";
import { shortGloss, surfaceReading } from "@src/utils/furigana";
import { himotokiTokenToWordTranslation, type HimotokiToken } from "@src/utils/himotokiTypes";

/** One local batch per cue; never use the hover cache's online fallback. */
export const SentenceBreakdown: FC = () => {
  const [currentSubs, close] = useUnit([$currentSubs, sentenceClosed]);
  const sub = currentSubs[0];
  const words = (sub?.items ?? []).filter((item) => item.type === "word");
  const [result, setResult] = useState<{ sub: typeof sub; tokens: HimotokiToken[]; message?: string } | null>(null);

  useEffect(() => {
    let live = true;
    if (!sub) return;
    void chrome.runtime.sendMessage({
      type: "himotokiLookupBatch",
      surfaces: sub.items.filter((item) => item.type === "word").map((item) => item.cleanedText || item.text),
    }).then((resp) => {
      if (!live) return;
      if (!resp?.ok) throw new Error("lookup failed");
      setResult({ sub, tokens: resp.data?.results ?? [], message: resp.data?.available ? undefined : "Install the offline dictionary in Settings to see this breakdown." });
    }).catch(() => {
      if (live) setResult({ sub, tokens: [], message: "Could not read the offline dictionary." });
    });
    return () => { live = false; };
  }, [sub]);

  const current = result?.sub === sub ? result : null;
  return (
    <div className="es-breakdown" onClick={(e) => e.stopPropagation()}>
      <div className="es-breakdown-head">
        <span>Sentence breakdown</span>
        <button className="es-breakdown-close" title="Close (B)" onClick={() => close()}>×</button>
      </div>
      {words.length === 0 ? (
        <div className="es-breakdown-empty">No line on screen.</div>
      ) : current?.message ? (
        <div className="es-breakdown-empty">{current.message}</div>
      ) : (
        <div className="es-breakdown-rows">
          {words.map((item, i) => {
            const token = current?.tokens[i];
            const translation = token ? himotokiTokenToWordTranslation(token) : null;
            const reading = translation ? surfaceReading(item.text, translation.headword, translation.reading) : null;
            const gloss = translation ? shortGloss(translation.mainTranslation, 40) : "";
            return (
              <div className="es-breakdown-row" key={`${i}-${item.text}`}>
                <div className="es-breakdown-surface">
                  <span className="es-breakdown-word">{item.text}</span>
                  {reading && <span className="es-breakdown-reading">{reading}</span>}
                </div>
                <div className="es-breakdown-gloss">{!current ? "…" : gloss || "—"}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
