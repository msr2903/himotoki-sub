/** Browser Himotoki split — default ONNX only (no domain router). */

import { getDefaultModel, resetModelCache as resetSingleModelCache } from "./model";
import { normalizeSegments } from "./postprocess";
import { segmentsToBio } from "./labels";

export type SplitResult = {
  text: string;
  segments: string[];
  confidence: number;
  source: "model" | "passthrough";
  labels: number[];
};

export function resetModelCache(): void {
  resetSingleModelCache();
}

export async function split(text: string): Promise<SplitResult> {
  if (!text) {
    return { text, segments: [], confidence: 1, source: "passthrough", labels: [] };
  }

  const model = await getDefaultModel();
  const pred = await model.predict(text);
  const segments = normalizeSegments(text, pred.segments);
  let labels = pred.labels;
  try {
    labels = segmentsToBio(text, segments);
  } catch {
    // keep original labels if postprocess changed lengths oddly
  }

  return {
    text,
    segments,
    confidence: pred.confidence,
    source: "model",
    labels,
  };
}

export async function splitAvailable(): Promise<boolean> {
  try {
    await getDefaultModel();
    return true;
  } catch {
    return false;
  }
}
