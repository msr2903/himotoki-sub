import { FC, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useUnit } from "effector-react";
import toast from "react-hot-toast";

import { $learningService } from "@src/models/settings";
import { tokenUnpinned } from "@src/models/translations";
import { $video } from "@src/models/videos";
import { useLookup } from "@src/pages/content/hooks/useLookup";
import { TSubItem, TWordTranslationItem } from "@src/models/types";
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
 * reading, tags, numbered senses with part of speech, one example, then actions.
 */
export const SubItemTranslation: FC<{
  subItem: TSubItem;
  contextSentence?: string;
  /** Opened by click: stays until dismissed, shows Close. */
  pinned?: boolean;
}> = ({ subItem, contextSentence, pinned }) => {
  const text = subItem.cleanedText || subItem.text;
  const { translation, pending } = useLookup(subItem);
  const [learningService, video, unpin] = useUnit([$learningService, $video, tokenUnpinned]);

  const [service, setService] = useState<ILearningService>(null);
  const [showAll, setShowAll] = useState(false);
  const popupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setService(getLearningService(learningService));
  }, [learningService]);

  // Keep the popup inside the player: cap its height to the space above the word and shift it
  // horizontally away from the player edges. Re-run whenever the content changes.
  const fitPopup = () => {
    const el = popupRef.current;
    if (!el) return;
    const token = el.parentElement;
    const player = document.getElementById("es")?.parentElement;
    if (!token || !player) return;
    const tokenRect = token.getBoundingClientRect();
    const playerRect = player.getBoundingClientRect();
    // The popup is scaled with CSS zoom (pop-up size setting); its own px units are zoomed units.
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

  const miningContext = {
    contextSentence: contextSentence || "",
    sourceUrl: typeof location !== "undefined" ? location.href : "",
    videoTitle: typeof document !== "undefined" ? document.title : "",
    timestampMs: video ? Math.floor(video.currentTime * 1000) : undefined,
  };

  const handleAddWord = (sense: TWordTranslationItem) => {
    if (!service) return;
    service
      .addWord(translation.source, sense.word, {
        partOfSpeech: sense.partOfSpeech,
        context: miningContext.contextSentence,
        ...miningContext,
        himotokiSave: translation.himotokiSave
          ? { ...translation.himotokiSave, gloss: sense.word || translation.himotokiSave.gloss }
          : undefined,
      })
      .then((value) => toast.success(value))
      .catch((error) => toast.error(typeof error === "string" ? error : error?.message || String(error)));
  };

  const handlePlaySound = () => {
    const msg = new SpeechSynthesisUtterance();
    msg.text = translation.headword || translation.source;
    msg.lang = "ja-JP";
    msg.rate = 0.8;
    window.speechSynthesis.speak(msg);
  };

  const headword = translation.headword || translation.source || text;
  const reading = translation.reading && translation.reading !== headword ? translation.reading : null;
  const senses = translation.translations.length
    ? translation.translations
    : [{ word: translation.mainTranslation, partOfSpeech: "unknown" as const, synonyms: [], popularity: 0 }];
  const visibleSenses = showAll ? senses : senses.slice(0, SENSE_LIMIT);
  const hiddenCount = senses.length - visibleSenses.length;
  const himotokiQuery = encodeURIComponent(translation.himotokiSave?.headword || headword);
  const saveLabel = SERVICE_LABEL[learningService] ?? "Save";

  return (
    <div className="es-word-translation" onClick={stop} ref={popupRef}>
      <header className="es-popup-head">
        <div className="es-popup-title">
          <span className="es-popup-word">{headword}</span>
          <button className="es-popup-speak" title="Pronounce" onClick={handlePlaySound}>
            <SoundIcon />
          </button>
        </div>
        {reading && <p className="es-popup-reading">{reading}</p>}
        {(translation.pitch || translation.common || translation.jlpt?.length || translation.conjugationNote) && (
          <div className="es-popup-tags">
            {translation.pitch && <span className="es-tag es-tag-pitch">[{translation.pitch}]</span>}
            {translation.common && <span className="es-tag">common</span>}
            {translation.jlpt?.map((level) => (
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

      {translation.example && (
        <div className="es-popup-example">
          <span className="es-ex-label">Example</span>
          <p className="es-ex-jp">
            <ExampleText text={translation.example.jp} keyword={translation.example.keyword} />
          </p>
          {translation.example.en && (
            <p className="es-ex-en">
              <span className="es-ex-lang">EN</span>
              {translation.example.en}
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
