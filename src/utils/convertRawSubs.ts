import { Captions, TSub, TSubItem } from "@src/models/types";
import { isPunctuationSurface } from "./himotokiTypes";
import type { SplitResult } from "@src/split";

/** Strip caption markup but keep line breaks (YouTube puts a kana reading line under the kanji line). */
const cleanCueText = (text: string): string => {
  const tmpDiv = document.createElement("div");
  tmpDiv.innerHTML = text
    .replace(/<\d+:\d+:\d+.\d+><c>/g, "")
    .replace(/<\/c>/g, "")
    .replace(/<br\s*\/?>/gi, "\n");
  return (tmpDiv.textContent || "").replace(/\r\n?/g, "\n");
};

type Chunk = { kind: "text"; text: string } | { kind: "space" } | { kind: "newline" };

/**
 * Split a cue into text runs, spaces (ASCII or ideographic U+3000) and line breaks.
 * Only text runs are segmented; whitespace never reaches the model, so it cannot be glued to a token.
 */
const chunkCue = (cleaned: string): Chunk[] => {
  const chunks: Chunk[] = [];
  const re = /(\n+)|([ \t　]+)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cleaned))) {
    if (match.index > last) chunks.push({ kind: "text", text: cleaned.slice(last, match.index) });
    chunks.push(match[1] ? { kind: "newline" } : { kind: "space" });
    last = re.lastIndex;
  }
  if (last < cleaned.length) chunks.push({ kind: "text", text: cleaned.slice(last) });
  while (chunks.length && chunks[0]!.kind !== "text") chunks.shift();
  while (chunks.length && chunks[chunks.length - 1]!.kind !== "text") chunks.pop();
  return chunks;
};

const SPACE_ITEM: TSubItem = { text: " ", cleanedText: "", type: "space", tag: "span" };
const NEWLINE_ITEM: TSubItem = { text: "\n", cleanedText: "", type: "newline", tag: "span" };

const surfaceToItem = (surface: string): TSubItem => {
  const punctuation = isPunctuationSurface(surface);
  return {
    text: surface,
    cleanedText: surface,
    type: punctuation ? "punctuation" : "word",
    tag: "span",
  };
};

const segmentsToItems = (segments: string[]): TSubItem[] =>
  segments.filter((s) => s.trim().length > 0).map(surfaceToItem);

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("ja", { granularity: "word" })
    : null;

const intlSegments = (text: string): string[] =>
  segmenter
    ? Array.from(segmenter.segment(text))
        .map((seg) => seg.segment)
        .filter((seg) => seg.trim().length > 0)
    : [text];

const chunksToItems = (chunks: Chunk[], segmentText: (text: string) => string[]): TSubItem[] => {
  const items: TSubItem[] = [];
  for (const chunk of chunks) {
    if (chunk.kind === "newline") items.push(NEWLINE_ITEM);
    else if (chunk.kind === "space") items.push(SPACE_ITEM);
    else {
      const segItems = segmentsToItems(segmentText(chunk.text));
      items.push(...(segItems.length ? segItems : [surfaceToItem(chunk.text)]));
    }
  }
  return items;
};

const buildSub = (sub: Captions[number], index: number, cleaned: string, items: TSubItem[], analyzed: boolean): TSub => ({
  id: index,
  start: Number(sub.start),
  end: Number(sub.end),
  text: sub.text,
  cleanedText: cleaned.replace(/\n+/g, " "),
  items,
  analyzed,
});

/** Sync immediate paint (Intl.Segmenter). Also the fallback if the ONNX split fails. */
export const convertJapaneseSubsFallback = (rawSubs: Captions): TSub[] => {
  return rawSubs.map((sub, index) => {
    const cleaned = cleanCueText(sub.text);
    const items = chunksToItems(chunkCue(cleaned), intlSegments);
    return buildSub(sub, index, cleaned, items, false);
  });
};

async function splitTextsViaExtension(texts: string[]): Promise<SplitResult[] | null> {
  const resp = await chrome.runtime.sendMessage({
    type: "himotokiSplitBatch",
    texts,
  });
  if (!resp?.ok || !Array.isArray(resp.data)) {
    console.warn("[himotoki] local split failed", resp?.error || resp);
    return null;
  }
  console.info("[himotoki] local ONNX split ok", { runs: texts.length });
  return resp.data as SplitResult[];
}

/**
 * Dictionary-aware repair of model output (merge adjacent segments that form a headword, peel
 * over-merged compounds). No-op when the offline dictionary is not installed.
 */
async function repairSegmentsViaDictionary(runs: string[][]): Promise<string[][]> {
  try {
    const resp = await chrome.runtime.sendMessage({ type: "himotokiRepairSegments", cues: runs });
    const data = resp?.data as { available?: boolean; cues?: string[][] } | undefined;
    if (!resp?.ok || !data?.available || !Array.isArray(data.cues) || data.cues.length !== runs.length) {
      return runs;
    }
    // Never accept a repair that changes the text itself.
    return data.cues.map((segs, i) => (segs.join("") === runs[i]!.join("") ? segs : runs[i]!));
  } catch {
    return runs;
  }
}

/** Pre-segment all cues via the in-extension ONNX split (offscreen document). */
export const convertJapaneseSubsWithLocalSplit = async (rawSubs: Captions): Promise<TSub[]> => {
  const fallback = convertJapaneseSubsFallback(rawSubs);
  const cleaned = rawSubs.map((sub) => cleanCueText(sub.text));
  const perCue = cleaned.map(chunkCue);
  const texts: string[] = [];
  for (const chunks of perCue) {
    for (const chunk of chunks) if (chunk.kind === "text") texts.push(chunk.text);
  }
  if (!texts.length) return fallback;

  try {
    const splitResults = await splitTextsViaExtension(texts);
    if (!splitResults || splitResults.length !== texts.length) {
      return fallback;
    }
    const results = await repairSegmentsViaDictionary(splitResults.map((r) => r.segments ?? []));

    let cursor = 0;
    return rawSubs.map((sub, index) => {
      const items = chunksToItems(perCue[index]!, () => results[cursor++]!);
      if (!items.some((item) => item.type === "word")) return fallback[index]!;
      return buildSub(sub, index, cleaned[index]!, items, true);
    });
  } catch (error) {
    console.warn("[himotoki] local split error, using Segmenter fallback", error);
    return fallback;
  }
};
