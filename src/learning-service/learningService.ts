export type TAnkiMedia = { filename: string; dataBase64: string };

export type TAditionalData = {
  context?: string;
  partOfSpeech?: string;
  contextSentence?: string;
  sourceUrl?: string;
  videoTitle?: string;
  timestampMs?: number;
  /** Reading (kana) of the headword, for the front of a rich Anki card. */
  reading?: string;
  /** JLPT levels, for rich Anki card tags. */
  jlpt?: string[];
  /** When false, Anki builds a plain Front/Back card instead of a rich sentence-mining card. */
  richCards?: boolean;
  /** Video-frame screenshot captured for a rich Anki card (see src/utils/mediaCapture.ts). */
  image?: TAnkiMedia | null;
  /** Cue audio clip captured for a rich Anki card. */
  audio?: TAnkiMedia | null;
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
