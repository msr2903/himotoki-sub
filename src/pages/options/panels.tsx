/** Drill-in panels of the settings page (`?panel=<id>`). */
import { FC } from "react";

import type { TFuriganaLevel, TMouseAction, TMouseButton, TReadingLineMode, TSecondarySubs, TTokenAction } from "@src/models/types";
import { ENDPOINT_DEFAULTS, type EndpointKey, originMatchPattern } from "@src/shared/runtimeConfig";
import {
  CLICK_ACTION_SETTING,
  DEFAULT_CLICK_ACTION,
  DEFAULT_HOVER_ACTION,
  HOVER_ACTION_SETTING,
  TOKEN_ACTIONS,
  isTokenAction,
} from "@src/shared/tokenActions";
import { DEFAULT_SECONDARY_SUBS, SECONDARY_SUBS_OPTIONS, SECONDARY_SUBS_SETTING, isSecondarySubs } from "@src/shared/secondarySubs";
import { DEFAULT_READING_LINE, READING_LINE_OPTIONS, READING_LINE_SETTING, isReadingLineMode } from "@src/shared/furiganaSettings";
import { DEFAULT_FURIGANA_LEVEL, FURIGANA_LEVEL_OPTIONS, FURIGANA_LEVEL_SETTING, isFuriganaLevel } from "@src/shared/furiganaDifficulty";
import { UI_SCALE_DEFAULT, UI_SCALE_MAX, UI_SCALE_MIN, UI_SCALE_SETTING, UI_SCALE_STEP } from "@src/shared/uiScale";
import {
  MEANING_SIZE_DEFAULT,
  MEANING_SIZE_MAX,
  MEANING_SIZE_MIN,
  MEANING_SIZE_SETTING,
  MEANING_SIZE_STEP,
} from "@src/shared/labelSettings";
import { DEFAULT_DIM_KNOWN, DIM_KNOWN_SETTING, KNOWN_WORDS_SETTING } from "@src/shared/knownWords";
import { WORD_STATUSES_SETTING } from "@src/shared/wordStatus";
import {
  ANKI_CARD_THEME_OPTIONS,
  ANKI_CARD_THEME_SETTING,
  ANKI_DECK_SETTING,
  ANKI_RICH_CARDS_SETTING,
  ANKI_TAGS_SETTING,
  DEFAULT_ANKI_CARD_THEME,
  DEFAULT_ANKI_DECK,
  DEFAULT_ANKI_RICH_CARDS,
  DEFAULT_ANKI_TAGS,
  isAnkiCardTheme,
} from "@src/shared/ankiSettings";
import type { TAnkiCardTheme } from "@src/utils/ankiNote";
import { DEFAULT_MOUSE_ACTION, MOUSE_ACTIONS, MOUSE_BUTTONS, isMouseAction } from "@src/shared/mouseActions";
import { DEFAULT_PITCH_DISPLAY, PITCH_DISPLAY_OPTIONS, PITCH_DISPLAY_SETTING, isPitchDisplay, type TPitchDisplay } from "@src/shared/pitchSettings";
import { DEFAULT_NEW_WORDS_LEVEL, NEW_WORDS_LEVEL_OPTIONS, NEW_WORDS_LEVEL_SETTING, isNewWordsLevel, type TNewWordsLevel } from "@src/shared/newWordsOnly";
import { LOOKUP_HISTORY_SETTING } from "@src/shared/lookupHistory";
import { buildRows, toCsv, toJson } from "@src/shared/exportWords";
import { DictionaryPanel } from "@src/pages/shared/DictionaryPanel";
import { Card, ChipsRow, ConfirmButton, Item, SelectRow, StepperRow, TextRow, ToggleRow } from "./controls";
import { isBool, isFiniteNumber, isString, usePersistedSetting, useRawStringSetting } from "./hooks";

export const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((k) => typeof k === "string");
export const isStringRecord = (v: unknown): v is Record<string, string> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Known words: explicit "known" statuses plus legacy-array keys with no status override. */
export const countKnown = (knownWords: string[], statuses: Record<string, string>) =>
  new Set([
    ...Object.keys(statuses).filter((k) => statuses[k] === "known"),
    ...knownWords.filter((k) => !(k in statuses)),
  ]).size;

const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

const PITCH_CHIP_LABELS: Record<TPitchDisplay, string> = { contour: "Contour", number: "Number", hidden: "Hidden" };
export const PITCH_CHIPS = PITCH_DISPLAY_OPTIONS.map((o) => ({ ...o, label: PITCH_CHIP_LABELS[o.value] }));

/** Trigger a client-side file download of some text. */
const downloadText = (filename: string, text: string, mime: string) => {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const WordsPanel: FC = () => {
  const [hoverAction, setHoverAction] = usePersistedSetting<TTokenAction>(HOVER_ACTION_SETTING, DEFAULT_HOVER_ACTION, isTokenAction);
  const [clickAction, setClickAction] = usePersistedSetting<TTokenAction>(CLICK_ACTION_SETTING, DEFAULT_CLICK_ACTION, isTokenAction);
  const [meaningSize, setMeaningSize] = usePersistedSetting<number>(MEANING_SIZE_SETTING, MEANING_SIZE_DEFAULT, isFiniteNumber);
  const [uiScale, setUiScale] = usePersistedSetting<number>(UI_SCALE_SETTING, UI_SCALE_DEFAULT, isFiniteNumber);
  const [dimKnown, setDimKnown] = usePersistedSetting<boolean>(DIM_KNOWN_SETTING, DEFAULT_DIM_KNOWN, isBool);
  const [pitchDisplay, setPitchDisplay] = usePersistedSetting<TPitchDisplay>(PITCH_DISPLAY_SETTING, DEFAULT_PITCH_DISPLAY, isPitchDisplay);

  return (
    <>
      <Card title="Hover and click">
        <SelectRow id="hover-action" title="On hover" value={hoverAction} options={TOKEN_ACTIONS} onChange={setHoverAction} guard={isTokenAction} />
        <SelectRow id="click-action" title="On click" value={clickAction} options={TOKEN_ACTIONS} onChange={setClickAction} guard={isTokenAction} />
      </Card>
      <Card title="Dictionary pop-up">
        <ChipsRow id="pitch-display" title="Pitch accent" value={pitchDisplay} options={PITCH_CHIPS} onChange={setPitchDisplay} />
      </Card>
      <Card title="Size">
        <StepperRow
          id="meaning-size"
          title="Meaning size"
          hint="The short meaning shown above a hovered word."
          value={meaningSize}
          min={MEANING_SIZE_MIN}
          max={MEANING_SIZE_MAX}
          step={MEANING_SIZE_STEP}
          unit="%"
          onChange={setMeaningSize}
        />
        <StepperRow
          id="ui-scale"
          title="Pop-up size"
          hint="The dictionary pop-up, hover labels and the in-player panel."
          value={uiScale}
          min={UI_SCALE_MIN}
          max={UI_SCALE_MAX}
          step={UI_SCALE_STEP}
          unit="%"
          onChange={setUiScale}
        />
      </Card>
      <Card>
        <ToggleRow
          id="dim-known"
          title="Dim known words"
          hint="Fade words you have marked known in the pop-up."
          checked={dimKnown}
          onChange={setDimKnown}
        />
      </Card>
    </>
  );
};

export const SubtitlesPanel: FC = () => {
  const [furiganaLevel, setFuriganaLevel] = usePersistedSetting<TFuriganaLevel>(FURIGANA_LEVEL_SETTING, DEFAULT_FURIGANA_LEVEL, isFuriganaLevel);
  const [readingLine, setReadingLine] = usePersistedSetting<TReadingLineMode>(READING_LINE_SETTING, DEFAULT_READING_LINE, isReadingLineMode);
  const [secondary, setSecondary] = usePersistedSetting<TSecondarySubs>(SECONDARY_SUBS_SETTING, DEFAULT_SECONDARY_SUBS, isSecondarySubs);
  const secondaryDesc = SECONDARY_SUBS_OPTIONS.find((o) => o.value === secondary)?.description;
  const [newWords, setNewWords] = usePersistedSetting<TNewWordsLevel>(NEW_WORDS_LEVEL_SETTING, DEFAULT_NEW_WORDS_LEVEL, isNewWordsLevel);

  return (
    <>
      <Card title="Furigana">
        <SelectRow
          id="furigana-level"
          title="Skip easy words"
          value={furiganaLevel}
          options={FURIGANA_LEVEL_OPTIONS}
          onChange={setFuriganaLevel}
          guard={isFuriganaLevel}
        />
        <ChipsRow id="reading-line" title="Kana reading line" value={readingLine} options={READING_LINE_OPTIONS} onChange={setReadingLine} />
      </Card>
      <Card>
        <ChipsRow
          id="secondary-subs"
          title="Second line"
          hint={<>{secondaryDesc} Press D in the player to switch.</>}
          value={secondary}
          options={SECONDARY_SUBS_OPTIONS}
          onChange={setSecondary}
        />
      </Card>
      <Card
        title={
          <>
            New words only <span className="beta">Beta</span>
          </>
        }
      >
        <p className="card-hint">
          Pick your JLPT level and each subtitle line is replaced by a short glossary of the words you probably
          don't know yet (harder JLPT words and rare ones), with their meanings. Missed one? Click Show line (or
          press H), then mark the word Learning to always list it. Needs the offline dictionary.
        </p>
        <ChipsRow id="new-words" title="Your JLPT level" value={newWords} options={NEW_WORDS_LEVEL_OPTIONS} onChange={setNewWords} />
      </Card>
    </>
  );
};

const MouseActionRow: FC<{ button: TMouseButton }> = ({ button }) => {
  const { label, setting } = MOUSE_BUTTONS.find((b) => b.id === button)!;
  const [action, setAction] = usePersistedSetting<TMouseAction>(setting, DEFAULT_MOUSE_ACTION, isMouseAction);
  return <SelectRow id={`mouse-${button}`} title={label} value={action} options={MOUSE_ACTIONS} onChange={setAction} guard={isMouseAction} />;
};

export const MousePanel: FC = () => (
  <Card>
    <p className="card-hint">
      These work while the pointer is over the video. Everywhere else the buttons keep their usual browser behaviour.
    </p>
    {MOUSE_BUTTONS.map((b) => (
      <MouseActionRow key={b.id} button={b.id} />
    ))}
  </Card>
);

export const AnkiPanel: FC = () => {
  const [richCards, setRichCards] = usePersistedSetting<boolean>(ANKI_RICH_CARDS_SETTING, DEFAULT_ANKI_RICH_CARDS, isBool);
  const [cardTheme, setCardTheme] = usePersistedSetting<TAnkiCardTheme>(ANKI_CARD_THEME_SETTING, DEFAULT_ANKI_CARD_THEME, isAnkiCardTheme);
  const [deck, setDeck] = usePersistedSetting<string>(ANKI_DECK_SETTING, DEFAULT_ANKI_DECK, isString);
  const [tags, setTags] = usePersistedSetting<string>(ANKI_TAGS_SETTING, DEFAULT_ANKI_TAGS, isString);

  return (
    <>
      <Card title="Cards">
        <ToggleRow
          id="anki-rich-cards"
          title="Rich cards"
          hint="Add the sentence, reading, JLPT tags, a screenshot and the line's audio. Off saves just the word and meaning."
          checked={richCards}
          onChange={setRichCards}
        />
        <ChipsRow id="anki-card-theme" title="Card theme" value={cardTheme} options={ANKI_CARD_THEME_OPTIONS} onChange={setCardTheme} />
      </Card>
      <Card title="Where cards go">
        <TextRow id="anki-deck" title="Deck" hint="Created in Anki if it doesn't exist." value={deck} placeholder={DEFAULT_ANKI_DECK} onChange={setDeck} />
        <TextRow id="anki-tags" title="Tags" hint="Separate tags with spaces or commas." value={tags} placeholder={DEFAULT_ANKI_TAGS} onChange={setTags} />
      </Card>
    </>
  );
};

export const DictionaryView: FC = () => (
  <Card>
    <DictionaryPanel />
  </Card>
);

export const DataPanel: FC = () => {
  const [knownWords, setKnownWords] = usePersistedSetting<string[]>(KNOWN_WORDS_SETTING, [], isStringArray);
  const [statuses, setStatuses] = usePersistedSetting<Record<string, string>>(WORD_STATUSES_SETTING, {}, isStringRecord);
  const [history, setHistory] = usePersistedSetting<unknown[]>(LOOKUP_HISTORY_SETTING, [], Array.isArray);

  const knownCount = countKnown(knownWords, statuses);
  const exportCount = new Set([...knownWords, ...Object.keys(statuses)]).size;
  const exportWords = (format: "json" | "csv") => {
    const rows = buildRows(knownWords, statuses);
    const today = new Date().toISOString().slice(0, 10);
    if (format === "json") downloadText(`himotoki-words-${today}.json`, toJson(rows), "application/json");
    else downloadText(`himotoki-words-${today}.csv`, toCsv(rows), "text/csv");
  };

  return (
    <>
      <Card>
        <Item id="known-words" title="Known words" hint={knownCount ? `${plural(knownCount, "word", "words")} marked known.` : "Nothing here yet"}>
          <ConfirmButton
            label="Forget all"
            disabled={knownCount === 0}
            onConfirm={() => {
              setKnownWords([]);
              // "known" entries in the status map win over the legacy array, so they must be
              // cleared too — otherwise forgotten words stay Known.
              setStatuses(Object.fromEntries(Object.entries(statuses).filter(([, s]) => s !== "known")));
            }}
          />
        </Item>
        <Item
          id="lookup-history"
          title="Recent lookups"
          hint={history.length ? `${plural(history.length, "lookup", "lookups")}. Browse them in the in-player panel.` : "Nothing here yet"}
        >
          <ConfirmButton label="Clear" disabled={history.length === 0} onConfirm={() => setHistory([])} />
        </Item>
      </Card>
      <Card title="Export">
        <Item
          id="export-words"
          title="Saved words"
          hint={
            exportCount === 0
              ? "Mark words known or set a status in the pop-up to build your list."
              : `${plural(exportCount, "word", "words")} with headwords and status.`
          }
        >
          <span className="pills">
            <button type="button" className="pill" disabled={exportCount === 0} onClick={() => exportWords("json")}>
              JSON
            </button>
            <button type="button" className="pill" disabled={exportCount === 0} onClick={() => exportWords("csv")}>
              CSV
            </button>
          </span>
        </Item>
      </Card>
    </>
  );
};

export const AdvancedPanel: FC = () => {
  const [dictUrl, setDictUrl] = useRawStringSetting("himotokiDictUrl");
  const [convexUrl, setConvexUrl] = useRawStringSetting("himotokiConvexUrl");
  const [googleClientId, setGoogleClientId] = useRawStringSetting("himotokiGoogleClientId");
  // A custom URL on a new origin needs host permission, which needs a user gesture — a blur
  // after typing qualifies.
  const applyEndpointUrl = (key: EndpointKey, value: string, set: (v: string) => void) => {
    set(value);
    const trimmed = value.trim();
    if (!trimmed) return;
    const pattern = originMatchPattern(trimmed);
    if (pattern) void chrome.permissions.request({ origins: [pattern] }).catch(() => undefined);
  };
  const custom = Boolean(dictUrl || convexUrl || googleClientId);

  return (
    <Card>
      <p className="card-hint">Leave a field blank to use the built-in default.</p>
      <TextRow
        id="endpoint-dict"
        title="Dictionary URL"
        hint="Where the offline dictionary (.sqlite.gz and its .json manifest) is downloaded from."
        value={dictUrl}
        placeholder={ENDPOINT_DEFAULTS.himotokiDictUrl}
        onChange={setDictUrl}
        onBlur={(v) => applyEndpointUrl("himotokiDictUrl", v, setDictUrl)}
      />
      <TextRow
        id="endpoint-convex"
        title="Convex URL"
        hint="Backend for saving words to your Himotoki account."
        value={convexUrl}
        placeholder={ENDPOINT_DEFAULTS.himotokiConvexUrl}
        onChange={setConvexUrl}
        onBlur={(v) => applyEndpointUrl("himotokiConvexUrl", v, setConvexUrl)}
      />
      <TextRow
        id="endpoint-google"
        title="Google client ID"
        hint="OAuth client used for account sign-in."
        value={googleClientId}
        placeholder={ENDPOINT_DEFAULTS.himotokiGoogleClientId}
        onChange={setGoogleClientId}
      />
      {custom && (
        <Item title="Custom endpoints are set">
          <button
            type="button"
            className="pill"
            onClick={() => {
              setDictUrl("");
              setConvexUrl("");
              setGoogleClientId("");
            }}
          >
            Reset
          </button>
        </Item>
      )}
    </Card>
  );
};

export const AboutPanel: FC = () => (
  <Card>
    <p className="prose">
      Japanese subtitles are split into words with a local model and looked up in Jitendex on your device. Whole-line
      translation uses Google Translate or DeepL.
    </p>
    <p className="prose">
      Dictionary data: <a href="https://jitendex.org/" target="_blank" rel="noreferrer">Jitendex</a> © Stephen Kraus,{" "}
      <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>, built from{" "}
      <a href="https://www.edrdg.org/jmdict/j_jmdict.html" target="_blank" rel="noreferrer">JMdict</a> (EDRDG) and{" "}
      <a href="https://tatoeba.org/" target="_blank" rel="noreferrer">Tatoeba</a> examples (CC BY 2.0 FR). Whole-line
      translation and saving to your account use online services (see the{" "}
      <a href="https://github.com/msr2903/himotoki-sub/blob/master/PRIVACY.md" target="_blank" rel="noreferrer">privacy policy</a>).
    </p>
    <p className="prose muted">Himotoki Sub v{chrome.runtime.getManifest().version}</p>
  </Card>
);
