import { FC, useEffect, useMemo, useRef, useState } from "react";
import { useUnit } from "effector-react";

import { $currentSubs, $subs, transcriptClosed } from "@src/models/subs";
import { moveToTimeRequested } from "@src/models/videos";

/** mm:ss from a millisecond offset. */
const formatTime = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

/**
 * Searchable transcript of the whole video: every cue, filterable by text, click a line to seek the
 * video there. Toggled with T. Reads the processed subs; seeking reuses moveToTimeRequested.
 */
export const Transcript: FC = () => {
  const [subs, currentSubs, seek, close] = useUnit([$subs, $currentSubs, moveToTimeRequested, transcriptClosed]);
  const [query, setQuery] = useState("");
  const activeId = currentSubs[0]?.id ?? null;
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  const rows = useMemo(() => {
    const q = query.trim();
    if (!q) return subs;
    return subs.filter((sub) => (sub.cleanedText || "").includes(q));
  }, [subs, query]);

  // Keep the currently-playing line in view while it is not being filtered out.
  useEffect(() => {
    if (query.trim()) return;
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeId, query]);

  return (
    <div className="es-transcript" onClick={(e) => e.stopPropagation()}>
      <div className="es-breakdown-head">
        <span>Transcript</span>
        <button className="es-breakdown-close" title="Close (T)" onClick={() => close()}>
          ×
        </button>
      </div>
      <div className="es-transcript-search">
        <input
          type="text"
          value={query}
          placeholder="Search lines…"
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>
      <div className="es-transcript-rows" ref={listRef}>
        {subs.length === 0 ? (
          <div className="es-breakdown-empty">No subtitles loaded.</div>
        ) : rows.length === 0 ? (
          <div className="es-breakdown-empty">No lines match “{query}”.</div>
        ) : (
          rows.map((sub) => (
            <button
              key={sub.id}
              ref={sub.id === activeId ? activeRef : undefined}
              className={`es-transcript-row ${sub.id === activeId ? "es-transcript-row--active" : ""}`}
              onClick={() => seek(sub.start)}
              title="Jump to this line"
            >
              <span className="es-transcript-time">{formatTime(sub.start)}</span>
              <span className="es-transcript-text">{sub.cleanedText}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
