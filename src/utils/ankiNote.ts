/**
 * Pure builder for the AnkiConnect `addNote` params, plus the definition of the custom "Himotoki"
 * note type (fields + card templates + CSS). Kept side-effect free so it can be unit tested; media
 * (screenshot / audio) is stored separately via AnkiConnect `storeMediaFile` and referenced here by
 * filename. The Anki service (src/learning-service/anki.ts) creates/updates the note type before
 * adding cards.
 *
 * The card is styled with Himotoki's look (accent teal, rounded card, display serif headword) and
 * supports light/dark: "auto" follows Anki's night mode; "light"/"dark" force a theme via a class on
 * the card wrapper (the Theme field), winning even against Anki's night mode.
 */
export type TAnkiCardTheme = "auto" | "light" | "dark";

export const HIMOTOKI_MODEL_NAME = "Himotoki";
export const HIMOTOKI_CARD_TEMPLATE_NAME = "Himotoki";
/** Field order for the note type. */
export const HIMOTOKI_FIELDS = ["Word", "Reading", "Sentence", "Meaning", "Level", "Image", "Audio", "Theme"] as const;

export type AnkiNoteInput = {
  deckName: string;
  /** Headword shown large on the card. */
  word: string;
  /** Reading (kana) shown under the headword. */
  reading?: string;
  /** Primary gloss / meaning (used when `meanings` is not provided). */
  gloss: string;
  /** All senses/meanings, rendered as a numbered list on the card. Falls back to `gloss`. */
  meanings?: string[];
  /** Sentence the word appeared in; the keyword is bolded inside it. */
  contextSentence?: string;
  /** Surface to bold inside the context sentence (usually the headword). */
  keyword?: string;
  /** JLPT levels (e.g. ["n5"]). */
  jlpt?: string[];
  /** Stored screenshot filename (from storeMediaFile), referenced as an <img>. */
  imageFilename?: string;
  /** Stored audio filename (from storeMediaFile), referenced as [sound:...]. */
  audioFilename?: string;
  /** Card theme: auto follows Anki night mode; light/dark force it. */
  theme?: TAnkiCardTheme;
  /** Tags attached to the note. Defaults to ["himotoki"]. */
  tags?: string[];
};

export type HimotokiFields = {
  Word: string;
  Reading: string;
  Sentence: string;
  Meaning: string;
  Level: string;
  Image: string;
  Audio: string;
  Theme: string;
};

export type AnkiNote = {
  deckName: string;
  modelName: string;
  fields: HimotokiFields;
  tags: string[];
  options: { allowDuplicate: boolean };
};

const htmlEscape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Escape the sentence, then wrap each occurrence of the keyword in <b>. */
export const boldKeyword = (sentence: string, keyword?: string): string => {
  const escaped = htmlEscape(sentence);
  if (!keyword) return escaped;
  const escapedKeyword = htmlEscape(keyword);
  if (!escapedKeyword) return escaped;
  return escaped.split(escapedKeyword).join(`<b>${escapedKeyword}</b>`);
};

/** Map a theme to the wrapper class used by the card templates ("" = auto). */
export const themeClass = (theme: TAnkiCardTheme = "auto"): string =>
  theme === "light" ? "himotoki--light" : theme === "dark" ? "himotoki--dark" : "";

/** Render the meanings: a numbered list when there is more than one sense, else a single line. Pure. */
export const renderMeaning = (gloss: string, meanings?: string[]): string => {
  const list = (meanings && meanings.length ? meanings : [gloss]).map((m) => m.trim()).filter(Boolean);
  if (list.length <= 1) return htmlEscape(list[0] || "");
  return `<ol class="hm-senses">${list.map((m) => `<li>${htmlEscape(m)}</li>`).join("")}</ol>`;
};

/** Build the fields for a Himotoki note. Pure. */
export const buildHimotokiFields = (input: AnkiNoteInput): HimotokiFields => ({
  Word: htmlEscape(input.word),
  Reading: input.reading ? htmlEscape(input.reading) : "",
  Sentence: input.contextSentence ? boldKeyword(input.contextSentence, input.keyword) : "",
  Meaning: renderMeaning(input.gloss, input.meanings),
  Level: input.jlpt && input.jlpt.length ? input.jlpt.map((j) => htmlEscape(j.toUpperCase())).join(" · ") : "",
  Image: input.imageFilename ? `<img src="${htmlEscape(input.imageFilename)}">` : "",
  Audio: input.audioFilename ? `[sound:${input.audioFilename}]` : "",
  Theme: themeClass(input.theme),
});

export const buildAnkiNote = (input: AnkiNoteInput): AnkiNote => ({
  deckName: input.deckName,
  modelName: HIMOTOKI_MODEL_NAME,
  fields: buildHimotokiFields(input),
  tags: input.tags && input.tags.length ? input.tags : ["himotoki"],
  options: { allowDuplicate: false },
});

/* ---------- Note-type definition (templates + CSS) ---------- */

const CARD_BODY = `
  <div class="himotoki-card {{Theme}}">
    <div class="hm-word">{{Word}}</div>
    {{#Reading}}<div class="hm-reading">{{Reading}}</div>{{/Reading}}`;

export const HIMOTOKI_FRONT_TEMPLATE = `${CARD_BODY}
  </div>`;

export const HIMOTOKI_BACK_TEMPLATE = `${CARD_BODY}
    <div class="hm-divider"></div>
    {{#Sentence}}<div class="hm-sentence">{{Sentence}}</div>{{/Sentence}}
    {{#Meaning}}<div class="hm-meaning">{{Meaning}}</div>{{/Meaning}}
    {{#Level}}<div class="hm-level">{{Level}}</div>{{/Level}}
    {{#Image}}<div class="hm-image">{{Image}}</div>{{/Image}}
    {{#Audio}}<div class="hm-audio">{{Audio}}</div>{{/Audio}}
  </div>`;

export const HIMOTOKI_CARD_CSS = `
.card { background-color: transparent; padding: 14px; }

.himotoki-card {
  --c-ink: #1c1c1a;
  --c-muted: #6b6862;
  --c-bg: #fffdf7;
  --c-raised: #ffffff;
  --c-border: #e7e3d9;
  --c-accent: #2f9d90;
  --c-accent-soft: rgba(47, 157, 144, 0.12);
  max-width: 560px;
  margin: 0 auto;
  padding: 24px 22px 20px;
  text-align: center;
  background: var(--c-bg);
  color: var(--c-ink);
  border: 1px solid var(--c-border);
  border-radius: 16px;
  box-shadow: 0 14px 40px -24px rgba(0, 0, 0, 0.5);
  font-family: "Zen Maru Gothic", "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif;
  line-height: 1.5;
}

.hm-word {
  font-family: "Newsreader", "Zen Maru Gothic", "Hiragino Mincho ProN", Georgia, serif;
  font-size: 42px;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: 0.01em;
}

.hm-reading { margin-top: 3px; font-size: 17px; color: var(--c-muted); }

.hm-divider {
  width: 68%;
  height: 1px;
  margin: 18px auto;
  background: linear-gradient(90deg, transparent, var(--c-accent), transparent);
  opacity: 0.55;
}

.hm-sentence {
  font-size: 19px;
  line-height: 1.75;
  background: var(--c-raised);
  border: 1px solid var(--c-border);
  border-radius: 10px;
  padding: 12px 14px;
  margin: 0 auto 12px;
}
.hm-sentence b { color: var(--c-accent); font-weight: 600; }

.hm-meaning { font-size: 17px; margin: 8px 0; }

.hm-senses {
  display: inline-block;
  text-align: left;
  margin: 4px auto 0;
  padding: 0 0 0 1.5em;
  max-width: 90%;
  font-size: 16px;
  line-height: 1.6;
}
.hm-senses li { margin: 3px 0; }
.hm-senses li::marker { color: var(--c-accent); font-weight: 700; }

.hm-level {
  display: inline-block;
  margin: 6px 0 2px;
  padding: 3px 12px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--c-accent);
  background: var(--c-accent-soft);
  border-radius: 999px;
}

.hm-image { margin-top: 12px; }
.hm-image img { max-width: 100%; border-radius: 10px; border: 1px solid var(--c-border); }

.hm-audio { margin-top: 12px; }

/* Dark: auto (follows Anki night mode) and forced via .himotoki--dark. */
.nightMode .himotoki-card,
.himotoki-card.himotoki--dark {
  --c-ink: #e8e6e1;
  --c-muted: #a3a09a;
  --c-bg: #141413;
  --c-raised: #1c1c1a;
  --c-border: #2e2e2b;
  --c-accent: #3dbeb0;
  --c-accent-soft: rgba(61, 190, 176, 0.16);
}

/* Forced light wins even under Anki night mode. */
.nightMode .himotoki-card.himotoki--light {
  --c-ink: #1c1c1a;
  --c-muted: #6b6862;
  --c-bg: #fffdf7;
  --c-raised: #ffffff;
  --c-border: #e7e3d9;
  --c-accent: #2f9d90;
  --c-accent-soft: rgba(47, 157, 144, 0.12);
}
`;
