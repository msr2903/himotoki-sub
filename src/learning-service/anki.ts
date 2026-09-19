import ILearningService, { TAditionalData, TAnkiMedia } from "./learningService";
import {
  HIMOTOKI_CARD_CSS,
  HIMOTOKI_CARD_TEMPLATE_NAME,
  HIMOTOKI_FIELDS,
  HIMOTOKI_FRONT_TEMPLATE,
  HIMOTOKI_BACK_TEMPLATE,
  HIMOTOKI_MODEL_NAME,
  buildAnkiNote,
} from "@src/utils/ankiNote";

const ANKI_API_VERSION = 6;
const ANKI_DESK = "Himotoki";
const ANKI_URL = "http://localhost:8765";

export class Anki implements ILearningService {
  public color: string;

  constructor() {
    this.color = "#0d6efd";
  }

  private async invoke(action: string, params: Record<string, unknown>) {
    return chrome.runtime.sendMessage({
      type: "post",
      url: ANKI_URL,
      data: { action, version: ANKI_API_VERSION, params },
    });
  }

  /** Store a captured media file in Anki's collection; returns its filename, or null on failure. */
  private async storeMedia(media: TAnkiMedia): Promise<string | null> {
    try {
      const result = await this.invoke("storeMediaFile", { filename: media.filename, data: media.dataBase64 });
      if (result?.error) return null;
      // AnkiConnect returns the (possibly de-duplicated) stored filename.
      return typeof result?.result === "string" ? result.result : media.filename;
    } catch {
      return null;
    }
  }

  /**
   * Ensure the custom "Himotoki" note type exists and its template/CSS are current. Creating is
   * required (cards can't be added to a missing note type); updating an existing one is best-effort so
   * a partial/locked model never blocks saving.
   */
  private async ensureModel(): Promise<void> {
    const names = await this.invoke("modelNames", {});
    const existing: string[] = Array.isArray(names?.result) ? names.result : [];
    if (!existing.includes(HIMOTOKI_MODEL_NAME)) {
      const created = await this.invoke("createModel", {
        modelName: HIMOTOKI_MODEL_NAME,
        inOrderFields: [...HIMOTOKI_FIELDS],
        css: HIMOTOKI_CARD_CSS,
        isCloze: false,
        cardTemplates: [{ Name: HIMOTOKI_CARD_TEMPLATE_NAME, Front: HIMOTOKI_FRONT_TEMPLATE, Back: HIMOTOKI_BACK_TEMPLATE }],
      });
      if (created?.error) throw new Error(created.error);
      return;
    }
    try {
      await this.invoke("updateModelTemplates", {
        model: {
          name: HIMOTOKI_MODEL_NAME,
          templates: { [HIMOTOKI_CARD_TEMPLATE_NAME]: { Front: HIMOTOKI_FRONT_TEMPLATE, Back: HIMOTOKI_BACK_TEMPLATE } },
        },
      });
      await this.invoke("updateModelStyling", { model: { name: HIMOTOKI_MODEL_NAME, css: HIMOTOKI_CARD_CSS } });
    } catch {
      // Non-fatal: adding the note still works with the existing template.
    }
  }

  public async addWord(word: string, translation: string, aditionalData: TAditionalData): Promise<string> {
    const deck = aditionalData.deckName?.trim() || ANKI_DESK;
    const createDeskResult = await this.invoke("createDeck", { deck });

    if (createDeskResult.error === "connection error") {
      return Promise.reject("Error connecting to Anki. Please make sure Anki is running and AnkiConnect is installed.");
    }

    if (createDeskResult.error) {
      return Promise.reject("Anki Error: " + createDeskResult.error);
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
    const note = buildAnkiNote({
      deckName: deck,
      word: headword,
      reading: rich ? aditionalData.reading || aditionalData.himotokiSave?.reading : undefined,
      gloss: translation,
      meanings: aditionalData.meanings,
      contextSentence: rich ? aditionalData.contextSentence || aditionalData.context : undefined,
      keyword: headword,
      jlpt: rich ? aditionalData.jlpt : undefined,
      imageFilename,
      audioFilename,
      theme: aditionalData.cardTheme || "auto",
      tags: aditionalData.tags,
    });

    const addWordResult = await this.invoke("addNote", { note });

    if (addWordResult.error) {
      if (addWordResult.error === "cannot create note because it is a duplicate") {
        return Promise.resolve("Word already exists in Anki");
      }

      return Promise.reject("Anki Error: " + addWordResult.error);
    } else {
      const extras = [imageFilename && "screenshot", audioFilename && "audio"].filter(Boolean);
      return Promise.resolve(extras.length ? `Word added to Anki (with ${extras.join(" + ")})` : "Word added to Anki");
    }
  }
}
