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

const KANJI_RE = /[一-鿿々〆ヶ]/;
const NON_KANA_RE = /[^぀-ヿ゠-ヿ・ー\s、。！？!?,.]/u;

/** Katakana → hiragana so a katakana surface and its hiragana reading compare equal. */
const toHiragana = (text: string): string =>
  text.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));

/** Only the (normalised) kana of a string, dropping kanji, spaces and punctuation. */
const kanaOnly = (text: string): string => {
  const out: string[] = [];
  for (const ch of toHiragana(text)) if (ch >= "ぁ" && ch <= "ゖ") out.push(ch);
  return out.join("");
};

/** Is `sub` a subsequence of `full` (same order, gaps allowed)? */
const isSubsequence = (sub: string, full: string): boolean => {
  let i = 0;
  for (let j = 0; j < full.length && i < sub.length; j++) if (full[j] === sub[i]) i++;
  return i === sub.length;
};

/**
 * A genuine reading line reproduces the original line with every kanji replaced by its kana reading,
 * so the kanji line's own kana must appear, in order, within the reading line, and the reading line
 * must add kana (the kanji readings) on top. This rejects unrelated two-line dialogue that merely
 * happens to have a kana-only second line.
 *
 * A kanji line with no kana of its own (何？) gives no such evidence: any kana line would pass, so a
 * second speaker (何？\nはい。) would be hidden. Such a line counts only with `trustKanjiOnly` (the
 * track has verified reading lines elsewhere), and then still needs at least one kana per kanji.
 */
const isPlausibleReadingOf = (kanjiLine: string, kanaLine: string, trustKanjiOnly: boolean): boolean => {
  const bodyKana = kanaOnly(kanjiLine);
  const readingKana = kanaOnly(kanaLine);
  if (!bodyKana) {
    const kanjiCount = [...kanjiLine].filter((ch) => KANJI_RE.test(ch)).length;
    return trustKanjiOnly && readingKana.length >= kanjiCount;
  }
  if (readingKana.length <= bodyKana.length) return false;
  return isSubsequence(bodyKana, readingKana);
};

/**
 * Some learning channels print a kana reading line under the kanji line, e.g.
 *   皆さんは朝起きたら何をしますか\nみなさん あさおきたら なにをしますか
 * Detect that: exactly two newline-separated groups, the first containing kanji and the second
 * being all kana that is a plausible reading of the first (`isPlausibleReadingOf`). Returns the
 * kanji body and the kana line separately so the reading line never reaches the segmenter and can
 * be hidden or shown per the readingLine setting.
 */
export const splitReadingLine = (
  cleaned: string,
  trustKanjiOnly = false,
): { body: string; readingLine: string | null } => {
  const lines = cleaned.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length !== 2) return { body: cleaned, readingLine: null };
  const [first, second] = lines as [string, string];
  const secondIsKana = !NON_KANA_RE.test(second) && /[぀-ヿ]/.test(second);
  if (KANJI_RE.test(first) && secondIsKana && isPlausibleReadingOf(first, second, trustKanjiOnly)) {
    return { body: first, readingLine: second };
  }
  return { body: cleaned, readingLine: null };
};

/**
 * `splitReadingLine` for a whole track: kanji-only lines are trusted to carry a reading line only
 * when another cue of the same track has a verified one (a reading-line channel).
 */
export const splitReadingLines = (cleaned: string[]): Array<{ body: string; readingLine: string | null }> => {
  const verified = cleaned.map((text) => splitReadingLine(text));
  if (!verified.some((split) => split.readingLine)) return verified;
  return cleaned.map((text, i) => (verified[i]!.readingLine ? verified[i]! : splitReadingLine(text, true)));
};

type Chunk = { kind: "text"; text: string } | { kind: "space" } | { kind: "newline" };

/**
 * Split a cue into text runs, spaces (ASCII or ideographic U+3000) and line breaks.
 * Only text runs are segmented; whitespace never reaches the model, so it cannot be glued to a token.
 */
export const chunkCue = (cleaned: string): Chunk[] => {
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

const buildSub = (
  sub: Captions[number],
  index: number,
  body: string,
  items: TSubItem[],
  analyzed: boolean,
  readingLine: string | null,
): TSub => ({
  id: index,
  start: Number(sub.start),
  end: Number(sub.end),
  text: sub.text,
  cleanedText: body.replace(/\n+/g, " "),
  items,
  analyzed,
  readingLine: readingLine ?? undefined,
});

/**
 * Captions that arrive one cue at a time are converted again as the list grows. A cue already
 * converted (same start, text and reading-line split) keeps its items, so only new or revised cues
 * are segmented and analysed.
 */
const reusableItems = (previous: TSub[]) => {
  const byCue = new Map(previous.map((sub) => [`${sub.start}\u0000${sub.text}`, sub]));
  return (sub: Captions[number], body: string, readingLine: string | null): TSub | undefined => {
    const prior = byCue.get(`${Number(sub.start)}\u0000${sub.text}`);
    if (!prior || prior.cleanedText !== body.replace(/\n+/g, " ") || (prior.readingLine ?? null) !== readingLine) return;
    return prior;
  };
};

/**
 * Sync immediate paint (Intl.Segmenter). Also the fallback if the ONNX split fails. Cues already
 * converted in `previous` keep their items, analysed or not.
 */
export const convertJapaneseSubsFallback = (rawSubs: Captions, previous: TSub[] = []): TSub[] => {
  const split = splitReadingLines(rawSubs.map((sub) => cleanCueText(sub.text)));
  const reuse = reusableItems(previous);
  return rawSubs.map((sub, index) => {
    const { body, readingLine } = split[index]!;
    const prior = reuse(sub, body, readingLine);
    if (prior) return buildSub(sub, index, body, prior.items, Boolean(prior.analyzed), readingLine);
    const items = chunksToItems(chunkCue(body), intlSegments);
    return buildSub(sub, index, body, items, false, readingLine);
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

/**
 * Pre-segment the cues via the in-extension ONNX split (offscreen document). Cues already analysed
 * in `previous` are reused, so incremental captions analyse each new cue once.
 */
export const convertJapaneseSubsWithLocalSplit = async (rawSubs: Captions, previous: TSub[] = []): Promise<TSub[]> => {
  const fallback = convertJapaneseSubsFallback(rawSubs, previous);
  const split = splitReadingLines(rawSubs.map((sub) => cleanCueText(sub.text)));
  const perCue = split.map((s) => chunkCue(s.body));
  // Repeated captions/text runs need only one inference and dictionary repair per
  // batch. Keep timing and layout per cue, and avoid a long-lived dictionary cache.
  const texts: string[] = [];
  const textIndexes = new Map<string, number>();
  perCue.forEach((chunks, index) => {
    if (fallback[index]!.analyzed) return;
    for (const chunk of chunks) {
      if (chunk.kind === "text" && !textIndexes.has(chunk.text)) {
        textIndexes.set(chunk.text, texts.length);
        texts.push(chunk.text);
      }
    }
  });
  if (!texts.length) return fallback;

  try {
    const splitResults = await splitTextsViaExtension(texts);
    if (!splitResults || splitResults.length !== texts.length) {
      return fallback;
    }
    const results = await repairSegmentsViaDictionary(splitResults.map((r) => r.segments ?? []));

    return rawSubs.map((sub, index) => {
      if (fallback[index]!.analyzed) return fallback[index]!;
      const items = chunksToItems(perCue[index]!, (text) => results[textIndexes.get(text)!]!);
      if (!items.some((item) => item.type === "word")) return fallback[index]!;
      return buildSub(sub, index, split[index]!.body, items, true, split[index]!.readingLine);
    });
  } catch (error) {
    console.warn("[himotoki] local split error, using Segmenter fallback", error);
    return fallback;
  }
};
