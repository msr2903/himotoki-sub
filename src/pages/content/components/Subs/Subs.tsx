import { FC, useEffect, useRef, useState } from "react";
import { useUnit } from "effector-react";
import Draggable from "react-draggable";

import { $currentSecondarySubs, $currentSubs, $sentenceOpen } from "@src/models/subs";
import { $video, $wasPaused, wasPausedChanged } from "@src/models/videos";
import { TFuriganaMode, TSub, TSubItem, TTokenAction } from "@src/models/types";
import {
  $autoStopEnabled,
  $clickAction,
  $hoverAction,
  $moveBySubsEnabled,
  $subsBackground,
  $subsBackgroundOpacity,
  $secondarySubs,
  $subsFontSize,
  $uiScale,
  $furigana,
  $readingLine,
  $dimKnownWords,
  $knownWords,
} from "@src/models/settings";
import {
  $activeHoverWord,
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
import { TokenRuby } from "./TokenRuby";
import { hasKanji } from "@src/utils/furigana";
import { useLookup } from "@src/pages/content/hooks/useLookup";
import { knownKeyOf } from "@src/shared/knownWords";

type TSubsProps = {};

const subsBackgroundAlpha = (enabled: boolean, opacity: number) => (enabled ? opacity / 100 : 0);

export const Subs: FC<TSubsProps> = () => {
  const [
    video,
    currentSubs,
    subsFontSize,
    moveBySubsEnabled,
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
  ] = useUnit([
    $video,
    $currentSubs,
    $subsFontSize,
    $moveBySubsEnabled,
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
  ]);
  const [subsBackground, subsBackgroundOpacity] = useUnit([$subsBackground, $subsBackgroundOpacity]);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (moveBySubsEnabled) {
      addKeyboardEventsListeners();
    }
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
  }, [pinnedWord]);

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

  return (
    <Draggable>
      <div
        id="es-subs"
        ref={rootRef}
        onMouseLeave={handleOnMouseLeave}
        onMouseEnter={handleOnMouseEnter}
        style={{ fontSize: `${fontSizePx}px`, "--es-ui-scale": String(uiScale / 100) } as React.CSSProperties}
      >
        {currentSubs.map((sub) => (
          <Sub key={sub.id} sub={sub} secondary={secondaryMode === "translate"} furigana={furigana} readingLine={readingLine} />
        ))}
        {secondaryMode === "track" && currentSubs.length > 0 && currentSecondary.length > 0 && (
          <div className="es-sub es-sub--secondary" style={{ background: `rgba(0, 0, 0, ${subsBackgroundAlpha(subsBackground, subsBackgroundOpacity)})` }}>
            <div className="es-sub-secondary">{currentSecondary.map((cue) => cue.text).join(" ")}</div>
          </div>
        )}
        {sentenceOpen && <SentenceBreakdown />}
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

  // Clicking the line (outside a word) shows a whole-line machine translation.
  const handleOnClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setShowTranslation(true);
  };

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
          />
        );
      })}
      {readingLine === "text" && sub.readingLine && <div className="es-sub-reading-line">{sub.readingLine}</div>}
      {secondary && <SecondaryTranslation text={sub.cleanedText} />}
      {showTranslation && !secondary && <SubFullTranslation text={sub.cleanedText} />}
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
};

const SubItem: FC<TSubItemProps> = ({ subItem, hoverKey, contextSentence, furigana, cueStart, cueEnd }) => {
  const [activeHoverWord, pinnedWord, hoverAction, clickAction, handleSubItemMouseEntered, handleSubItemMouseLeft, pinToggle, dimKnownWords, knownWords] =
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
  // Dim words already marked known (opt-in; resolves the token so this only looks up when enabled).
  const { translation: knownTx } = useLookup(subItem, isWord && dimKnownWords);
  const knownKey = knownTx ? knownKeyOf(knownTx) : null;
  const isKnown = Boolean(dimKnownWords && knownKey && knownWords.includes(knownKey));

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
      className={`es-sub-item ${subItem.tag} ${action !== "none" ? "es-sub-item-active" : ""} ${pinned ? "es-sub-item-pinned" : ""} ${isKnown ? "es-sub-item--known" : ""}`}
      onClick={handleClick}
    >
      {showRuby ? <TokenRuby subItem={subItem} /> : subItem.text}
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
        <TokenLabel subItem={subItem} mode={action} showReading={!showRuby} />
      )}
    </pre>
  );
};
