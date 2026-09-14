import { FC, Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { PlusIcon } from "./assets/PlusIcon";

export const SubItemTranslation: FC<{
  subItem: TSubItem;
  contextSentence?: string;
  /** Opened by click: stays until dismissed, shows a close button. */
  pinned?: boolean;
}> = ({ subItem, contextSentence, pinned }) => {
  const text = subItem.cleanedText || subItem.text;
  const { translation: currentWordTranslation, pending } = useLookup(subItem);
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
      <div className="es-word-translation es-word-translation--loading" onClick={stop}>
        Looking up…
      </div>
    );
  }

  if (!currentWordTranslation) {
    return (
      <div className="es-word-translation es-word-translation--loading" onClick={stop}>
        No translation
      </div>
    );
  }

  if (currentWordTranslation.error) {
    return (
      <div className="es-word-translation" onClick={stop}>
        <div className="es-word-original-info">
          <div className="es-word-original">{text}</div>
        </div>
        <div className="es-word-transcription">Lookup failed: {currentWordTranslation.error}</div>
      </div>
    );
  }

  if (!currentWordTranslation.mainTranslation && currentWordTranslation.translations.length === 0) {
    return (
      <div className="es-word-translation" onClick={stop}>
        <div className="es-word-original-info">
          <div className="es-word-original">{text}</div>
        </div>
        <div className="es-word-transcription">No dictionary entry</div>
      </div>
    );
  }

  const miningContext = {
    contextSentence: contextSentence || "",
    sourceUrl: typeof location !== "undefined" ? location.href : "",
    videoTitle: typeof document !== "undefined" ? document.title : "",
    timestampMs: video ? Math.floor(video.currentTime * 1000) : undefined,
  };

  const handleAddWord = (word: string, translation: TWordTranslationItem) => {
    if (!service) return;
    service
      .addWord(word, translation.word, {
        partOfSpeech: translation.partOfSpeech,
        context: miningContext.contextSentence,
        ...miningContext,
        himotokiSave: currentWordTranslation.himotokiSave
          ? {
              ...currentWordTranslation.himotokiSave,
              gloss: translation.word || currentWordTranslation.himotokiSave.gloss,
            }
          : undefined,
      })
      .then((value) => {
        toast.success(value);
      })
      .catch((error) => {
        toast.error(typeof error === "string" ? error : error?.message || String(error));
      });
  };

  const handlePlaySound = () => {
    const msg = new SpeechSynthesisUtterance();
    msg.text = currentWordTranslation.source;
    msg.lang = "ja-JP";
    msg.rate = 0.8;
    window.speechSynthesis.speak(msg);
  };

  const himotokiQuery = encodeURIComponent(
    currentWordTranslation.himotokiSave?.headword || currentWordTranslation.source || text,
  );

  const SENSE_LIMIT = 3;
  const senses = currentWordTranslation.translations;
  const visibleSenses = showAll ? senses : senses.slice(0, SENSE_LIMIT);
  const hiddenCount = senses.length - visibleSenses.length;

  return (
    <div className="es-word-translation" onClick={stop} ref={popupRef}>
      {pinned && (
        <button className="es-word-close" title="Close (Esc)" onClick={() => unpin()}>
          ×
        </button>
      )}
      <div className="es-word-main">
        <div
          className="es-translation-variant-word"
          onClick={(e) => {
            e.stopPropagation();
            handleAddWord(currentWordTranslation.source, {
              word: currentWordTranslation.mainTranslation,
              partOfSpeech: "unknown",
              popularity: 0,
              synonyms: [],
            });
          }}
        >
          {service && (
            <button className="es-settings-button">
              <PlusIcon fill={service.color} />
            </button>
          )}
          <div>{currentWordTranslation.mainTranslation}</div>
        </div>
      </div>
      <hr className="es-word-original-hr" />
      <div className="es-word-original-info">
        <div className="es-word-original-sound-icon" onClick={handlePlaySound}>
          <SoundIcon />
        </div>
        <div className="es-word-original">{text}</div>
      </div>
      {currentWordTranslation.transcription && (
        <div className="es-word-transcription">{currentWordTranslation.transcription}</div>
      )}
      <div className="es-translation-variants">
        {visibleSenses.map((translation, index) => (
          <Fragment key={index}>
            <div
              className="es-translation-variant-word"
              onClick={(e) => {
                e.stopPropagation();
                handleAddWord(currentWordTranslation.source, translation);
              }}
            >
              {service && (
                <button className="es-settings-button">
                  <PlusIcon fill={service.color} />
                </button>
              )}
              <div>{translation.word}</div>
            </div>
            <div className="es-translation-variant-part-of-speach">{translation.partOfSpeech}</div>
          </Fragment>
        ))}
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
      </div>
      <hr className="es-translation-services-hr" />
      <div className="es-translation-services">
        <a
          className="es-translation-service es-translation-service-himotoki"
          href={`${HIMOTOKI_API_BASE}/?q=${himotokiQuery}`}
          target="_blank"
          rel="noreferrer"
        >
          Open in Himotoki
        </a>
      </div>
      {currentWordTranslation.lookupSource === "api" && (
        <div className="es-word-hint">Online lookup. Download the offline dictionary in the extension settings for instant results.</div>
      )}
    </div>
  );
};
