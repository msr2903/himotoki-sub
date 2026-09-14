/** BIO label helpers for character-level word boundaries (codepoints). */

export const LABEL_B = 0;
export const LABEL_I = 1;

export function segmentsToBio(text: string, segments: string[]): number[] {
  const joined = segments.join("");
  if (joined !== text) {
    throw new Error(
      `segments do not match text: ${JSON.stringify(joined)} != ${JSON.stringify(text)}`,
    );
  }
  const labels: number[] = [];
  for (const seg of segments) {
    if (!seg) throw new Error("empty segment is not allowed");
    const chars = [...seg];
    labels.push(LABEL_B);
    for (let i = 1; i < chars.length; i++) labels.push(LABEL_I);
  }
  if (labels.length !== [...text].length) {
    throw new Error("label length mismatch");
  }
  return labels;
}

export function bioToSegments(text: string, labels: number[]): string[] {
  const chars = [...text];
  if (chars.length !== labels.length) {
    throw new Error("text/label length mismatch");
  }
  if (!chars.length) return [];
  const segments: string[] = [];
  let start = 0;
  for (let i = 1; i < chars.length; i++) {
    if (labels[i] === LABEL_B) {
      segments.push(chars.slice(start, i).join(""));
      start = i;
    }
  }
  segments.push(chars.slice(start).join(""));
  return segments;
}
