import { FC, PropsWithChildren, useEffect, useRef } from "react";
import cn from "classnames";
import { EnableToggle } from "./EnableToggle";
import { TranslateLanguage } from "./TranslateLanguage";
import { TranslationService } from "./TranslationService";
import { DeepLApiKeyModal } from "./DeepLApiKeyModal";
import { LearningService } from "./LearningService";
import { SubsDelay } from "./SubsDelay";
import { SubsFontSize } from "./SubsFontSize";
import { SubsBackground } from "./SubsBackground";
import { SubsBackgroundOpacity } from "./SubsBackgroundOpacity";
import { CustomSubs } from "./CustomSubs";
import { EnableProgressBar } from "./EnableProgressBar";
import { MoveBySubs } from "./MoveBySubs";
import { MouseActionSelect } from "./MouseActionSelect";
import { AutoPauseBySubs } from "./AutoPauseBySubs";
import { EnableAutoStop } from "./EnableAutoStop";
import { ClickActionSelect, HoverActionSelect, OpenOptionsPage } from "./TokenActionSelect";
import { OpenTranscript } from "./OpenTranscript";
import { UiScale } from "./UiScale";
import { PlaybackSpeed } from "./PlaybackSpeed";
import { NewWordsLevelSelect } from "./NewWordsLevelSelect";
import { ListeningModeToggle } from "./ListeningModeToggle";
import { SecondarySubsSelect } from "./SecondarySubsSelect";
import { FuriganaSelect, FuriganaLevelSelect, ReadingLineSelect } from "./FuriganaSelect";
import { DimKnownToggle } from "./DimKnownToggle";
import { DifficultyColorToggle } from "./DifficultyColorToggle";
import { AnkiRichCardsToggle, AnkiCardThemeSelect } from "./AnkiRichCardsToggle";
import { MeaningSize } from "./MeaningSize";
import { PitchDisplaySelect } from "./PitchDisplaySelect";
import { VideoStats } from "./VideoStats";
import { LookupHistory } from "./LookupHistory";
import { useClickOutside } from "@src/hooks/useClickOutside";
import { useOverlayPortalTarget } from "@src/hooks/useOverlayPortalTarget";
import { useUnit } from "effector-react";
import {
  $activeSettingsTab,
  $uiScale,
  activeSettingsTabChanged,
} from "@src/models/settings";
import { createPortal } from "react-dom";

interface TabProps {
  isActive: boolean;
  onClick: () => void;
}

const Tab: FC<PropsWithChildren<TabProps>> = ({
  children,
  isActive,
  onClick,
}) => {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      className={cn("es-settings-content__menu__item", {
        "es-settings-content__menu__item--active": isActive,
      })}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export const SettingsContent: FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeSettingsTab, handleActiveSettingsTabChanged, uiScale] = useUnit([
    $activeSettingsTab,
    activeSettingsTabChanged,
    $uiScale,
  ]);
  const contentRef = useRef();
  const modalTarget = useOverlayPortalTarget();

  useClickOutside(contentRef, onClose);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Three tabs: General (app/playback), Words (word behaviour), Subtitles (appearance).
  const tab = activeSettingsTab === 1 || activeSettingsTab === 2 ? activeSettingsTab : 0;

  return (
    <>
      <div className="es-settings-content" ref={contentRef} role="dialog" aria-label="Himotoki settings" style={{ zoom: uiScale / 100 } as React.CSSProperties}>
        <div className="es-settings-content__menu">
          <div className="es-settings-content__menu__items" aria-label="Settings categories">
            <Tab isActive={tab === 0} onClick={() => handleActiveSettingsTabChanged(0)}>
              General
            </Tab>
            <Tab isActive={tab === 1} onClick={() => handleActiveSettingsTabChanged(1)}>
              Words
            </Tab>
            <Tab isActive={tab === 2} onClick={() => handleActiveSettingsTabChanged(2)}>
              Subtitles
            </Tab>
          </div>
        </div>
        <div className="es-settings-content__main">
          {tab === 0 && (
            <>
              <div className="es-settings-content__item">
                <EnableToggle />
              </div>
              <div className="es-settings-content__item">
                <EnableAutoStop />
              </div>
              <div className="es-settings-content__item">
                <AutoPauseBySubs />
              </div>
              <div className="es-settings-content__item">
                <EnableProgressBar />
              </div>
              <div className="es-settings-content__item">
                <MoveBySubs />
              </div>
              <div className="es-settings-content__item">
                <MouseActionSelect button="middle" />
              </div>
              <div className="es-settings-content__item">
                <MouseActionSelect button="back" />
              </div>
              <div className="es-settings-content__item">
                <MouseActionSelect button="forward" />
              </div>
              <div className="es-settings-content__item">
                <TranslateLanguage />
              </div>
              <div className="es-settings-content__item">
                <TranslationService />
              </div>
              <div className="es-settings-content__item">
                <LearningService />
              </div>
              <div className="es-settings-content__item">
                <VideoStats />
              </div>
              <div className="es-settings-content__item">
                <LookupHistory />
              </div>
              <div className="es-settings-content__item">
                <OpenTranscript onOpen={onClose} />
              </div>
              <div className="es-settings-content__item">
                <OpenOptionsPage />
              </div>
            </>
          )}
          {tab === 1 && (
            <>
              <div className="es-settings-content__item">
                <HoverActionSelect />
              </div>
              <div className="es-settings-content__item">
                <ClickActionSelect />
              </div>
              <div className="es-settings-content__item">
                <MeaningSize />
              </div>
              <div className="es-settings-content__item">
                <PitchDisplaySelect />
              </div>
              <div className="es-settings-content__item">
                <FuriganaSelect />
              </div>
              <div className="es-settings-content__item">
                <FuriganaLevelSelect />
              </div>
              <div className="es-settings-content__item">
                <ReadingLineSelect />
              </div>
              <div className="es-settings-content__item">
                <SecondarySubsSelect />
              </div>
              <div className="es-settings-content__item">
                <DimKnownToggle />
              </div>
              <div className="es-settings-content__item">
                <DifficultyColorToggle />
              </div>
              <div className="es-settings-content__item">
                <AnkiRichCardsToggle />
              </div>
              <div className="es-settings-content__item">
                <AnkiCardThemeSelect />
              </div>
            </>
          )}
          {tab === 2 && (
            <>
              <div className="es-settings-content__item">
                <SubsFontSize />
              </div>
              <div className="es-settings-content__item">
                <UiScale />
              </div>
              <div className="es-settings-content__item">
                <SubsBackground />
              </div>
              <div className="es-settings-content__item">
                <SubsBackgroundOpacity />
              </div>
              <div className="es-settings-content__item">
                <PlaybackSpeed />
              </div>
              <div className="es-settings-content__item">
                <ListeningModeToggle />
              </div>
              <div className="es-settings-content__item">
                <NewWordsLevelSelect />
              </div>
              <div className="es-settings-content__item">
                <SubsDelay />
              </div>
              <div className="es-settings-content__item">
                <CustomSubs />
              </div>
            </>
          )}
        </div>
        <button type="button" className="es-settings-content__close" aria-label="Close settings" onClick={onClose} />
      </div>
      {createPortal(<DeepLApiKeyModal />, modalTarget)}
    </>
  );
};
