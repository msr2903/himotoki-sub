/**
 * Settings — a calm hub (search, account, look & feel, a short menu) with everything else one click
 * away in drill-in panels (`?panel=<id>`, so the browser back button closes them). Mirrors the
 * himotoki web app's settings page.
 */
import { FC, useEffect, useMemo, useState } from "react";
import cn from "classnames";

import type { TFuriganaLevel, TFuriganaMode, TMouseAction, TSecondarySubs, TTokenAction } from "@src/models/types";
import {
  CLICK_ACTION_SETTING,
  DEFAULT_CLICK_ACTION,
  DEFAULT_HOVER_ACTION,
  HOVER_ACTION_SETTING,
  TOKEN_ACTIONS,
  isTokenAction,
} from "@src/shared/tokenActions";
import { DEFAULT_SECONDARY_SUBS, SECONDARY_SUBS_OPTIONS, SECONDARY_SUBS_SETTING, isSecondarySubs } from "@src/shared/secondarySubs";
import { DEFAULT_FURIGANA, FURIGANA_OPTIONS, FURIGANA_SETTING, isFuriganaMode } from "@src/shared/furiganaSettings";
import {
  DEFAULT_FURIGANA_LEVEL,
  FURIGANA_LEVEL_SETTING,
  isFuriganaLevel,
  showFuriganaForLevel,
} from "@src/shared/furiganaDifficulty";
import { COLOR_BY_DIFFICULTY_SETTING, DEFAULT_COLOR_BY_DIFFICULTY, jlptColorClass } from "@src/shared/tokenColor";
import { KNOWN_WORDS_SETTING } from "@src/shared/knownWords";
import { WORD_STATUSES_SETTING } from "@src/shared/wordStatus";
import { ANKI_DECK_SETTING, ANKI_RICH_CARDS_SETTING, DEFAULT_ANKI_DECK, DEFAULT_ANKI_RICH_CARDS } from "@src/shared/ankiSettings";
import { DEFAULT_LISTENING_MODE, LISTENING_MODE_SETTING } from "@src/shared/listeningMode";
import { DEFAULT_MOUSE_ACTION, MOUSE_ACTIONS, MOUSE_BUTTONS, isMouseAction } from "@src/shared/mouseActions";
import { DEFAULT_THEME, THEME_SETTING, TTheme, isTheme } from "@src/shared/themeSettings";
import { useHimotokiSession } from "@src/pages/shared/useHimotokiSession";
import { Card, ChipsRow, Icon, IconName, MenuRow, SearchField, Tint, TintedIcon, ToggleRow } from "./controls";
import { isBool, isString, usePanelParam, usePersistedSetting, useRawStringSetting } from "./hooks";
import {
  AboutPanel,
  AdvancedPanel,
  AnkiPanel,
  DataPanel,
  DictionaryView,
  MousePanel,
  SubtitlesPanel,
  WordsPanel,
  countKnown,
  isStringArray,
  isStringRecord,
} from "./panels";

type PanelId = "words" | "subtitles" | "mouse" | "anki" | "dictionary" | "data" | "advanced" | "about";

const PANELS: Record<PanelId, { title: string; lede: string; icon: IconName; tint: Tint; View: FC }> = {
  words: { title: "Words", lede: "What hovering and clicking a subtitle word does, and what the pop-up shows.", icon: "cursor", tint: "teal", View: WordsPanel },
  subtitles: { title: "Subtitles", lede: "Which words get furigana, and a second subtitle line.", icon: "captions", tint: "blue", View: SubtitlesPanel },
  mouse: { title: "Mouse controls", lede: "Step through lines with the middle and side mouse buttons.", icon: "mouse", tint: "violet", View: MousePanel },
  anki: { title: "Anki", lede: "How words are saved as Anki cards.", icon: "cards", tint: "coral", View: AnkiPanel },
  dictionary: { title: "Dictionary", lede: "The offline dictionary used for every lookup.", icon: "book", tint: "teal", View: DictionaryView },
  data: { title: "Your data", lede: "Everything here is stored on this device.", icon: "box", tint: "amber", View: DataPanel },
  advanced: { title: "Advanced", lede: "Servers the extension talks to, if the defaults ever move.", icon: "sliders", tint: "grey", View: AdvancedPanel },
  about: { title: "About Himotoki Sub", lede: "Credits and licences.", icon: "info", tint: "grey", View: AboutPanel },
};

const isPanelId = (v: string | null): v is PanelId => v != null && v in PANELS;

/* ── Search ─────────────────────────────────────────────────── */

type SearchEntry = {
  title: string;
  keywords: string;
  /** Hub-level settings have no panel. */
  panel?: PanelId;
  /** Element to reveal once the target is shown. */
  focus: string;
};

const SEARCH_INDEX: SearchEntry[] = [
  { title: "Account", keywords: "profile sign in login out google himotoki save", focus: "profile" },
  { title: "Theme", keywords: "appearance dark light mode night colour color", focus: "theme" },
  { title: "Furigana", keywords: "reading ruby kana always hover never", focus: "furigana" },
  { title: "Colour by difficulty", keywords: "color jlpt level tint green red", focus: "color-by-difficulty" },
  { title: "Listening mode", keywords: "blur hide text practice peek", focus: "listening-mode" },
  { title: "On hover", panel: "words", keywords: "hover pointer label meaning furigana pop-up popup action", focus: "hover-action" },
  { title: "On click", panel: "words", keywords: "click pin pop-up popup dictionary action", focus: "click-action" },
  { title: "Meaning size", panel: "words", keywords: "font text gloss label size", focus: "meaning-size" },
  { title: "Pop-up size", panel: "words", keywords: "scale zoom popup panel size ui", focus: "ui-scale" },
  { title: "Pitch accent", panel: "words", keywords: "pitch accent contour number hide pop-up popup dictionary", focus: "pitch-display" },
  { title: "Dim known words", panel: "words", keywords: "known fade opacity", focus: "dim-known" },
  { title: "Skip furigana on easy words", panel: "subtitles", keywords: "furigana difficulty jlpt level n5 n4 n3 n2 n1", focus: "furigana-level" },
  { title: "Kana reading line", panel: "subtitles", keywords: "reading line kana hide text channel", focus: "reading-line" },
  { title: "Second line", panel: "subtitles", keywords: "dual subtitles second secondary translation track english", focus: "secondary-subs" },
  { title: "Mouse buttons", panel: "mouse", keywords: "mouse middle click side back forward button previous next replay", focus: "mouse-middle" },
  { title: "Rich cards", panel: "anki", keywords: "anki screenshot audio sentence mining card", focus: "anki-rich-cards" },
  { title: "Card theme", panel: "anki", keywords: "anki light dark night", focus: "anki-card-theme" },
  { title: "Deck and tags", panel: "anki", keywords: "anki deck tags", focus: "anki-deck" },
  { title: "Offline dictionary", panel: "dictionary", keywords: "jitendex download install update remove offline", focus: "panel-title" },
  { title: "Known words", panel: "data", keywords: "known forget clear reset", focus: "known-words" },
  { title: "Recent lookups", panel: "data", keywords: "history lookups clear", focus: "lookup-history" },
  { title: "Export saved words", panel: "data", keywords: "export download csv json backup", focus: "export-words" },
  { title: "Endpoints", panel: "advanced", keywords: "url server convex google client id domain", focus: "endpoint-dict" },
  { title: "About", panel: "about", keywords: "about licence license credits version privacy", focus: "panel-title" },
];

function searchSettings(query: string): SearchEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return SEARCH_INDEX.filter((e) => {
    const hay = `${e.title} ${e.panel ? PANELS[e.panel].title : ""} ${e.keywords}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** Scroll a control into view and flash its row once it has rendered. */
const reveal = (id: string) =>
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    const row = el?.closest(".item, .card, .panel-head") ?? el;
    if (!el || !row) return;
    row.scrollIntoView({ block: "center" });
    row.classList.remove("flash");
    void (row as HTMLElement).offsetWidth;
    row.classList.add("flash");
    row.addEventListener("animationend", () => row.classList.remove("flash"), { once: true });
    if (el.matches("input, select, button")) (el as HTMLElement).focus({ preventScroll: true });
  });

/* ── Account ────────────────────────────────────────────────── */

const GoogleMark: FC = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const ProfileCard: FC = () => {
  const { user, busy, error, signIn, signOut } = useHimotokiSession();
  return (
    <section className="card" aria-label="Account" id="profile">
      <div className="profile">
        {user?.picture ? (
          <img className="avatar" src={user.picture} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="avatar" aria-hidden="true">
            <Icon name="user" size={26} />
          </span>
        )}
        <div className="profile-text">
          <span className="profile-name">{user ? user.name || "Signed in" : "Not signed in"}</span>
          <span className="item-hint">
            {user ? user.email : "Sign in to save subtitle words to your Himotoki account. Everything else works without one."}
          </span>
          {error && <span className="error">{error}</span>}
        </div>
        <div className="profile-action">
          {user ? (
            <button type="button" className="pill quiet" disabled={busy} onClick={signOut}>
              Sign out
            </button>
          ) : (
            <button type="button" className="google-btn" disabled={busy} onClick={signIn}>
              <GoogleMark />
              {busy ? "Signing in…" : "Sign in with Google"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

/* ── Look & feel ────────────────────────────────────────────── */

type PreviewToken = { parts: Array<[string, string?]>; jlpt?: string[] };

/** 昨日、偶然懐かしい映画を見つけた — mixed JLPT levels so every setting shows. */
const PREVIEW_LINE: PreviewToken[] = [
  { parts: [["昨日", "きのう"]], jlpt: ["N5"] },
  { parts: [["、"]] },
  { parts: [["偶然", "ぐうぜん"]], jlpt: ["N2"] },
  { parts: [["懐", "なつ"], ["かしい"]], jlpt: ["N2"] },
  { parts: [["映画", "えいが"]], jlpt: ["N5"] },
  { parts: [["を"]] },
  { parts: [["見", "み"], ["つけた"]], jlpt: ["N4"] },
];
/** The token drawn as "under the pointer" when furigana is on hover. */
const PREVIEW_HOVER = 3;

/** A sample subtitle line that reacts live to the look & feel settings. */
const SubtitlePreview: FC<{ furigana: TFuriganaMode; level: TFuriganaLevel; color: boolean; listening: boolean }> = ({
  furigana,
  level,
  color,
  listening,
}) => (
  <div className="preview" aria-hidden="true">
    <span className="preview-tag">Preview</span>
    <p className={cn("preview-sub", { listening })}>
      {PREVIEW_LINE.map((token, i) => {
        const hovered = furigana === "hover" && i === PREVIEW_HOVER;
        const ruby =
          (furigana === "always" || hovered) && token.jlpt !== undefined && showFuriganaForLevel(token.jlpt, level);
        return (
          <span key={i} className={cn("preview-token", color && jlptColorClass(token.jlpt), { hovered })}>
            {token.parts.map(([text, reading], j) =>
              ruby && reading ? (
                <ruby key={j}>
                  {text}
                  <rt>{reading}</rt>
                </ruby>
              ) : (
                <span key={j}>{text}</span>
              ),
            )}
          </span>
        );
      })}
    </p>
  </div>
);

const THEMES: ReadonlyArray<{ value: TTheme; label: string; icon: IconName }> = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
];

/** Theme tiles, as on the web app. Applies to the extension pages; the in-player UI stays dark. */
const ThemePicker: FC = () => {
  const [theme, setTheme] = usePersistedSetting<TTheme>(THEME_SETTING, DEFAULT_THEME, isTheme);
  return (
    <div className="theme-tiles" role="radiogroup" aria-label="Theme" id="theme">
      {THEMES.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          className={cn("theme-tile", { on: theme === o.value })}
          data-variant={o.value}
          onClick={() => setTheme(o.value)}
        >
          <span className="theme-art" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="theme-label">
            <Icon name={o.icon} size={16} />
            {o.label}
          </span>
        </button>
      ))}
    </div>
  );
};

const LookAndFeel: FC = () => {
  const [furigana, setFurigana] = usePersistedSetting<TFuriganaMode>(FURIGANA_SETTING, DEFAULT_FURIGANA, isFuriganaMode);
  const [level] = usePersistedSetting<TFuriganaLevel>(FURIGANA_LEVEL_SETTING, DEFAULT_FURIGANA_LEVEL, isFuriganaLevel);
  const [color, setColor] = usePersistedSetting<boolean>(COLOR_BY_DIFFICULTY_SETTING, DEFAULT_COLOR_BY_DIFFICULTY, isBool);
  const [listening, setListening] = usePersistedSetting<boolean>(LISTENING_MODE_SETTING, DEFAULT_LISTENING_MODE, isBool);

  return (
    <Card title="Look & feel">
      <ThemePicker />
      <SubtitlePreview furigana={furigana} level={level} color={color} listening={listening} />
      <ChipsRow id="furigana" title="Furigana" value={furigana} options={FURIGANA_OPTIONS} onChange={setFurigana} />
      <ToggleRow
        id="color-by-difficulty"
        title="Colour by difficulty"
        hint="Tint words by JLPT level, green for easy to red for hard."
        checked={color}
        onChange={setColor}
      />
      <ToggleRow
        id="listening-mode"
        title="Listening mode"
        hint="Blur the subtitles; hover or press H to peek."
        checked={listening}
        onChange={setListening}
      />
    </Card>
  );
};

/* ── Menu summaries ─────────────────────────────────────────── */

const actionLabel = (value: TTokenAction) => TOKEN_ACTIONS.find((a) => a.value === value)?.label ?? value;

type DictSummary = { state?: string } | null;

function useSummaries(): Partial<Record<PanelId, string>> {
  const [hover] = usePersistedSetting<TTokenAction>(HOVER_ACTION_SETTING, DEFAULT_HOVER_ACTION, isTokenAction);
  const [click] = usePersistedSetting<TTokenAction>(CLICK_ACTION_SETTING, DEFAULT_CLICK_ACTION, isTokenAction);
  const [secondary] = usePersistedSetting<TSecondarySubs>(SECONDARY_SUBS_SETTING, DEFAULT_SECONDARY_SUBS, isSecondarySubs);
  const [mouseMiddle] = usePersistedSetting<TMouseAction>(MOUSE_BUTTONS[0].setting, DEFAULT_MOUSE_ACTION, isMouseAction);
  const [mouseBack] = usePersistedSetting<TMouseAction>(MOUSE_BUTTONS[1].setting, DEFAULT_MOUSE_ACTION, isMouseAction);
  const [mouseForward] = usePersistedSetting<TMouseAction>(MOUSE_BUTTONS[2].setting, DEFAULT_MOUSE_ACTION, isMouseAction);
  const [richCards] = usePersistedSetting<boolean>(ANKI_RICH_CARDS_SETTING, DEFAULT_ANKI_RICH_CARDS, isBool);
  const [deck] = usePersistedSetting<string>(ANKI_DECK_SETTING, DEFAULT_ANKI_DECK, isString);
  const [knownWords] = usePersistedSetting<string[]>(KNOWN_WORDS_SETTING, [], isStringArray);
  const [statuses] = usePersistedSetting<Record<string, string>>(WORD_STATUSES_SETTING, {}, isStringRecord);
  const [dictUrl] = useRawStringSetting("himotokiDictUrl");
  const [convexUrl] = useRawStringSetting("himotokiConvexUrl");
  const [clientId] = useRawStringSetting("himotokiGoogleClientId");
  const [dict, setDict] = useState<DictSummary>(null);

  useEffect(() => {
    void chrome.runtime
      .sendMessage({ type: "himotokiDictStatus" })
      .then((resp) => setDict(resp?.ok ? resp.data : { state: "error" }))
      .catch(() => setDict({ state: "error" }));
  }, []);

  const mouseSet = [mouseMiddle, mouseBack, mouseForward]
    .map((action, i) => ({ action, label: MOUSE_BUTTONS[i]!.label }))
    .filter((b) => b.action !== "none");
  const known = countKnown(knownWords, statuses);
  const dictState = dict?.state;

  return {
    words: `Hover: ${actionLabel(hover)} · Click: ${actionLabel(click)}`,
    subtitles: `Second line: ${SECONDARY_SUBS_OPTIONS.find((o) => o.value === secondary)?.label ?? secondary}`,
    mouse:
      mouseSet.length === 0
        ? "Off"
        : mouseSet.length === 1
          ? `${mouseSet[0]!.label}: ${MOUSE_ACTIONS.find((a) => a.value === mouseSet[0]!.action)?.label}`
          : `${mouseSet.length} buttons set`,
    anki: `${richCards ? "Rich" : "Plain"} cards · ${deck || DEFAULT_ANKI_DECK}`,
    dictionary:
      dictState === "ready"
        ? "Installed"
        : dictState === "downloading" || dictState === "importing" || dictState === "booting"
          ? "Installing…"
          : dictState
            ? "Not downloaded"
            : undefined,
    data: known ? `${known.toLocaleString()} known word${known === 1 ? "" : "s"}` : "Known words, history and export",
    advanced: dictUrl || convexUrl || clientId ? "Custom endpoints" : "Default endpoints",
  };
}

/* ── Page ───────────────────────────────────────────────────── */

const MENU: PanelId[] = ["words", "subtitles", "mouse", "anki", "dictionary", "data", "advanced", "about"];

const Options: FC = () => {
  const [panel, openPanel] = usePanelParam(isPanelId);
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchSettings(query), [query]);
  const summaries = useSummaries();

  const go = (entry: SearchEntry) => {
    setQuery("");
    if (entry.panel) openPanel(entry.panel);
    reveal(entry.focus);
  };

  if (panel) {
    const meta = PANELS[panel];
    return (
      <main className="page">
        <button type="button" className="back" onClick={() => openPanel(null)}>
          <Icon name="back" size={18} />
          Settings
        </button>
        <header className="panel-head">
          <TintedIcon name={meta.icon} tint={meta.tint} />
          <div>
            <h1 id="panel-title">{meta.title}</h1>
            <p className="lede">{meta.lede}</p>
          </div>
        </header>
        <meta.View />
      </main>
    );
  }

  return (
    <main className="page">
      <header className="brand">
        <h1>
          Himotoki Sub <span>Settings</span>
        </h1>
      </header>
      <SearchField value={query} onChange={setQuery} />

      {query.trim() ? (
        results.length ? (
          <div className="card menu">
            {results.map((e) => {
              const where = e.panel ? PANELS[e.panel] : null;
              return (
                <MenuRow
                  key={e.title}
                  icon={where?.icon ?? "pulse"}
                  tint={where?.tint ?? "violet"}
                  title={e.title}
                  summary={where?.title ?? (e.focus === "profile" ? "Account" : "Look & feel")}
                  onClick={() => go(e)}
                />
              );
            })}
          </div>
        ) : (
          <p className="empty">No settings match “{query.trim()}”.</p>
        )
      ) : (
        <>
          <ProfileCard />
          <LookAndFeel />
          <nav className="card menu" aria-label="More settings">
            {MENU.map((id) => (
              <MenuRow
                key={id}
                icon={PANELS[id].icon}
                tint={PANELS[id].tint}
                title={PANELS[id].title}
                summary={summaries[id]}
                onClick={() => openPanel(id)}
              />
            ))}
          </nav>
        </>
      )}
    </main>
  );
};

export default Options;
