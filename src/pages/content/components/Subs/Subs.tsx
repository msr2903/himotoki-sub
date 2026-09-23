import { FC, useEffect, useRef, useState } from "react";
import { useUnit } from "effector-react";
import Draggable from "react-draggable";
import toast from "react-hot-toast";

import { $currentSecondarySubs, $currentSubs, $sentenceOpen, $transcriptOpen } from "@src/models/subs";
import { $video, $wasPaused, wasPausedChanged } from "@src/models/videos";
import { TFuriganaMode, TSub, TSubItem, TTokenAction } from "@src/models/types";
import {
  $autoStopEnabled,
  $clickAction,
  $hoverAction,
  $subsBackground,
  $subsBackgroundOpacity,
  $secondarySubs,
  $subsFontSize,
  $uiScale,
  $furigana,
  $readingLine,
  $listeningMode,
  $listeningPeek,
  $dimKnownWords,
  $knownWords,
  $wordStatuses,
  $colorByDifficulty,
  $meaningSize,
  $learningService,
} from "@src/models/settings";
import {
  $activeHoverWord,
  $dictReady,
  $pinnedWord,
  subItemMouseEntered,
  subItemMouseLeft,
  tokenPinToggled,
  tokenUnpinned,
} from "@src/models/translations";
import { addKeyboardEventsListeners, removeKeyboardEventsListeners } from "@src/utils/keyboardHandler";
import { SubItemTranslation } from "./SubItemTranslation";
import { SecondaryTranslation, SubFullTranslation } from "./SubFullTranslation";
import { TokenLabel } from "./TokenLabel";
import { SentenceBreakdown } from "./SentenceBreakdown";
import { Transcript } from "./Transcript";
import { TokenRuby } from "./TokenRuby";
import { hasKanji } from "@src/utils/furigana";
import { useLookup } from "@src/pages/content/hooks/useLookup";
import { knownKeyOf } from "@src/shared/knownWords";
import { jlptColorClass } from "@src/shared/tokenColor";
import { statusOf } from "@src/shared/wordStatus";
import { PhraseRange, clampRange, isIndexSelected, joinItems, rangeLength } from "@src/shared/phraseSelection";
import { getLearningService } from "@src/utils/getLearningService";
import { useLineTranslation } from "@src/pages/content/hooks/useLineTranslation";
import { useRubySegments } from "@src/pages/content/hooks/useRubySegments";
import { parseAnkiTags } from "@src/shared/ankiSettings";
import {
  $ankiCardTheme,
  $ankiDeck,
  $ankiRichCards,
  $ankiTags,
} from "@src/models/settings";

type TSubsProps = {};

const subsBackgroundAlpha = (enabled: boolean, opacity: number) => (enabled ? opacity / 100 : 0);

export const Subs: FC<TSubsProps> = () => {
  const [
    video,
    currentSubs,
    subsFontSize,
    wasPaused,
    handleWasPausedChanged,
    autoStopEnabled,
    pinnedWord,
    unpin,
    uiScale,
    secondaryMode,
    currentSecondary,
    furigana,
    readingLine,
    sentenceOpen,
    transcriptOpen,
    dictReady,
  ] = useUnit([
    $video,
    $currentSubs,
    $subsFontSize,
    $wasPaused,
    wasPausedChanged,
    $autoStopEnabled,
    $pinnedWord,
    tokenUnpinned,
    $uiScale,
    $secondarySubs,
    $currentSecondarySubs,
    $furigana,
    $readingLine,
    $sentenceOpen,
    $transcriptOpen,
    $dictReady,
  ]);
  // Without the offline dictionary, "always" would look up every kanji token over the HTTP API;
  // fall back to "hover" (one lookup at a time) until it is installed.
  const effectiveFurigana: TFuriganaMode = furigana === "always" && !dictReady ? "hover" : furigana;
  const [subsBackground, subsBackgroundOpacity, meaningSize, listeningMode, listeningPeek] = useUnit([$subsBackground, $subsBackgroundOpacity, $meaningSize, $listeningMode, $listeningPeek]);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Attach the keyboard shortcuts unconditionally: D/B/T/R/L/H/,/./\ must work regardless of the
  // "move by subtitles" setting, which now only gates the arrow keys (inside keyboardHandler itself).
  useEffect(() => {
    addKeyboardEventsListeners();
    return () => {
      removeKeyboardEventsListeners();
    };
  }, []);

  // A pinned click result is dismissed by Escape or by clicking anywhere outside the subtitles.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") unpin();
    };
    const onClick = (event: MouseEvent) => {
      const root = rootRef.current;
      if (!root) return;
      // Composed path handles Draggable/portal edge cases better than contains().
      const path = (event.composedPath && event.composedPath()) || [];
      const inside = path.includes(root) || root.contains(event.target as Node) || (event.target as HTMLElement)?.closest?.("#es-subs") != null;
      if (!inside) unpin();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [unpin]);

  // While something is pinned the video stays paused even if the pointer leaves; resume on unpin.
  useEffect(() => {
    if (pinnedWord || !wasPaused || !video) return;
    if (rootRef.current?.matches(":hover")) return;
    video.play();
    handleWasPausedChanged(false);
  }, [pinnedWord, wasPaused, video, handleWasPausedChanged]);

  const handleOnMouseLeave = () => {
    if (pinnedWord) return;
    if (wasPaused && video) {
      video.play();
      handleWasPausedChanged(false);
    }
  };

  const handleOnMouseEnter = () => {
    if (!autoStopEnabled || !video) {
      return;
    }
    if (!video.paused) {
      handleWasPausedChanged(true);
      video.pause();
    }
  };

  const fontSizePx = video ? ((video.clientWidth / 100) * subsFontSize) / 43 : subsFontSize * 0.5;

  // Clicks after a real drag must not pin a word or fire a line translation; the cancel list keeps
  // text selection and scrollbar drags inside the pop-ups/panels from moving the overlay.
  const dragDistance = useRef(0);
  const swallowClickAfterDrag = () => {
    const swallow = (event: Event) => {
      event.stopPropagation();
      event.preventDefault();
    };
    document.addEventListener("click", swallow, { capture: true, once: true });
    window.setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 0);
  };

  return (
    <Draggable
      cancel=".es-word-translation, .es-transcript, .es-breakdown, .es-phrase-bar, .es-full-translation, .es-sub-secondary, .es-sub-reading-line, .es-token-label, input, textarea, select, button, a"
      onStart={() => {
        dragDistance.current = 0;
      }}
      onDrag={(_e, data) => {
        dragDistance.current += Math.abs(data.deltaX) + Math.abs(data.deltaY);
      }}
      onStop={() => {
        if (dragDistance.current > 5) swallowClickAfterDrag();
      }}
    >
      <div
        id="es-subs"
        className={`${listeningMode ? "es-subs--listening" : ""} ${listeningPeek ? "es-subs--peek" : ""}`}
        ref={rootRef}
        onMouseLeave={handleOnMouseLeave}
        onMouseEnter={handleOnMouseEnter}
        style={{ fontSize: `${fontSizePx}px`, "--es-ui-scale": String(uiScale / 100), "--es-meaning-scale": String(meaningSize / 100) } as React.CSSProperties}
      >
        {currentSubs.map((sub) => (
          <Sub key={sub.id} sub={sub} secondary={secondaryMode === "translate"} furigana={effectiveFurigana} readingLine={readingLine} />
        ))}
        {secondaryMode === "track" && currentSubs.length > 0 && currentSecondary.length > 0 && (
          <div className="es-sub es-sub--secondary" style={{ background: `rgba(0, 0, 0, ${subsBackgroundAlpha(subsBackground, subsBackgroundOpacity)})` }}>
            <div className="es-sub-secondary">{currentSecondary.map((cue) => cue.text).join(" ")}</div>
          </div>
        )}
        {sentenceOpen && <SentenceBreakdown />}
        {transcriptOpen && <Transcript />}
      </div>
    </Draggable>
  );
};

const Sub: FC<{ sub: TSub; secondary: boolean; furigana: TFuriganaMode; readingLine: "hide" | "text" }> = ({
  sub,
  secondary,
  furigana,
  readingLine,
}) => {
  const [showTranslation, setShowTranslation] = useState(false);
  const [subsBackground, subsBackgroundOpacity] = useUnit([$subsBackground, $subsBackgroundOpacity]);
  // Shift-click a token to anchor a phrase, shift-click another to extend it (within this cue).
  const [selection, setSelection] = useState<{ anchor: number; extent: number } | null>(null);
  const range: PhraseRange | null = selection ? clampRange(selection.anchor, selection.extent, sub.items.length) : null;

  const handleShiftSelect = (index: number) => {
    setSelection((prev) => (prev ? { anchor: prev.anchor, extent: index } : { anchor: index, extent: index }));
  };
  const clearSelection = () => setSelection(null);

  // Clear the phrase selection on Escape (matches the pop-up's dismissal).
  useEffect(() => {
    if (!selection) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearSelection();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [selection]);

  // Clicking the line (outside a word) shows a whole-line machine translation.
  const handleOnClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setShowTranslation(true);
  };

  const phraseText = range ? joinItems(sub.items, range) : "";

  return (
    <div
      className="es-sub"
      onClick={handleOnClick}
      onMouseLeave={() => setShowTranslation(false)}
      style={{
        background: `rgba(0, 0, 0, ${subsBackground ? subsBackgroundOpacity / 100 : 0})`,
      }}
    >
      {sub.items.map((item, index) => {
        const key = `${sub.id}:${index}`;
        if (item.type === "newline") return <br key={key} />;
        if (item.type === "space") return <span key={key} className="es-sub-item-space"> </span>;
        return (
          <SubItem
            key={`${key}:${item.text}`}
            hoverKey={key}
            subItem={item}
            contextSentence={sub.cleanedText}
            furigana={furigana}
            cueStart={sub.start}
            cueEnd={sub.end}
            itemIndex={index}
            selected={isIndexSelected(range, index)}
            onShiftSelect={handleShiftSelect}
          />
        );
      })}
      {readingLine === "text" && sub.readingLine && <div className="es-sub-reading-line">{sub.readingLine}</div>}
      {secondary && <SecondaryTranslation text={sub.cleanedText} />}
      {showTranslation && !secondary && <SubFullTranslation text={sub.cleanedText} />}
      {range && rangeLength(range) >= 2 && phraseText && (
        <PhraseBar phrase={phraseText} contextSentence={sub.cleanedText} onClose={clearSelection} />
      )}
    </div>
  );
};

/** Action bar for a selected multi-token phrase: translate it or save it, then clear. */
const PhraseBar: FC<{ phrase: string; contextSentence?: string; onClose: () => void }> = ({ phrase, contextSentence, onClose }) => {
  const [learningService, ankiDeck, ankiTags, ankiCardTheme, ankiRichCards] = useUnit([
    $learningService,
    $ankiDeck,
    $ankiTags,
    $ankiCardTheme,
    $ankiRichCards,
  ]);
  const [showTranslation, setShowTranslation] = useState(false);
  const [saveAfterTranslate, setSaveAfterTranslate] = useState(false);
  const { translation, pending } = useLineTranslation(showTranslation ? phrase : "");

  const doSave = (meaning: string) => {
    const service = getLearningService(learningService);
    if (!service) return;
    service
      .addWord(phrase, meaning, {
        contextSentence: contextSentence || phrase,
        context: contextSentence || phrase,
        richCards: ankiRichCards,
        cardTheme: ankiCardTheme,
        deckName: ankiDeck,
        tags: parseAnkiTags(ankiTags),
      })
      .then((value) => toast.success(value))
      .catch((error) => toast.error(typeof error === "string" ? error : error?.message || String(error)));
  };

  const handleSave = () => {
    // Himotoki favorites need a dictionary entry (seq); a multi-word phrase has none, so saving
    // there would always fail — say so instead of pretending the save went through.
    if (learningService === "himotoki") {
      toast.error("Phrase saving works with Anki — Himotoki favorites are for single dictionary words.");
      return;
    }
    if (translation) {
      doSave(translation);
      return;
    }
    // Fetch the machine translation first so the card's meaning isn't the Japanese phrase itself.
    setShowTranslation(true);
    setSaveAfterTranslate(true);
  };

  useEffect(() => {
    if (!saveAfterTranslate || pending) return;
    if (translation) {
      setSaveAfterTranslate(false);
      doSave(translation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveAfterTranslate, translation, pending]);

  return (
    <div className="es-phrase-bar" onClick={(e) => e.stopPropagation()}>
      <div className="es-phrase-bar__text">{phrase}</div>
      <div className="es-phrase-bar__actions">
        <button type="button" className="es-phrase-bar__btn" onClick={() => setShowTranslation(true)}>
          Translate
        </button>
        <button type="button" className="es-phrase-bar__btn" onClick={handleSave}>
          Save phrase
        </button>
        <button type="button" className="es-phrase-bar__btn es-phrase-bar__btn--ghost" title="Clear selection" onClick={onClose}>
          ×
        </button>
      </div>
      {showTranslation && (
        <div className="es-phrase-bar__translation">{pending ? "Translating…" : translation || "Translation failed"}</div>
      )}
    </div>
  );
};

type TSubItemProps = {
  subItem: TSubItem;
  /** Position-based identity (cue id + index) so two identical tokens in one cue do not both open. */
  hoverKey: string;
  contextSentence?: string;
  furigana: TFuriganaMode;
  cueStart?: number;
  cueEnd?: number;
  /** Index of this item in the cue, for shift-click phrase selection. */
  itemIndex: number;
  selected: boolean;
  onShiftSelect: (index: number) => void;
};

const SubItem: FC<TSubItemProps> = ({ subItem, hoverKey, contextSentence, furigana, cueStart, cueEnd, itemIndex, selected, onShiftSelect }) => {
  const [activeHoverWord, pinnedWord, hoverAction, clickAction, handleSubItemMouseEntered, handleSubItemMouseLeft, pinToggle, dimKnownWords, knownWords, wordStatuses, colorByDifficulty] =
    useUnit([
      $activeHoverWord,
      $pinnedWord,
      $hoverAction,
      $clickAction,
      subItemMouseEntered,
      subItemMouseLeft,
      tokenPinToggled,
      $dimKnownWords,
      $knownWords,
      $wordStatuses,
      $colorByDifficulty,
    ]);
  const leaveTimer = useRef<number | null>(null);
  const itemRef = useRef<HTMLPreElement | null>(null);
  const isWord = subItem.type === "word";
  const hovered = isWord && activeHoverWord === hoverKey;
  const pinned = isWord && pinnedWord === hoverKey;
  // The pinned click action wins over the transient hover action.
  const action: TTokenAction = pinned ? clickAction : hovered ? hoverAction : "none";
  // Inline ruby over kanji tokens: always, or only while hovered.
  const showRuby = isWord && hasKanji(subItem.text) && (furigana === "always" || (furigana === "hover" && hovered));
  // showRuby is only the intent — ruby can still fall back to plain text (difficulty gate, pending
  // lookup, no reading). The label must show the reading in exactly those cases, not just when
  // ruby is disabled.
  const rubySegments = useRubySegments(subItem, showRuby);
  const rubyVisible = rubySegments !== null;
  // Dimming, status colouring and difficulty colouring all resolve the token, so look up only when
  // one of them needs it. Statuses are only worth resolving once the user has marked some words.
  const hasStatuses = Object.keys(wordStatuses).length > 0;
  const { translation: tokenTx } = useLookup(subItem, isWord && (dimKnownWords || colorByDifficulty || hasStatuses));
  const knownKey = tokenTx && !tokenTx.error ? knownKeyOf(tokenTx) : null;
  const status = statusOf(wordStatuses, knownKey, knownWords);
  const isKnown = dimKnownWords && status === "known";
  const isLearning = status === "learning";
  const isIgnored = status === "ignored";
  // Ignored words never carry difficulty colour (the user has opted them out of attention).
  const jlptClass = isWord && colorByDifficulty && tokenTx && !tokenTx.error && !isIgnored ? jlptColorClass(tokenTx.jlpt) : "";

  useEffect(() => {
    // After ONNX upgrade remount, restore hover state if the pointer is still over this token.
    const el = itemRef.current;
    if (!el || !isWord) return;
    if (el.matches(":hover")) {
      handleSubItemMouseEntered(hoverKey);
    }
  }, [hoverKey, isWord, handleSubItemMouseEntered]);

  const clearLeaveTimer = () => {
    if (leaveTimer.current != null) {
      window.clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  };

  // Clear a pending leave timer if the token unmounts mid-hover (e.g. ONNX re-segmentation remount),
  // so it doesn't fire subItemMouseLeft against a gone component.
  useEffect(() => clearLeaveTimer, []);

  const handleOnMouseLeave = () => {
    clearLeaveTimer();
    // Delay so remount mid-hover does not wipe the active word before the new node mounts.
    leaveTimer.current = window.setTimeout(() => {
      handleSubItemMouseLeft(hoverKey);
      leaveTimer.current = null;
    }, 80);
  };

  const handleOnMouseEnter = () => {
    if (!isWord) return;
    clearLeaveTimer();
    handleSubItemMouseEntered(hoverKey);
  };

  const handleClick = (event: React.MouseEvent) => {
    // Clicks inside the pop-up (buttons, switcher, conjugation toggle) must never toggle the pin.
    if ((event.target as HTMLElement).closest(".es-word-translation")) return;
    // Shift-click builds a multi-token phrase selection instead of pinning/looking up.
    if (isWord && event.shiftKey) {
      event.stopPropagation();
      event.preventDefault();
      clearLeaveTimer();
      onShiftSelect(itemIndex);
      return;
    }
    // With click set to "No action" the click falls through to the line (whole-line translation).
    if (!isWord || clickAction === "none") return;
    event.stopPropagation();
    clearLeaveTimer();
    pinToggle(hoverKey);
  };

  return (
    <pre
      ref={itemRef}
      onMouseEnter={handleOnMouseEnter}
      onMouseLeave={handleOnMouseLeave}
      className={`es-sub-item ${subItem.tag} ${action !== "none" ? "es-sub-item-active" : ""} ${pinned ? "es-sub-item-pinned" : ""} ${isKnown ? "es-sub-item--known" : ""} ${isLearning ? "es-sub-item--learning" : ""} ${isIgnored ? "es-sub-item--ignored" : ""} ${selected ? "es-sub-item--selected" : ""} ${jlptClass}`}
      onClick={handleClick}
    >
      {rubyVisible ? <TokenRuby subItem={subItem} /> : subItem.text}
      {action === "popup" && (
        <SubItemTranslation
          subItem={subItem}
          contextSentence={contextSentence}
          cueStart={cueStart}
          cueEnd={cueEnd}
          pinned={pinned}
        />
      )}
      {(action === "furigana" || action === "meaning" || action === "both") && (
        <TokenLabel subItem={subItem} mode={action} showReading={!rubyVisible} offsetForRuby={rubyVisible} />
      )}
    </pre>
  );
};
