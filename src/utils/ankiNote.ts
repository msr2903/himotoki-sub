/**
 * Pure builder for the AnkiConnect `addNote` params. Kept side-effect free so it can be unit tested;
 * media (screenshot / audio) is stored separately via AnkiConnect `storeMediaFile` and referenced
 * here by filename. See src/learning-service/anki.ts for the flow.
 */

export type AnkiNoteInput = {
  deckName: string;
  modelName?: string;
  /** Headword shown on the front of the card. */
  word: string;
  /** Reading (kana) shown under the headword. */
  reading?: string;
  /** Primary gloss / meaning. */
  gloss: string;
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
};

export type AnkiNote = {
  deckName: string;
  modelName: string;
  fields: { Front: string; Back: string };
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

export const buildAnkiNote = (input: AnkiNoteInput): AnkiNote => {
  const front =
    htmlEscape(input.word) +
    (input.reading ? `<div class="himotoki-reading">${htmlEscape(input.reading)}</div>` : "");

  const parts: string[] = [];
  if (input.contextSentence) {
    parts.push(`<div class="himotoki-sentence">${boldKeyword(input.contextSentence, input.keyword)}</div>`);
  }
  parts.push(`<div class="himotoki-gloss">${htmlEscape(input.gloss)}</div>`);
  if (input.jlpt && input.jlpt.length) {
    parts.push(`<div class="himotoki-tags">${input.jlpt.map((j) => htmlEscape(j.toUpperCase())).join(" · ")}</div>`);
  }
  if (input.imageFilename) {
    parts.push(`<div class="himotoki-image"><img src="${htmlEscape(input.imageFilename)}"></div>`);
  }
  if (input.audioFilename) {
    parts.push(`[sound:${input.audioFilename}]`);
  }

  return {
    deckName: input.deckName,
    modelName: input.modelName || "Basic",
    fields: { Front: front, Back: parts.join("\n") },
    tags: ["himotoki"],
    options: { allowDuplicate: false },
  };
};
