import ILearningService, { TAditionalData } from "./learningService";

export class HimotokiLearningService implements ILearningService {
  public color: string;

  constructor() {
    this.color = "#3dbeb0";
  }

  public async addWord(
    word: string,
    translation: string,
    aditionalData: TAditionalData,
  ): Promise<string> {
    const save = aditionalData.himotokiSave;
    if (!save || save.seq === undefined || save.seq === null) {
      return Promise.reject("No dictionary entry to save. Hover the word again and retry.");
    }

    const resp = await chrome.runtime.sendMessage({
      type: "himotokiAddFavorite",
      favorite: {
        source: save.source || "jitendex",
        seq: save.seq,
        headword: save.headword || word,
        reading: save.reading || "",
        gloss: save.gloss || translation,
        contextSentence: aditionalData.contextSentence || aditionalData.context || "",
        sourceUrl: aditionalData.sourceUrl || "",
        videoTitle: aditionalData.videoTitle || "",
        timestampMs: aditionalData.timestampMs,
      },
    });

    if (!resp?.ok) {
      return Promise.reject(resp?.error || "Failed to save to Himotoki");
    }

    return resp.data?.added === false
      ? "Already in Himotoki favorites"
      : "Saved to Himotoki";
  }
}
