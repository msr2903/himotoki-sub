import { FC, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useUnit } from "effector-react";
import toast from "react-hot-toast";

import { $learningService } from "@src/models/settings";
import { tokenUnpinned } from "@src/models/translations";
import { $video } from "@src/models/videos";
import { useLookup } from "@src/pages/content/hooks/useLookup";
import { TSubItem, TWordTranslation, TWordTranslationItem } from "@src/models/types";
import ILearningService from "@src/learning-service/learningService";
import { getLearningService } from "@src/utils/getLearningService";
import { HIMOTOKI_API_BASE } from "@src/shared/himotokiConfig";
import { SoundIcon } from "./assets/SoundIcon";

const SENSE_LIMIT = 3;
const SERVICE_LABEL: Record<string, string> = { himotoki: "Save to Himotoki", anki: "Save to Anki" };

/** Highlight the dictionary's keyword inside an example sentence. */
const ExampleText: FC<{ text: string; keyword?: string }> = ({ text, keyword }) => {
  if (!keyword || !text.includes(keyword)) return <>{text}</>;
  const index = text.indexOf(keyword);
  return (
    <>
      {text.slice(0, index)}
      <mark className="es-ex-hit">{keyword}</mark>
      {text.slice(index + keyword.length)}
    </>
  );
};

/**
 * Dictionary pop-up for one token. Layout follows the entry card on himotoki.my.id: headword,
 * reading, pitch, tags, numbered senses, one example, then actions. When the surface matches more
 * than one dictionary entry, a ‹ n/m › switcher pages between them.
 */
export const SubItemTranslation: FC<{
  subItem: TSubItem;
  contextSentence?: string;
  /** Cue timing (ms) for replaying the line's audio from the video. */
  cueStart?: number;
  cueEnd?: number;
  /** Opened by click: stays until dismissed, shows Close. */
  pinned?: boolean;
}> = ({ subItem, contextSentence, cueStart, cueEnd, pinned }) => {
  const text = subItem.cleanedText || subItem.text;
  const { translation, pending } = useLookup(subItem);
  const [learningService, video, unpin] = useUnit([$learningService, $video, tokenUnpinned]);

  const [service, setService] = useState<ILearningService>(null);
  const [showAll, setShowAll] = useState(false);
  const [entryIndex, setEntryIndex] = useState(0);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const clipTimer = useRef<number | null>(null);

  useEffect(() => {
    setService(getLearningService(learningService));
  }, [learningService]);

  // Reset entry paging and "show more" when the token changes.
  useEffect(() => {
    setEntryIndex(0);
    setShowAll(false);
  }, [text]);

  useEffect(() => () => {
    if (clipTimer.current != null) window.clearTimeout(clipTimer.current);
  }, []);

  // Keep the popup inside the player: cap height to the space above the word, shift off the edges.
  const fitPopup = () => {
    const el = popupRef.current;
    if (!el) return;
    const token = el.parentElement;
    const player = document.getElementById("es")?.parentElement;
    if (!token || !player) return;
    const tokenRect = token.getBoundingClientRect();
    const playerRect = player.getBoundingClientRect();
    const zoom = Number(getComputedStyle(el).zoom) || 1;
    const available = Math.floor(tokenRect.top - playerRect.top - 12);
    el.style.maxHeight = `${Math.max(120, available / zoom)}px`;
    el.style.setProperty("--es-popup-shift", "0px");
    const rect = el.getBoundingClientRect();
    let shift = 0;
    if (rect.left < playerRect.left + 6) shift = playerRect.left + 6 - rect.left;
    else if (rect.right > playerRect.right - 6) shift = playerRect.right - 6 - rect.right;
    if (shift) el.style.setProperty("--es-popup-shift", `${Math.round(shift / zoom)}px`);
    el.classList.toggle("es-word-translation--scrollable", el.scrollHeight > el.clientHeight + 1);
  };
  useLayoutEffect(fitPopup);
  useEffect(() => {
    window.addEventListener("resize", fitPopup);
    return () => window.removeEventListener("resize", fitPopup);
  }, []);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  if (pending) {
    return (
      <div className="es-word-translation es-word-translation--status" onClick={stop} ref={popupRef}>
        Looking up…
      </div>
    );
  }

  if (!translation) {
    return (
      <div className="es-word-translation es-word-translation--status" onClick={stop} ref={popupRef}>
        No translation
      </div>
    );
  }

  if (translation.error) {
    return (
      <div className="es-word-translation" onClick={stop} ref={popupRef}>
        <header className="es-popup-head">
          <div className="es-popup-word">{text}</div>
        </header>
        <p className="es-popup-status">Lookup failed: {translation.error}</p>
      </div>
    );
  }

  if (!translation.mainTranslation && translation.translations.length === 0) {
    return (
      <div className="es-word-translation" onClick={stop} ref={popupRef}>
        <header className="es-popup-head">
          <div className="es-popup-word">{text}</div>
        </header>
        <p className="es-popup-status">No dictionary entry</p>
      </div>
    );
  }

  // The switcher pages across the token's dictionary entries; token-level fields (conjugation note,
  // lookup source) stay on the primary translation.
  const entries: TWordTranslation[] = [translation, ...(translation.alternatives ?? [])];
  const current = entries[Math.min(entryIndex, entries.length - 1)]!;
  const hasClip = video != null && cueStart != null && cueEnd != null && cueEnd > cueStart;

  const miningContext = {
    contextSentence: contextSentence || "",
    sourceUrl: typeof location !== "undefined" ? location.href : "",
    videoTitle: typeof document !== "undefined" ? document.title : "",
    timestampMs: video ? Math.floor(video.currentTime * 1000) : undefined,
  };

  const handleAddWord = (sense: TWordTranslationItem) => {
    if (!service) return;
    service
      .addWord(current.source, sense.word, {
        partOfSpeech: sense.partOfSpeech,
        context: miningContext.contextSentence,
        ...miningContext,
        himotokiSave: current.himotokiSave
          ? { ...current.himotokiSave, gloss: sense.word || current.himotokiSave.gloss }
          : undefined,
      })
      .then((value) => toast.success(value))
      .catch((error) => toast.error(typeof error === "string" ? error : error?.message || String(error)));
  };

  const handlePlaySound = () => {
    const msg = new SpeechSynthesisUtterance();
    msg.text = current.headword || current.source;
    msg.lang = "ja-JP";
    msg.rate = 0.8;
    window.speechSynthesis.speak(msg);
  };

  // Replay the subtitle line's own audio from the video (native pronunciation in context).
  const handlePlayClip = () => {
    if (!hasClip || !video) return;
    if (clipTimer.current != null) window.clearTimeout(clipTimer.current);
    video.currentTime = cueStart! / 1000;
    void video.play();
    clipTimer.current = window.setTimeout(
      () => {
        video.pause();
        clipTimer.current = null;
      },
      cueEnd! - cueStart! + 150,
    );
  };

  const headword = current.headword || current.source || text;
  const reading = current.reading && current.reading !== headword ? current.reading : null;
  const senses = current.translations.length
    ? current.translations
    : [{ word: current.mainTranslation, partOfSpeech: "unknown" as const, synonyms: [], popularity: 0 }];
  const visibleSenses = showAll ? senses : senses.slice(0, SENSE_LIMIT);
  const hiddenCount = senses.length - visibleSenses.length;
  const himotokiQuery = encodeURIComponent(current.himotokiSave?.headword || headword);
  const saveLabel = SERVICE_LABEL[learningService] ?? "Save";

  return (
    <div className="es-word-translation" onClick={stop} ref={popupRef}>
      {entries.length > 1 && (
        <div className="es-entry-switch">
          <button
            className="es-entry-arrow"
            title="Previous entry"
            onClick={() => setEntryIndex((i) => (i - 1 + entries.length) % entries.length)}
          >
            ‹
          </button>
          <span className="es-entry-count">
            {entryIndex + 1} / {entries.length}
          </span>
          <button
            className="es-entry-arrow"
            title="Next entry"
            onClick={() => setEntryIndex((i) => (i + 1) % entries.length)}
          >
            ›
          </button>
        </div>
      )}
      <header className="es-popup-head">
        <div className="es-popup-title">
          <span className="es-popup-word">{headword}</span>
          {hasClip && (
            <button className="es-popup-speak" title="Replay this line from the video" onClick={handlePlayClip}>
              ▶
            </button>
          )}
          <button className="es-popup-speak" title="Pronounce (synthesized)" onClick={handlePlaySound}>
            <SoundIcon />
          </button>
        </div>
        {reading && <p className="es-popup-reading">{reading}</p>}
        {(current.pitch || current.common || current.jlpt?.length || translation.conjugationNote) && (
          <div className="es-popup-tags">
            {current.pitch && <span className="es-tag es-tag-pitch">[{current.pitch}]</span>}
            {current.common && <span className="es-tag">common</span>}
            {current.jlpt?.map((level) => (
              <span key={level} className="es-tag">
                {level.toUpperCase()}
              </span>
            ))}
            {translation.conjugationNote && <span className="es-popup-conj">{translation.conjugationNote}</span>}
          </div>
        )}
      </header>

      <ol className="es-popup-senses">
        {visibleSenses.map((sense, index) => (
          <li key={index} className="es-sense">
            <span className="es-sense-num">{index + 1}</span>
            <div className="es-sense-body">
              {sense.partOfSpeech !== "unknown" && <span className="es-sense-pos">{sense.partOfSpeech}</span>}
              <span className="es-sense-gloss">{sense.word}</span>
            </div>
            {service && (
              <button className="es-sense-save" title={`${saveLabel} (this sense)`} onClick={() => handleAddWord(sense)}>
                +
              </button>
            )}
          </li>
        ))}
      </ol>
      {hiddenCount > 0 && (
        <button className="es-word-more" onClick={() => setShowAll(true)}>
          Show {hiddenCount} more {hiddenCount === 1 ? "sense" : "senses"}
        </button>
      )}
      {showAll && senses.length > SENSE_LIMIT && (
        <button className="es-word-more" onClick={() => setShowAll(false)}>
          Show fewer
        </button>
      )}

      {current.example && (
        <div className="es-popup-example">
          <span className="es-ex-label">Example</span>
          <p className="es-ex-jp">
            <ExampleText text={current.example.jp} keyword={current.example.keyword} />
          </p>
          {current.example.en && (
            <p className="es-ex-en">
              <span className="es-ex-lang">EN</span>
              {current.example.en}
            </p>
          )}
        </div>
      )}

      <footer className="es-popup-actions">
        {service && (
          <button
            className="es-popup-btn es-popup-btn--primary"
            style={{ "--es-service": service.color } as React.CSSProperties}
            onClick={() => handleAddWord(senses[0]!)}
          >
            {saveLabel}
          </button>
        )}
        <a className="es-popup-btn" href={`${HIMOTOKI_API_BASE}/?q=${himotokiQuery}`} target="_blank" rel="noreferrer">
          Open entry
        </a>
        {pinned && (
          <button className="es-popup-btn es-popup-btn--ghost" onClick={() => unpin()}>
            Close
          </button>
        )}
      </footer>
      {translation.lookupSource === "api" && (
        <div className="es-word-hint">Online lookup. Download the offline dictionary in the extension settings for instant results.</div>
      )}
    </div>
  );
};
