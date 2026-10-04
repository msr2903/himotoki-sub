import type { Captions } from "@src/models/types";

/** Text of a caption node: text nodes as-is, `<br>` as a line break. */
export function getCaptionText(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeName === "BR") return "\n";
  return [...node.childNodes].map(getCaptionText).join("");
}

/** True when `b` follows `a` among the same parent's children with no line break between them. */
const sameLine = (a: Node, b: Node): boolean => {
  for (let node = a.nextSibling; node; node = node.nextSibling) {
    if (node === b) return true;
    if (node.nodeName === "BR" || (node.textContent ?? "").includes("\n")) return false;
  }
  return false;
};

/**
 * Text of the caption parts matching `selector` inside `source`, one line per part. A part nested
 * in another matching part is already part of that part's text, so only the outermost matches are
 * read (styled spans inside styled spans would otherwise repeat the line). With `runs`, the parts
 * are styled runs: consecutive siblings with no line break between them form one line.
 */
export function readCaptionParts(source: ParentNode, selector: string, { runs = false } = {}): string {
  const parts = [...source.querySelectorAll(selector)];
  const outermost = parts.filter((part) => !parts.some((other) => other !== part && other.contains(part)));
  const lines: string[] = [];
  outermost.forEach((part, i) => {
    const text = getCaptionText(part);
    if (runs && i > 0 && sameLine(outermost[i - 1]!, part)) lines[lines.length - 1] += text;
    else lines.push(text);
  });
  return lines.join("\n");
}

type CaptionSourceWatch = {
  source: Node;
  /** The caption currently rendered in `source`. */
  read: () => string;
  /** Media time in seconds, read when the caption changes. */
  currentTime: () => number;
  emit: (captions: Captions) => void;
};

/**
 * Publish the caption rendered in `source` now and on every change, until the returned function is
 * called. Character updates count as changes (some renderers rewrite an existing text node), and an
 * unchanged caption is not published again. A cleared caption is published as an empty, zero-length
 * cue so the previous cue ends there. Calls after disposal are ignored.
 */
export function watchCaptionSource({ source, read, currentTime, emit }: CaptionSourceWatch): () => void {
  let active = true;
  let last = "";
  const publish = () => {
    if (!active) return;
    const text = read().trim();
    if (text === last) return;
    last = text;
    const start = currentTime();
    emit([{ start: start * 1000, end: text ? (start + 100) * 1000 : start * 1000, text }]);
  };
  const observer = new MutationObserver(publish);
  observer.observe(source, { childList: true, subtree: true, characterData: true });
  // A caption already on screen (e.g. a paused video) produces no mutation of its own.
  publish();
  return () => {
    active = false;
    observer.disconnect();
  };
}

/**
 * Poll every 300 ms until `selector` matches, then call `callBack` with the element. Polling stops
 * without calling back once `isCurrent` returns false.
 */
export function waitForElement(
  selector: string,
  callBack: (element: Element) => void,
  isCurrent: () => boolean = () => true,
  accept: (element: Element) => boolean = () => true,
): void {
  window.setTimeout(() => {
    if (!isCurrent()) return;
    const element = document.querySelector(selector);
    if (element && accept(element)) callBack(element);
    else waitForElement(selector, callBack, isCurrent, accept);
  }, 300);
}
