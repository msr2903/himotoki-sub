export type TAditionalData = {
  context?: string;
  partOfSpeech?: string;
  contextSentence?: string;
  sourceUrl?: string;
  videoTitle?: string;
  timestampMs?: number;
  himotokiSave?: {
    source: string;
    seq: string | number;
    headword: string;
    reading?: string;
    gloss?: string;
  };
};

interface ILearningService {
  color: string;
  addWord: (word: string, translation: string, aditionalData: TAditionalData) => Promise<string>;
}

export default ILearningService;
