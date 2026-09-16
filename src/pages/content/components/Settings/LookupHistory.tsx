import { FC } from "react";
import { useUnit } from "effector-react";

import { $lookupHistory, historyCleared, historyItemRemoved } from "@src/models/history";
import { moveToTimeRequested } from "@src/models/videos";

const formatTime = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

/** Recent word lookups (this and past videos). Click a word to jump back to where you looked it up. */
export const LookupHistory: FC = () => {
  const [history, seek, remove, clear] = useUnit([
    $lookupHistory,
    moveToTimeRequested,
    historyItemRemoved,
    historyCleared,
  ]);

  return (
    <div className="es-lookup-history">
      <div className="es-lookup-history__head">
        <span className="es-lookup-history__title">Recent lookups</span>
        {history.length > 0 && (
          <button type="button" className="es-lookup-history__clear" onClick={() => clear()}>
            Clear
          </button>
        )}
      </div>
      {history.length === 0 ? (
        <p className="es-lookup-history__empty">No lookups yet — hover or click words to build your history.</p>
      ) : (
        <ul className="es-lookup-history__list">
          {history.slice(0, 50).map((item) => (
            <li key={item.key} className="es-lookup-history__item">
              <button
                type="button"
                className="es-lookup-history__word"
                title={item.videoTimeMs != null ? "Jump to when you looked it up" : undefined}
                disabled={item.videoTimeMs == null}
                onClick={() => item.videoTimeMs != null && seek(item.videoTimeMs)}
              >
                <span className="es-lookup-history__headword">{item.headword}</span>
                {item.reading && <span className="es-lookup-history__reading">{item.reading}</span>}
                {item.gloss && <span className="es-lookup-history__gloss">{item.gloss}</span>}
                {item.videoTimeMs != null && <span className="es-lookup-history__time">{formatTime(item.videoTimeMs)}</span>}
              </button>
              <button
                type="button"
                className="es-lookup-history__remove"
                title="Remove from history"
                onClick={() => remove(item.key)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
