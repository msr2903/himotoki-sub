import { FC, ReactNode, useEffect, useRef, useState } from "react";

import type { TFuriganaLevel, TFuriganaMode, TMouseAction, TMouseButton, TReadingLineMode, TSecondarySubs, TTokenAction } from "@src/models/types";
import { onPersistedChange, readPersisted, writePersisted } from "@src/shared/persistedSettings";
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
import {
  MEANING_SIZE_DEFAULT,
  MEANING_SIZE_MAX,
  MEANING_SIZE_MIN,
  MEANING_SIZE_SETTING,
  MEANING_SIZE_STEP,
  clampMeaningSize,
} from "@src/shared/labelSettings";
import {
  DEFAULT_FURIGANA_LEVEL,
  FURIGANA_LEVEL_OPTIONS,
  FURIGANA_LEVEL_SETTING,
  isFuriganaLevel,
} from "@src/shared/furiganaDifficulty";
import { COLOR_BY_DIFFICULTY_SETTING, DEFAULT_COLOR_BY_DIFFICULTY } from "@src/shared/tokenColor";
import { DEFAULT_DIM_KNOWN, DIM_KNOWN_SETTING, KNOWN_WORDS_SETTING } from "@src/shared/knownWords";
import {
  ANKI_CARD_THEME_OPTIONS,
  ANKI_CARD_THEME_SETTING,
  ANKI_RICH_CARDS_SETTING,
  ANKI_DECK_SETTING,
  ANKI_TAGS_SETTING,
  DEFAULT_ANKI_CARD_THEME,
  DEFAULT_ANKI_RICH_CARDS,
  DEFAULT_ANKI_DECK,
  DEFAULT_ANKI_TAGS,
  isAnkiCardTheme,
} from "@src/shared/ankiSettings";
import type { TAnkiCardTheme } from "@src/utils/ankiNote";
import { DEFAULT_LISTENING_MODE, LISTENING_MODE_SETTING } from "@src/shared/listeningMode";
import { DEFAULT_MOUSE_ACTION, MOUSE_ACTIONS, MOUSE_BUTTONS, isMouseAction } from "@src/shared/mouseActions";
import { buildRows, toCsv, toJson } from "@src/shared/exportWords";
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

/**
 * A plain (non-`persist:`) chrome.storage.local string key, used for runtime endpoint overrides.
 * An empty value removes the key so the compiled-in default applies.
 */
function useRawStringSetting(key: string): readonly [string, (next: string) => void] {
  const [value, setValue] = useState("");
  useEffect(() => {
    void chrome.storage.local.get([key]).then((r) => setValue(typeof r[key] === "string" ? r[key] : ""));
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && key in changes) {
        const next = changes[key]?.newValue;
        setValue(typeof next === "string" ? next : "");
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [key]);
  const update = (next: string) => {
    setValue(next);
    const trimmed = next.trim();
    void (trimmed ? chrome.storage.local.set({ [key]: trimmed }) : chrome.storage.local.remove([key]));
  };
  return [value, update] as const;
}

/** Sidebar sections, matching the himotoki.my.id settings layout. */
const SETTINGS_NAV = [
  { id: "words", label: "Words" },
  { id: "readings", label: "Furigana & readings" },
  { id: "appearance", label: "Appearance" },
  { id: "mouse", label: "Mouse controls" },
  { id: "dictionary", label: "Dictionary" },
  { id: "account", label: "Account" },
  { id: "advanced", label: "Advanced" },
  { id: "about", label: "About" },
] as const;

/** A titled card section that the jump-nav scrolls to. */
const Group: FC<{ id: string; title: string; lede?: ReactNode; children: ReactNode }> = ({
  id,
  title,
  lede,
  children,
}) => (
  <section id={`settings-${id}`} className="group" aria-labelledby={`${id}-heading`}>
    <h2 id={`${id}-heading`}>{title}</h2>
    {lede && <p className="group-lede">{lede}</p>}
    {children}
  </section>
);

/** One row: title + description on the left, a control on the right. */
const Row: FC<{ title: string; desc?: ReactNode; control: ReactNode; htmlFor?: string }> = ({
  title,
  desc,
  control,
  htmlFor,
}) => (
  <label className="row" htmlFor={htmlFor}>
    <span className="row-text">
      <span className="row-title">{title}</span>
      {desc && <span className="row-desc">{desc}</span>}
    </span>
    {control}
  </label>
);

type Option<T extends string> = { value: T; label: string; description?: string };

function SettingSelect<T extends string>({
  id,
  value,
  options,
  onChange,
  guard,
}: {
  id: string;
  value: T;
  options: ReadonlyArray<Option<T>>;
  onChange: (v: T) => void;
  guard: (v: unknown) => v is T;
}) {
  return (
    <select
      id={id}
      className="lang-select"
      value={value}
      onChange={(e) => {
        if (guard(e.target.value)) onChange(e.target.value);
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

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

const actionDesc = (value: TTokenAction) => TOKEN_ACTIONS.find((a) => a.value === value)?.description ?? "";
const optionDesc = <T extends string>(options: ReadonlyArray<Option<T>>, value: T) =>
  options.find((o) => o.value === value)?.description ?? "";

/** Middle / side mouse button binding; each button is its own persisted key. */
const MouseActionRow: FC<{ button: TMouseButton }> = ({ button }) => {
  const { label, setting } = MOUSE_BUTTONS.find((b) => b.id === button)!;
  const [action, setAction] = usePersistedSetting<TMouseAction>(setting, DEFAULT_MOUSE_ACTION, isMouseAction);
  return (
    <Row
      title={label}
      desc={optionDesc(MOUSE_ACTIONS, action)}
      htmlFor={`mouse-${button}`}
      control={
        <SettingSelect
          id={`mouse-${button}`}
          value={action}
          options={MOUSE_ACTIONS}
          onChange={setAction}
          guard={isMouseAction}
        />
      }
    />
  );
};

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
  const [meaningSize, setMeaningSize] = usePersistedSetting<number>(
    MEANING_SIZE_SETTING,
    MEANING_SIZE_DEFAULT,
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  const [secondary, setSecondary] = usePersistedSetting<TSecondarySubs>(
    SECONDARY_SUBS_SETTING,
    DEFAULT_SECONDARY_SUBS,
    isSecondarySubs,
  );
  const [furigana, setFurigana] = usePersistedSetting<TFuriganaMode>(FURIGANA_SETTING, DEFAULT_FURIGANA, isFuriganaMode);
  const [furiganaLevel, setFuriganaLevel] = usePersistedSetting<TFuriganaLevel>(
    FURIGANA_LEVEL_SETTING,
    DEFAULT_FURIGANA_LEVEL,
    isFuriganaLevel,
  );
  const [colorByDifficulty, setColorByDifficulty] = usePersistedSetting<boolean>(
    COLOR_BY_DIFFICULTY_SETTING,
    DEFAULT_COLOR_BY_DIFFICULTY,
    (v): v is boolean => typeof v === "boolean",
  );
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
    (v): v is string[] => Array.isArray(v) && v.every((key) => typeof key === "string"),
  );
  const [ankiRichCards, setAnkiRichCards] = usePersistedSetting<boolean>(
    ANKI_RICH_CARDS_SETTING,
    DEFAULT_ANKI_RICH_CARDS,
    (v): v is boolean => typeof v === "boolean",
  );
  const [ankiCardTheme, setAnkiCardTheme] = usePersistedSetting<TAnkiCardTheme>(
    ANKI_CARD_THEME_SETTING,
    DEFAULT_ANKI_CARD_THEME,
    isAnkiCardTheme,
  );
  const [ankiDeck, setAnkiDeck] = usePersistedSetting<string>(
    ANKI_DECK_SETTING,
    DEFAULT_ANKI_DECK,
    (v): v is string => typeof v === "string",
  );
  const [ankiTags, setAnkiTags] = usePersistedSetting<string>(
    ANKI_TAGS_SETTING,
    DEFAULT_ANKI_TAGS,
    (v): v is string => typeof v === "string",
  );
  // Persist key from src/models/history; kept as a literal so the options bundle avoids the content model.
  const [lookupHistory, setLookupHistory] = usePersistedSetting<unknown[]>(
    "lookupHistory",
    [],
    (v): v is unknown[] => Array.isArray(v),
  );
  const [listeningMode, setListeningMode] = usePersistedSetting<boolean>(
    LISTENING_MODE_SETTING,
    DEFAULT_LISTENING_MODE,
    (v): v is boolean => typeof v === "boolean",
  );
  // Persist key from the word-status feature; read defensively so export works with or without it.
  const [wordStatuses, setWordStatuses] = usePersistedSetting<Record<string, string>>(
    "wordStatuses",
    {},
    (v): v is Record<string, string> => typeof v === "object" && v !== null && !Array.isArray(v),
  );
  const version = chrome.runtime.getManifest().version;

  // Runtime endpoint overrides (plain storage keys) so a domain/backend move needs no rebuild.
  const [dictUrl, setDictUrl] = useRawStringSetting("himotokiDictUrl");
  const [convexUrl, setConvexUrl] = useRawStringSetting("himotokiConvexUrl");
  const [googleClientId, setGoogleClientId] = useRawStringSetting("himotokiGoogleClientId");
  // For a custom URL endpoint on a new origin, request host permission (needs a user gesture — a
  // Blur after typing qualifies) so the extension can actually fetch it.
  const applyEndpointUrl = (key: EndpointKey, value: string, set: (v: string) => void) => {
    set(value);
    const trimmed = value.trim();
    if (!trimmed) return;
    const pattern = originMatchPattern(trimmed);
    if (pattern) void chrome.permissions.request({ origins: [pattern] }).catch(() => undefined);
  };

  const exportCount = new Set([...knownWords, ...Object.keys(wordStatuses)]).size;
  // Effective known set: explicit "known" statuses plus legacy-array keys with no status
  // override (statusOf semantics — an explicit non-known status wins over the array).
  const knownCount = new Set([
    ...Object.keys(wordStatuses).filter((k) => wordStatuses[k] === "known"),
    ...knownWords.filter((k) => !(k in wordStatuses)),
  ]).size;
  const exportWords = (format: "json" | "csv") => {
    const rows = buildRows(knownWords, wordStatuses);
    const today = new Date().toISOString().slice(0, 10);
    if (format === "json") downloadText(`himotoki-words-${today}.json`, toJson(rows), "application/json");
    else downloadText(`himotoki-words-${today}.csv`, toCsv(rows), "text/csv");
  };

  const [activeNav, setActiveNav] = useState<string>(SETTINGS_NAV[0].id);
  const suppressScrollSpy = useRef(false);
  const pickActiveRef = useRef<(() => void) | null>(null);

  // Highlight the nav item for whichever section is in view (like himotoki.my.id). A plain
  // scroll listener picks the last section whose top has crossed the 30% line — an
  // IntersectionObserver ratio contest can never select the final, short section.
  useEffect(() => {
    const nodes = SETTINGS_NAV.map((item) => document.getElementById(`settings-${item.id}`)).filter(
      (n): n is HTMLElement => Boolean(n),
    );
    if (!nodes.length) return;
    const pickActive = () => {
      if (suppressScrollSpy.current) return;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) {
        setActiveNav(SETTINGS_NAV[SETTINGS_NAV.length - 1]!.id);
        return;
      }
      const line = window.innerHeight * 0.3;
      let active: string = SETTINGS_NAV[0].id;
      for (const node of nodes) {
        if (node.getBoundingClientRect().top <= line) active = node.id.replace(/^settings-/, "");
      }
      setActiveNav(active);
    };
    pickActiveRef.current = pickActive;
    window.addEventListener("scroll", pickActive, { passive: true });
    window.addEventListener("resize", pickActive);
    pickActive();
    return () => {
      pickActiveRef.current = null;
      window.removeEventListener("scroll", pickActive);
      window.removeEventListener("resize", pickActive);
    };
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(`settings-${id}`);
    if (!el) return;
    setActiveNav(id);
    // Don't let the scroll spy fight the smooth scroll's intermediate sections — release when
    // the scroll settles (scrollend), with a timeout as fallback. Re-pick on release: nothing
    // else refires if the page is already settled.
    suppressScrollSpy.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    const release = () => {
      suppressScrollSpy.current = false;
      pickActiveRef.current?.();
    };
    if ("onscrollend" in window) window.addEventListener("scrollend", release, { once: true });
    window.setTimeout(release, 1200);
  };

  return (
    <div className="es-options">
      <header className="page-head">
        <h1>Settings</h1>
        <p className="lede">Himotoki Sub · Japanese subtitles, word split and dictionary · v{version}</p>
      </header>

      <div className="settings-shell">
        <nav className="settings-nav" aria-label="Settings sections">
          <p className="settings-nav-label">Jump to</p>
          <div className="settings-nav-list">
            {SETTINGS_NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`settings-nav-item ${activeNav === item.id ? "on" : ""}`}
                aria-current={activeNav === item.id ? "location" : undefined}
                onClick={() => scrollToSection(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="settings-main">
          <Group
            id="words"
            title="Words"
            lede="What happens when you hover or click a word in the subtitles. Hover results disappear when the pointer leaves; click results stay until you press Escape, click elsewhere, or the subtitle changes."
          >
            <Row
              title="On hover"
              desc={actionDesc(hoverAction)}
              htmlFor="hover-action"
              control={
                <SettingSelect
                  id="hover-action"
                  value={hoverAction}
                  options={TOKEN_ACTIONS}
                  onChange={setHoverAction}
                  guard={isTokenAction}
                />
              }
            />
            <Row
              title="On click"
              desc={actionDesc(clickAction)}
              htmlFor="click-action"
              control={
                <SettingSelect
                  id="click-action"
                  value={clickAction}
                  options={TOKEN_ACTIONS}
                  onChange={setClickAction}
                  guard={isTokenAction}
                />
              }
            />
            <Row
              title="Meaning size"
              desc="Size of the short meaning shown in the hover label above a word."
              htmlFor="meaning-size"
              control={
                <div className="range-control">
                  <input
                    id="meaning-size"
                    type="range"
                    min={MEANING_SIZE_MIN}
                    max={MEANING_SIZE_MAX}
                    step={MEANING_SIZE_STEP}
                    value={meaningSize}
                    onChange={(e) => setMeaningSize(clampMeaningSize(e.target.value))}
                  />
                  <span className="range-value">{meaningSize}%</span>
                </div>
              }
            />
            <Row
              title="Dim known words"
              desc="Dim words you have marked as known in the dictionary popup."
              htmlFor="dim-known"
              control={<input id="dim-known" type="checkbox" checked={dimKnown} onChange={(e) => setDimKnown(e.target.checked)} />}
            />
            <div className="row">
              <span className="row-desc">{knownCount} word{knownCount === 1 ? "" : "s"} marked known.</span>
              {knownCount > 0 && (
                <button
                  type="button"
                  className="es-options-link"
                  onClick={() => {
                    setKnownWords([]);
                    // "known" entries in the status map win over the legacy array, so they
                    // must be cleared too — otherwise forgotten words stay Known.
                    setWordStatuses(
                      Object.fromEntries(Object.entries(wordStatuses).filter(([, s]) => s !== "known")),
                    );
                  }}
                >
                  Forget all
                </button>
              )}
            </div>
            <Row
              title="Rich Anki cards"
              desc="When saving to Anki, build a sentence-mining card with the context sentence, reading, JLPT tags, a video screenshot and a cue audio clip. Off saves a plain word/meaning card."
              htmlFor="anki-rich-cards"
              control={
                <input
                  id="anki-rich-cards"
                  type="checkbox"
                  checked={ankiRichCards}
                  onChange={(e) => setAnkiRichCards(e.target.checked)}
                />
              }
            />
            <Row
              title="Anki card theme"
              desc={optionDesc(ANKI_CARD_THEME_OPTIONS, ankiCardTheme)}
              htmlFor="anki-card-theme"
              control={
                <SettingSelect
                  id="anki-card-theme"
                  value={ankiCardTheme}
                  options={ANKI_CARD_THEME_OPTIONS}
                  onChange={setAnkiCardTheme}
                  guard={isAnkiCardTheme}
                />
              }
            />
            <Row
              title="Anki deck"
              desc="Deck new cards are added to. Created automatically in Anki if it does not exist."
              htmlFor="anki-deck"
              control={
                <input
                  id="anki-deck"
                  type="text"
                  className="es-options-text"
                  value={ankiDeck}
                  placeholder={DEFAULT_ANKI_DECK}
                  onChange={(e) => setAnkiDeck(e.target.value)}
                />
              }
            />
            <Row
              title="Anki tags"
              desc="Tags added to each saved card. Separate multiple tags with spaces or commas."
              htmlFor="anki-tags"
              control={
                <input
                  id="anki-tags"
                  type="text"
                  className="es-options-text"
                  value={ankiTags}
                  placeholder={DEFAULT_ANKI_TAGS}
                  onChange={(e) => setAnkiTags(e.target.value)}
                />
              }
            />
            <div className="row">
              <span className="row-desc">{lookupHistory.length} recent lookup{lookupHistory.length === 1 ? "" : "s"} saved. Open the in-player panel to browse and jump back to them.</span>
              {lookupHistory.length > 0 && <button type="button" className="es-options-link" onClick={() => setLookupHistory([])}>Clear history</button>}
            </div>
          </Group>

          <Group id="readings" title="Furigana & readings">
            <Row
              title="Furigana"
              desc={optionDesc(FURIGANA_OPTIONS, furigana)}
              htmlFor="furigana"
              control={
                <SettingSelect
                  id="furigana"
                  value={furigana}
                  options={FURIGANA_OPTIONS}
                  onChange={setFurigana}
                  guard={isFuriganaMode}
                />
              }
            />
            <Row
              title="Furigana difficulty"
              desc={optionDesc(FURIGANA_LEVEL_OPTIONS, furiganaLevel)}
              htmlFor="furigana-level"
              control={
                <SettingSelect
                  id="furigana-level"
                  value={furiganaLevel}
                  options={FURIGANA_LEVEL_OPTIONS}
                  onChange={setFuriganaLevel}
                  guard={isFuriganaLevel}
                />
              }
            />
            <Row
              title="Reading line"
              desc={optionDesc(READING_LINE_OPTIONS, readingLine)}
              htmlFor="reading-line"
              control={
                <SettingSelect
                  id="reading-line"
                  value={readingLine}
                  options={READING_LINE_OPTIONS}
                  onChange={setReadingLine}
                  guard={isReadingLineMode}
                />
              }
            />
            <Row
              title="Second line"
              desc={
                <>
                  {optionDesc(SECONDARY_SUBS_OPTIONS, secondary)} Press D in the player to cycle.
                </>
              }
              htmlFor="secondary-subs"
              control={
                <SettingSelect
                  id="secondary-subs"
                  value={secondary}
                  options={SECONDARY_SUBS_OPTIONS}
                  onChange={setSecondary}
                  guard={isSecondarySubs}
                />
              }
            />
          </Group>

          <Group
            id="appearance"
            title="Appearance"
            lede="Subtitle size, position, delay, playback pausing and translation language live in the settings panel inside the video player (the Himotoki button in the player controls)."
          >
            <Row
              title="Pop-up size"
              desc="Size of the dictionary pop-up, hover labels and the in-player panel."
              htmlFor="ui-scale"
              control={
                <div className="range-control">
                  <input
                    id="ui-scale"
                    type="range"
                    min={UI_SCALE_MIN}
                    max={UI_SCALE_MAX}
                    step={UI_SCALE_STEP}
                    value={uiScale}
                    onChange={(e) => setUiScale(clampUiScale(e.target.value))}
                  />
                  <span className="range-value">{uiScale}%</span>
                </div>
              }
            />
            <Row
              title="Colour by difficulty"
              desc="Tint subtitle words by JLPT level (green = easy → red = hard). Off keeps a single colour."
              htmlFor="color-by-difficulty"
              control={
                <input
                  id="color-by-difficulty"
                  type="checkbox"
                  checked={colorByDifficulty}
                  onChange={(e) => setColorByDifficulty(e.target.checked)}
                />
              }
            />
            <Row
              title="Listening mode"
              desc="Blur the subtitle text for listening practice; reveal the current line on hover or with the H key."
              htmlFor="listening-mode"
              control={
                <input
                  id="listening-mode"
                  type="checkbox"
                  checked={listeningMode}
                  onChange={(e) => setListeningMode(e.target.checked)}
                />
              }
            />
          </Group>

          <Group
            id="mouse"
            title="Mouse controls"
            lede="Control playback without the keyboard. These work while the pointer is over the video; everywhere else the buttons keep their usual browser behaviour (back/forward, open link in new tab)."
          >
            {MOUSE_BUTTONS.map((b) => (
              <MouseActionRow key={b.id} button={b.id} />
            ))}
          </Group>

          <Group id="dictionary" title="Dictionary">
            <DictionaryPanel />
          </Group>

          <Group id="account" title="Account">
            <AccountPanel />
            <div className="row" id="export-words">
              <span className="row-text">
                <span className="row-title">Export saved words</span>
                <span className="row-desc">
                  {exportCount === 0
                    ? "No saved words yet — mark words known or set a status in the dictionary pop-up."
                    : `Download your ${exportCount} saved word${exportCount === 1 ? "" : "s"} (keys, headwords and status) as JSON or CSV.`}
                </span>
              </span>
              <span className="export-actions">
                <button type="button" className="es-options-link" disabled={exportCount === 0} onClick={() => exportWords("json")}>
                  Export JSON
                </button>
                <button type="button" className="es-options-link" disabled={exportCount === 0} onClick={() => exportWords("csv")}>
                  Export CSV
                </button>
              </span>
            </div>
          </Group>

          <Group
            id="advanced"
            title="Advanced"
            lede="Endpoints the extension talks to. Leave a field blank to use the built-in default; set one to point at a different host if the domain ever changes — no reinstall needed."
          >
            <Row
              title="Dictionary URL"
              desc="Where the offline dictionary (.sqlite.gz) is downloaded from. The .json manifest is fetched from the same path. Saving a custom URL asks for permission to access that site."
              htmlFor="endpoint-dict"
              control={
                <input
                  id="endpoint-dict"
                  type="text"
                  className="es-options-text"
                  value={dictUrl}
                  placeholder={ENDPOINT_DEFAULTS.himotokiDictUrl}
                  onChange={(e) => setDictUrl(e.target.value)}
                  onBlur={(e) => applyEndpointUrl("himotokiDictUrl", e.target.value, setDictUrl)}
                />
              }
            />
            <Row
              title="Convex URL"
              desc="Backend for Save to Himotoki (account favorites). Only used when you sign in."
              htmlFor="endpoint-convex"
              control={
                <input
                  id="endpoint-convex"
                  type="text"
                  className="es-options-text"
                  value={convexUrl}
                  placeholder={ENDPOINT_DEFAULTS.himotokiConvexUrl}
                  onChange={(e) => setConvexUrl(e.target.value)}
                  onBlur={(e) => applyEndpointUrl("himotokiConvexUrl", e.target.value, setConvexUrl)}
                />
              }
            />
            <Row
              title="Google client ID"
              desc="OAuth client ID used for Himotoki account sign-in."
              htmlFor="endpoint-google"
              control={
                <input
                  id="endpoint-google"
                  type="text"
                  className="es-options-text"
                  value={googleClientId}
                  placeholder={ENDPOINT_DEFAULTS.himotokiGoogleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                />
              }
            />
            {(dictUrl || convexUrl || googleClientId) && (
              <div className="row">
                <span className="row-desc">Custom endpoints are set.</span>
                <button
                  type="button"
                  className="es-options-link"
                  onClick={() => {
                    setDictUrl("");
                    setConvexUrl("");
                    setGoogleClientId("");
                  }}
                >
                  Reset to defaults
                </button>
              </div>
            )}
          </Group>

          <Group id="about" title="About">
            <p className="row-desc">
              Japanese subtitles are split into words with a local model and looked up in Jitendex on your
              device. Whole-line translation uses Google Translate or DeepL.
            </p>
            <p className="row-desc">
              Dictionary data: <a className="inline-link" href="https://jitendex.org/" target="_blank" rel="noreferrer">Jitendex</a> © Stephen Kraus,{" "}
              <a className="inline-link" href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>, built from{" "}
              <a className="inline-link" href="https://www.edrdg.org/jmdict/j_jmdict.html" target="_blank" rel="noreferrer">JMdict</a> (EDRDG) and{" "}
              <a className="inline-link" href="https://tatoeba.org/" target="_blank" rel="noreferrer">Tatoeba</a> examples (CC BY 2.0 FR). Word lookups run on your device using the offline dictionary. Whole-line translation and saving to your account use online services (see the{" "}
              <a className="inline-link" href="https://github.com/msr2903/himotoki-sub/blob/master/PRIVACY.md" target="_blank" rel="noreferrer">privacy policy</a>).
            </p>
          </Group>
        </div>
      </div>
    </div>
  );
};

export default Options;
