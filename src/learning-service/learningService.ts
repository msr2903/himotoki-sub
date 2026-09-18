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
  /** All senses/meanings of the entry, for a numbered list on the rich Anki card. */
  meanings?: string[];
  /** When false, Anki omits the sentence/screenshot/audio and builds a minimal card. */
  richCards?: boolean;
  /** Anki card theme: "auto" follows Anki night mode; "light"/"dark" force it. */
  cardTheme?: "auto" | "light" | "dark";
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
