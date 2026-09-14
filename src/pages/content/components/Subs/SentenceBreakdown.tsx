import { FC } from "react";
import { useUnit } from "effector-react";

import { $currentSubs, sentenceClosed } from "@src/models/subs";
import type { TSub, TSubItem } from "@src/models/types";
import { useLookup } from "@src/pages/content/hooks/useLookup";
import { shortGloss, surfaceReading } from "@src/utils/furigana";

/** One token row: surface, reading (furigana), and a short gloss. All local, no network. */
const BreakdownRow: FC<{ item: TSubItem }> = ({ item }) => {
  const { translation, pending } = useLookup(item);
  const reading = translation ? surfaceReading(item.text, translation.headword, translation.reading) : null;
  const gloss = translation && !translation.error ? shortGloss(translation.mainTranslation, 40) : "";
  return (
    <div className="es-breakdown-row">
      <div className="es-breakdown-surface">
        <span className="es-breakdown-word">{item.text}</span>
        {reading && <span className="es-breakdown-reading">{reading}</span>}
      </div>
      <div className="es-breakdown-gloss">{pending ? "…" : gloss || "—"}</div>
    </div>
  );
};

/**
 * Local breakdown of the current subtitle line: every word token with its reading and a short
 * gloss, straight from the offline dictionary (no machine translation). Toggled with B.
 */
export const SentenceBreakdown: FC = () => {
  const [currentSubs, close] = useUnit([$currentSubs, sentenceClosed]);
  const sub: TSub | undefined = currentSubs[0];
  const words = (sub?.items ?? []).filter((item) => item.type === "word");

  return (
    <div className="es-breakdown" onClick={(e) => e.stopPropagation()}>
      <div className="es-breakdown-head">
        <span>Sentence breakdown</span>
        <button className="es-breakdown-close" title="Close (B)" onClick={() => close()}>
          ×
        </button>
      </div>
      {words.length === 0 ? (
        <div className="es-breakdown-empty">No line on screen.</div>
      ) : (
        <div className="es-breakdown-rows">
          {words.map((item, i) => (
            <BreakdownRow key={`${i}-${item.text}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};
