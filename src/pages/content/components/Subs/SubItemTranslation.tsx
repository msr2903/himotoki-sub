import { FC, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useUnit } from "effector-react";
import toast from "react-hot-toast";

import {
  $ankiCardTheme,
  $ankiDeck,
  $ankiRichCards,
  $ankiSavedWords,
  $ankiTags,
  $knownWords,
  $learningService,
  $pitchDisplay,
  $wordStatuses,
  ankiWordSaved,
  wordStatusSet,
} from "@src/models/settings";
import { parseAnkiTags } from "@src/shared/ankiSettings";
import { captureCueAudio, captureVideoFrame } from "@src/utils/mediaCapture";
import { tokenUnpinned } from "@src/models/translations";
import { knownKeyOf } from "@src/shared/knownWords";
import { WORD_STATUS_LABELS, WORD_STATUS_ORDER, statusOf } from "@src/shared/wordStatus";
import { $video, replayCueRequested } from "@src/models/videos";
import { useLookup } from "@src/pages/content/hooks/useLookup";
import { TLearningService, TSubItem, TWordTranslation, TWordTranslationItem } from "@src/models/types";
import ILearningService from "@src/learning-service/learningService";
import { getLearningService } from "@src/utils/getLearningService";
import { SoundIcon } from "./assets/SoundIcon";
import { SaveIcon } from "./assets/SaveIcon";
import { AnkiIcon } from "./assets/AnkiIcon";
import { ConjugationTable } from "./ConjugationTable";
import { FrequencyBadge, PitchAccent } from "./PitchAccent";

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
  const [
    learningService,
    pitchDisplay,
    video,
    unpin,
    knownWords,
    wordStatuses,
    setWordStatus,
    ankiRichCards,
    ankiCardTheme,
    ankiDeck,
    ankiTags,
    ankiSavedWords,
    markAnkiSaved,
  ] = useUnit([
    $learningService,
    $pitchDisplay,
    $video,
    tokenUnpinned,
    $knownWords,
    $wordStatuses,
    wordStatusSet,
    $ankiRichCards,
    $ankiCardTheme,
    $ankiDeck,
    $ankiTags,
    $ankiSavedWords,
    ankiWordSaved,
  ]);

  const [service, setService] = useState<ILearningService>(null);
  const [showAll, setShowAll] = useState(false);
  const [entryIndex, setEntryIndex] = useState(0);
  const [showConj, setShowConj] = useState(false);
  const popupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setService(getLearningService(learningService));
  }, [learningService]);

  // Reset entry paging and "show more" when the token changes.
  useEffect(() => {
    setEntryIndex(0);
    setShowAll(false);
    setShowConj(false);
  }, [text]);

  useEffect(() => {
    setShowAll(false);
    setShowConj(false);
  }, [entryIndex]);

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

  // Save to a specific service (defaults to the selected one, used by the per-sense "+").
  const handleAddWord = async (sense: TWordTranslationItem, target: TLearningService = learningService) => {
    const svc = getLearningService(target);
    if (!svc) return;
    // Rich Anki cards: capture a video-frame screenshot (instant) and the cue's audio (best-effort;
    // seeks/plays the video briefly, then restores it). Both degrade to null when not capturable.
    const useRich = target === "anki" && ankiRichCards;
    let image = null;
    let audio = null;
    if (useRich && video) {
      const base = `himotoki-${Date.now()}`;
      image = captureVideoFrame(video, base);
      if (hasClip) audio = await captureCueAudio(video, cueStart! / 1000, cueEnd! / 1000, base);
    }
    svc
      .addWord(current.source, sense.word, {
        partOfSpeech: sense.partOfSpeech,
        context: miningContext.contextSentence,
        ...miningContext,
        reading: current.reading,
        jlpt: current.jlpt,
        meanings: current.translations?.length ? current.translations.map((s) => s.word) : [sense.word],
        richCards: ankiRichCards,
        cardTheme: ankiCardTheme,
        deckName: ankiDeck,
        tags: parseAnkiTags(ankiTags),
        image,
        audio,
        himotokiSave: current.himotokiSave
          ? { ...current.himotokiSave, gloss: sense.word || current.himotokiSave.gloss }
          : undefined,
      })
      .then((value) => {
        const key = knownKeyOf(current);
        if (key) {
          // Saving to Himotoki bookmarks the word (marks it known); saving to Anki only records
          // that it was mined, so the Anki icon shows a check without touching known-word status.
          if (target === "anki") markAnkiSaved(key);
          else setWordStatus({ key, status: "known" });
        }
        toast.success(value);
      })
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
    replayCueRequested({ start: cueStart!, end: cueEnd! });
  };

  const headword = current.headword || current.source || text;
  const reading = current.reading && current.reading !== headword ? current.reading : null;
  const senses = current.translations.length
    ? current.translations
    : [{ word: current.mainTranslation, partOfSpeech: "unknown" as const, synonyms: [], popularity: 0 }];
  const visibleSenses = showAll ? senses : senses.slice(0, SENSE_LIMIT);
  const hiddenCount = senses.length - visibleSenses.length;
  const saveLabel = SERVICE_LABEL[learningService] ?? "Save";
  const knownKey = knownKeyOf(current);
  const wordStatus = statusOf(wordStatuses, knownKey, knownWords);
  const ankiSaved = knownKey ? ankiSavedWords.includes(knownKey) : false;
  const chain = translation.conjugation;
  const conjugable = senses.some(
    (sense) => sense.partOfSpeech === "verb" || sense.partOfSpeech === "adjective",
  );
  const conjSeq = (entryIndex === 0 ? chain?.rootSeq : null) ?? (typeof current.himotokiSave?.seq === "number" ? current.himotokiSave.seq : null);

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
          <span className="es-popup-tools">
            {hasClip && (
              <button className="es-popup-speak" title="Replay this line from the video" onClick={handlePlayClip}>
                ▶
              </button>
            )}
            <button className="es-popup-speak" title="Pronounce (synthesized)" onClick={handlePlaySound}>
              <SoundIcon />
            </button>
            <button
              className={`es-popup-save es-popup-save--himotoki ${wordStatus === "known" ? "es-popup-save--saved" : ""}`}
              title={wordStatus === "known" ? "Save to Himotoki (saved)" : "Save to Himotoki"}
              aria-label="Save to Himotoki"
              onClick={() => handleAddWord(senses[0]!, "himotoki")}
            >
              <SaveIcon filled={wordStatus === "known"} />
            </button>
            <button
              className={`es-popup-save es-popup-save--anki ${ankiSaved ? "es-popup-save--saved" : ""}`}
              title={ankiSaved ? "Save to Anki (saved)" : "Save to Anki"}
              aria-label="Save to Anki"
              onClick={() => handleAddWord(senses[0]!, "anki")}
            >
              <AnkiIcon saved={ankiSaved} />
            </button>
          </span>
        </div>
        {reading && <p className="es-popup-reading">{reading}</p>}
        {((current.pitch && pitchDisplay !== "hidden") ||
          current.common ||
          current.jlpt?.length ||
          current.frequency ||
          translation.conjugationNote) && (
          <div className="es-popup-tags">
            {current.pitch && pitchDisplay !== "hidden" && <PitchAccent pitch={current.pitch} reading={current.reading} display={pitchDisplay} />}
            {current.jlpt?.map((level) => (
              <span key={level} className="es-tag">
                {level.toUpperCase()}
              </span>
            ))}
            {current.frequency != null && <FrequencyBadge rank={current.frequency} />}
            {current.common && <span className="es-tag">common</span>}
            {translation.conjugationNote && <span className="es-popup-conj">{translation.conjugationNote}</span>}
          </div>
        )}
        {chain && chain.steps.length > 0 && (
          <div className="es-conj-chain">
            <span className="es-conj-root">{chain.rootText}</span>
            {chain.steps.map((step, i) => (
              <span key={i} className="es-conj-step" title={step.tip || undefined}>
                <span className="es-conj-arrow">→</span>
                {step.label}
              </span>
            ))}
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

      {conjugable && conjSeq != null && (
        <div className="es-conj">
          <button className="es-word-more" onClick={() => setShowConj((v) => !v)}>
            {showConj ? "Hide conjugations" : "Conjugations"}
          </button>
          {showConj && <ConjugationTable seq={conjSeq} />}
        </div>
      )}

      {knownKey && (
        <div className="es-popup-status-row" role="group" aria-label="Word status">
          {WORD_STATUS_ORDER.map((status) => (
            <button
              key={status}
              type="button"
              className={`es-status-btn es-status-btn--${status} ${wordStatus === status ? "es-status-btn--active" : ""}`}
              aria-pressed={wordStatus === status}
              onClick={() => setWordStatus({ key: knownKey, status })}
            >
              {WORD_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      )}

      {pinned && (
        <footer className="es-popup-actions">
          <button className="es-popup-btn es-popup-btn--ghost" onClick={() => unpin()}>
            Close
          </button>
        </footer>
      )}
      {translation.lookupSource === "none" && (
        <div className="es-word-hint">Install the offline dictionary in the extension settings to look up words.</div>
      )}
    </div>
  );
};
