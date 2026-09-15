import { FC, useEffect, useState } from "react";

import type { TFuriganaMode, TReadingLineMode, TSecondarySubs, TTokenAction } from "@src/models/types";
import { onPersistedChange, readPersisted, writePersisted } from "@src/shared/persistedSettings";
import {
  CLICK_ACTION_SETTING,
  DEFAULT_CLICK_ACTION,
  DEFAULT_HOVER_ACTION,
  HOVER_ACTION_SETTING,
  TOKEN_ACTIONS,
  isTokenAction,
} from "@src/shared/tokenActions";
import { HIMOTOKI_API_BASE } from "@src/shared/himotokiConfig";
import { DEFAULT_SECONDARY_SUBS, SECONDARY_SUBS_OPTIONS, SECONDARY_SUBS_SETTING, isSecondarySubs } from "@src/shared/secondarySubs";
import {
  DEFAULT_FURIGANA,
  DEFAULT_READING_LINE,
  FURIGANA_OPTIONS,
  FURIGANA_SETTING,
  READING_LINE_OPTIONS,
  READING_LINE_SETTING,
  isFuriganaMode,
  isReadingLineMode,
} from "@src/shared/furiganaSettings";
import { UI_SCALE_DEFAULT, UI_SCALE_MAX, UI_SCALE_MIN, UI_SCALE_SETTING, UI_SCALE_STEP, clampUiScale } from "@src/shared/uiScale";
import { DEFAULT_DIM_KNOWN, DIM_KNOWN_SETTING, KNOWN_WORDS_SETTING } from "@src/shared/knownWords";
import { AccountPanel } from "@src/pages/shared/AccountPanel";
import { DictionaryPanel } from "@src/pages/shared/DictionaryPanel";

/** A persisted setting shared live with the content script (see src/utils/withPersist.ts). */
function usePersistedSetting<T>(name: string, fallback: T, validate: (v: unknown) => v is T) {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    void readPersisted<unknown>(name, fallback).then((v) => setValue(validate(v) ? v : fallback));
    return onPersistedChange<unknown>(name, (v) => {
      if (validate(v)) setValue(v);
    });
  }, [name]);
  const update = (next: T) => {
    setValue(next);
    void writePersisted(name, next);
  };
  return [value, update] as const;
}

const ActionSelect: FC<{ id: string; value: TTokenAction; onChange: (v: TTokenAction) => void }> = ({
  id,
  value,
  onChange,
}) => (
  <select
    id={id}
    className="es-options-select"
    value={value}
    onChange={(e) => {
      const next = e.target.value;
      if (isTokenAction(next)) onChange(next);
    }}
  >
    {TOKEN_ACTIONS.map((a) => (
      <option key={a.value} value={a.value}>
        {a.label}
      </option>
    ))}
  </select>
);

const describe = (value: TTokenAction) => TOKEN_ACTIONS.find((a) => a.value === value)?.description ?? "";

const Options: FC = () => {
  const [hoverAction, setHoverAction] = usePersistedSetting<TTokenAction>(
    HOVER_ACTION_SETTING,
    DEFAULT_HOVER_ACTION,
    isTokenAction,
  );
  const [clickAction, setClickAction] = usePersistedSetting<TTokenAction>(
    CLICK_ACTION_SETTING,
    DEFAULT_CLICK_ACTION,
    isTokenAction,
  );
  const [uiScale, setUiScale] = usePersistedSetting<number>(
    UI_SCALE_SETTING,
    UI_SCALE_DEFAULT,
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  const [secondary, setSecondary] = usePersistedSetting<TSecondarySubs>(
    SECONDARY_SUBS_SETTING,
    DEFAULT_SECONDARY_SUBS,
    isSecondarySubs,
  );
  const [furigana, setFurigana] = usePersistedSetting<TFuriganaMode>(FURIGANA_SETTING, DEFAULT_FURIGANA, isFuriganaMode);
  const [readingLine, setReadingLine] = usePersistedSetting<TReadingLineMode>(
    READING_LINE_SETTING,
    DEFAULT_READING_LINE,
    isReadingLineMode,
  );
  const [dimKnown, setDimKnown] = usePersistedSetting<boolean>(
    DIM_KNOWN_SETTING,
    DEFAULT_DIM_KNOWN,
    (v): v is boolean => typeof v === "boolean",
  );
  const [knownWords, setKnownWords] = usePersistedSetting<string[]>(
    KNOWN_WORDS_SETTING,
    [],
    (v): v is string[] => Array.isArray(v),
  );
  const version = chrome.runtime.getManifest().version;

  return (
    <div className="es-options">
      <header className="es-options-header">
        <span className="header-brand">Himotoki</span>
        <span className="header-sub">Sub · settings · v{version}</span>
      </header>

      <section className="es-options-section">
        <h2>Subtitle words</h2>
        <p className="es-popup-hint">
          What happens when you hover or click a word in the subtitles. Hover results disappear when the pointer
          leaves; click results stay until you press Escape, click elsewhere, or the subtitle changes.
        </p>
        <div className="es-options-row">
          <label htmlFor="hover-action">On hover</label>
          <div>
            <ActionSelect id="hover-action" value={hoverAction} onChange={setHoverAction} />
            <div className="es-options-help">{describe(hoverAction)}</div>
          </div>
        </div>
        <div className="es-options-row">
          <label htmlFor="click-action">On click</label>
          <div>
            <ActionSelect id="click-action" value={clickAction} onChange={setClickAction} />
            <div className="es-options-help">{describe(clickAction)}</div>
          </div>
        </div>
        <div className="es-options-row">
          <label htmlFor="ui-scale">Pop-up size</label>
          <div>
            <div className="es-options-range">
              <input
                id="ui-scale"
                type="range"
                min={UI_SCALE_MIN}
                max={UI_SCALE_MAX}
                step={UI_SCALE_STEP}
                value={uiScale}
                onChange={(e) => setUiScale(clampUiScale(e.target.value))}
              />
              <span>{uiScale}%</span>
            </div>
            <div className="es-options-help">Size of the dictionary pop-up, hover labels and the in-player panel.</div>
          </div>
        </div>
        <div className="es-options-row">
          <label htmlFor="furigana">Furigana</label>
          <div>
            <select
              id="furigana"
              className="es-options-select"
              value={furigana}
              onChange={(e) => isFuriganaMode(e.target.value) && setFurigana(e.target.value)}
            >
              {FURIGANA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="es-options-help">{FURIGANA_OPTIONS.find((o) => o.value === furigana)?.description}</div>
          </div>
        </div>
        <div className="es-options-row">
          <label htmlFor="reading-line">Reading line</label>
          <div>
            <select
              id="reading-line"
              className="es-options-select"
              value={readingLine}
              onChange={(e) => isReadingLineMode(e.target.value) && setReadingLine(e.target.value)}
            >
              {READING_LINE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="es-options-help">{READING_LINE_OPTIONS.find((o) => o.value === readingLine)?.description}</div>
          </div>
        </div>
        <div className="es-options-row">
          <label htmlFor="dim-known">Known words</label>
          <div>
            <label className="es-options-check">
              <input
                id="dim-known"
                type="checkbox"
                checked={dimKnown}
                onChange={(e) => setDimKnown(e.target.checked)}
              />
              Dim words I have marked as known
            </label>
            <div className="es-options-help">
              {knownWords.length} word{knownWords.length === 1 ? "" : "s"} marked known.
              {knownWords.length > 0 && (
                <button className="es-options-link" onClick={() => setKnownWords([])}>
                  Forget all
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="es-options-row">
          <label htmlFor="secondary-subs">Second line</label>
          <div>
            <select
              id="secondary-subs"
              className="es-options-select"
              value={secondary}
              onChange={(e) => isSecondarySubs(e.target.value) && setSecondary(e.target.value)}
            >
              {SECONDARY_SUBS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="es-options-help">
              {SECONDARY_SUBS_OPTIONS.find((o) => o.value === secondary)?.description} Press D in the player to cycle.
            </div>
          </div>
        </div>
        <p className="es-popup-hint">
          Subtitle size, position, delay, playback pausing and translation language are in the settings panel inside
          the video player (the Himotoki button in the player controls).
        </p>
      </section>

      <section className="es-options-section">
        <h2>Offline dictionary</h2>
        <DictionaryPanel />
      </section>

      <section className="es-options-section">
        <h2>Himotoki account</h2>
        <AccountPanel />
      </section>

      <section className="es-options-section">
        <h2>About</h2>
        <p className="es-popup-hint">
          Japanese subtitles are split into words with a local model and looked up in Jitendex. Whole-line
          translation uses Google Translate or DeepL.{" "}
          <a href={HIMOTOKI_API_BASE} target="_blank" rel="noreferrer">
            himotoki.my.id
          </a>
        </p>
        <p className="es-popup-hint">
          Dictionary data: <a href="https://jitendex.org/" target="_blank" rel="noreferrer">Jitendex</a> © Stephen Kraus,{" "}
          <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>, built from{" "}
          <a href="https://www.edrdg.org/jmdict/j_jmdict.html" target="_blank" rel="noreferrer">JMdict</a> (EDRDG) and{" "}
          <a href="https://tatoeba.org/" target="_blank" rel="noreferrer">Tatoeba</a> examples (CC BY 2.0 FR). Nothing you
          watch or look up leaves your device unless you use online translation or save to your account (see the{" "}
          <a href="https://github.com/msr2903/himotoki-sub/blob/master/PRIVACY.md" target="_blank" rel="noreferrer">privacy policy</a>).
        </p>
      </section>
    </div>
  );
};

export default Options;
