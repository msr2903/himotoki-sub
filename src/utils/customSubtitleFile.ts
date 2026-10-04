import { parse } from "subtitle";
import type { Captions } from "@src/models/types";

export type TSubtitleFile = { cues: Captions } | { error: string };

const usable = (cue: Partial<Captions[number]>): cue is Captions[number] =>
  typeof cue.text === "string" &&
  cue.text.trim() !== "" &&
  typeof cue.start === "number" &&
  typeof cue.end === "number" &&
  Number.isFinite(cue.start) &&
  Number.isFinite(cue.end) &&
  cue.start >= 0 &&
  cue.start < cue.end;

/**
 * Parse an uploaded SRT/WebVTT file into cues that can be shown: text with finite, ordered times
 * (#156). An empty or non-subtitle file is an error rather than an empty track, so the caller keeps
 * the working track; the parser reports a timestamp-free text file as one blank cue.
 */
export function parseSubtitleFile(text: string, name: string): TSubtitleFile {
  let parsed: Array<Partial<Captions[number]>>;
  try {
    parsed = parse(text);
  } catch {
    parsed = [];
  }
  const cues = parsed.filter(usable).sort((a, b) => Number(a.start) - Number(b.start));
  if (!cues.length) return { error: `"${name}" has no subtitles that can be shown. Choose an SRT or WebVTT file.` };
  return { cues };
}

export const STALE = Symbol("stale");

/**
 * Only the newest of overlapping async reads delivers its result (#145): selecting another file,
 * or `cancel()` on unmount, makes every earlier read resolve to STALE, failures included.
 */
export function latestOnly() {
  let generation = 0;
  return {
    async run<T>(work: Promise<T>): Promise<T | typeof STALE> {
      const mine = ++generation;
      try {
        const value = await work;
        return mine === generation ? value : STALE;
      } catch (error) {
        if (mine !== generation) return STALE;
        throw error;
      }
    },
    cancel() {
      generation++;
    },
  };
}
