import ILearningService, { TAditionalData, TAnkiMedia } from "./learningService";
import {
  HIMOTOKI_CARD_CSS,
  HIMOTOKI_CARD_TEMPLATE_NAME,
  HIMOTOKI_FIELDS,
  HIMOTOKI_FRONT_TEMPLATE,
  HIMOTOKI_BACK_TEMPLATE,
  HIMOTOKI_MODEL_NAME,
  buildAnkiNote,
  pickSentenceKeyword,
  planModelUpdate,
} from "@src/utils/ankiNote";
import { POST_TIMEOUT_MS } from "@src/utils/postJson";

const ANKI_API_VERSION = 6;
const ANKI_DESK = "Himotoki";
const ANKI_URL = "http://localhost:8765";
/** Caller-side backstop in case the background never answers (the background aborts at POST_TIMEOUT_MS). */
const INVOKE_BACKSTOP_MS = POST_TIMEOUT_MS + 3000;

/**
 * True when an AnkiConnect call looks like it failed because Anki/AnkiConnect isn't reachable.
 * The background POST rejects with a network error ("Failed to fetch", etc.) — not the literal
 * "connection error" the old code checked for — and may return no result at all.
 */
export const isAnkiConnectionError = (result: { error?: unknown } | null | undefined): boolean => {
  if (!result) return true;
  const errText = result.error ? String(result.error) : "";
  return /failed to fetch|networkerror|load failed|connection|econnrefused/i.test(errText);
};

/** `ok` with `result`, or a failure with `error` (and `timeout` when no answer arrived in time). */
export type AnkiReply = { ok: boolean; result?: unknown; error?: string; timeout?: boolean };

/**
 * Validate an AnkiConnect v6 envelope (`{ result, error }`). Transport failures from the background
 * arrive as `{ error }` (plus `timeout` when the deadline expired); anything else is malformed. Pure.
 */
export const parseAnkiReply = (raw: unknown): AnkiReply => {
  if (!raw || typeof raw !== "object") return { ok: false, error: "No response from AnkiConnect" };
  const reply = raw as { result?: unknown; error?: unknown; timeout?: unknown };
  if (reply.timeout === true) return { ok: false, error: String(reply.error || "timeout"), timeout: true };
  if (reply.error) return { ok: false, error: String(reply.error) };
  if (!("result" in reply)) return { ok: false, error: "Unexpected response from AnkiConnect" };
  return { ok: true, result: reply.result };
};

/** AnkiConnect's addNote must return the new note's numeric ID; anything else is not a created card. */
export const isNoteId = (result: unknown): result is number =>
  typeof result === "number" && Number.isFinite(result) && result > 0;

const ANKI_TIMEOUT_HINT =
  "Anki did not respond in time. Make sure Anki is open and not showing a dialog, then try again.";

export class Anki implements ILearningService {
  public color: string;

  constructor() {
    this.color = "#0d6efd";
  }

  /** Send one AnkiConnect request through the background; never rejects and never hangs. */
  private async invoke(action: string, params: Record<string, unknown>): Promise<unknown> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const backstop = new Promise<unknown>((resolve) => {
      timer = setTimeout(() => resolve({ error: "No response from the extension background", timeout: true }), INVOKE_BACKSTOP_MS);
    });
    try {
      return await Promise.race([
        chrome.runtime.sendMessage({
          type: "post",
          url: ANKI_URL,
          data: { action, version: ANKI_API_VERSION, params },
          timeoutMs: POST_TIMEOUT_MS,
        }),
        backstop,
      ]);
    } catch (error) {
      // The message port closed (service worker restarted, extension reloaded).
      return { error: error instanceof Error ? error.message : String(error) };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Store a captured media file in Anki's collection; returns its filename, or null on failure. */
  private async storeMedia(media: TAnkiMedia): Promise<string | null> {
    const reply = parseAnkiReply(await this.invoke("storeMediaFile", { filename: media.filename, data: media.dataBase64 }));
    // AnkiConnect returns the (possibly de-duplicated) stored filename; without it the file is not
    // confirmed stored, so the card is built without that media.
    return reply.ok && typeof reply.result === "string" && reply.result ? reply.result : null;
  }

  /**
   * Ensure the custom "Himotoki" note type exists. Creating is required (cards can't be added to a
   * missing note type). An existing one is only updated when it still holds an earlier built-in
   * design (see planModelUpdate), so user edits to its templates or styling are never overwritten.
   * That migration is best-effort so a partial/locked model never blocks saving.
   */
  private async ensureModel(): Promise<void> {
    const names = parseAnkiReply(await this.invoke("modelNames", {}));
    if (!names.ok) throw new Error(names.timeout ? ANKI_TIMEOUT_HINT : names.error);
    if (!Array.isArray(names.result)) throw new Error("could not list Anki note types");
    if (!names.result.includes(HIMOTOKI_MODEL_NAME)) {
      const created = parseAnkiReply(
        await this.invoke("createModel", {
          modelName: HIMOTOKI_MODEL_NAME,
          inOrderFields: [...HIMOTOKI_FIELDS],
          css: HIMOTOKI_CARD_CSS,
          isCloze: false,
          cardTemplates: [{ Name: HIMOTOKI_CARD_TEMPLATE_NAME, Front: HIMOTOKI_FRONT_TEMPLATE, Back: HIMOTOKI_BACK_TEMPLATE }],
        }),
      );
      if (!created.ok) throw new Error(created.timeout ? ANKI_TIMEOUT_HINT : created.error);
      return;
    }
    const templates = parseAnkiReply(await this.invoke("modelTemplates", { modelName: HIMOTOKI_MODEL_NAME }));
    const styling = parseAnkiReply(await this.invoke("modelStyling", { modelName: HIMOTOKI_MODEL_NAME }));
    const plan = planModelUpdate(
      templates.ok ? templates.result : undefined,
      styling.ok ? (styling.result as { css?: unknown } | null)?.css : undefined,
    );
    // Non-fatal: adding the note still works with the existing template.
    if (plan.templates) {
      await this.invoke("updateModelTemplates", {
        model: {
          name: HIMOTOKI_MODEL_NAME,
          templates: { [HIMOTOKI_CARD_TEMPLATE_NAME]: { Front: HIMOTOKI_FRONT_TEMPLATE, Back: HIMOTOKI_BACK_TEMPLATE } },
        },
      });
    }
    if (plan.styling) {
      await this.invoke("updateModelStyling", { model: { name: HIMOTOKI_MODEL_NAME, css: HIMOTOKI_CARD_CSS } });
    }
  }

  public async addWord(word: string, translation: string, aditionalData: TAditionalData): Promise<string> {
    const deck = aditionalData.deckName?.trim() || ANKI_DESK;
    const createDeskRaw = await this.invoke("createDeck", { deck });
    const createDesk = parseAnkiReply(createDeskRaw);

    if (!createDesk.ok && createDesk.timeout) return Promise.reject(ANKI_TIMEOUT_HINT);
    // When Anki (AnkiConnect) is not running the background POST fails with a network error such
    // as "Failed to fetch" (never the literal "connection error"), and may yield no result at all.
    // Detect those and show actionable guidance instead of a raw, confusing error.
    if (isAnkiConnectionError(createDeskRaw as { error?: unknown } | null)) {
      return Promise.reject("Error connecting to Anki. Please make sure Anki is running and AnkiConnect is installed.");
    }
    if (!createDesk.ok) {
      return Promise.reject("Anki Error: " + createDesk.error);
    }

    try {
      await this.ensureModel();
    } catch (error) {
      return Promise.reject("Anki Error: could not set up the Himotoki note type — " + (error instanceof Error ? error.message : String(error)));
    }

    const rich = aditionalData.richCards !== false;

    let imageFilename: string | undefined;
    let audioFilename: string | undefined;
    if (rich && aditionalData.image) {
      imageFilename = (await this.storeMedia(aditionalData.image)) ?? undefined;
    }
    if (rich && aditionalData.audio) {
      audioFilename = (await this.storeMedia(aditionalData.audio)) ?? undefined;
    }

    const headword = aditionalData.himotokiSave?.headword || word;
    const reading = aditionalData.reading || aditionalData.himotokiSave?.reading;
    const contextSentence = rich ? aditionalData.contextSentence || aditionalData.context : undefined;
    const note = buildAnkiNote({
      deckName: deck,
      word: headword,
      reading: rich ? reading : undefined,
      gloss: translation,
      meanings: aditionalData.meanings,
      contextSentence,
      // Bold the form that appears in the subtitle (食べた), not the dictionary form (食べる).
      keyword: pickSentenceKeyword(contextSentence, [aditionalData.surface, word, headword, reading]),
      jlpt: rich ? aditionalData.jlpt : undefined,
      imageFilename,
      audioFilename,
      theme: aditionalData.cardTheme || "auto",
      tags: aditionalData.tags,
    });

    const added = parseAnkiReply(await this.invoke("addNote", { note }));

    if (!added.ok) {
      if (added.error === "cannot create note because it is a duplicate") {
        return Promise.resolve("Word already exists in Anki");
      }
      // The note may have been committed before the response was lost: never resubmit on our own.
      if (added.timeout) {
        return Promise.reject("Anki did not confirm the card in time. It may still have been added — check Anki before saving again.");
      }
      return Promise.reject("Anki Error: " + added.error);
    }
    if (!isNoteId(added.result)) {
      return Promise.reject("Anki did not add the card (no note ID returned). Check the deck and note type in Anki, then try again.");
    }
    const extras = [imageFilename && "screenshot", audioFilename && "audio"].filter(Boolean);
    return Promise.resolve(extras.length ? `Word added to Anki (with ${extras.join(" + ")})` : "Word added to Anki");
  }
}
