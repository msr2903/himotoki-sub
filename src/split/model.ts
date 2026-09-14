/** ONNX char-BiLSTM boundary tagger (+ optional CRF Viterbi). Browser / onnxruntime-web. */

import * as ort from "onnxruntime-web";
import { LABEL_B, LABEL_I, bioToSegments } from "./labels";
import { loadCrfParamsFromBytes, type CrfParams } from "./crf";

export const VOCAB_SIZE = 8192;

export function charId(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  return (code % (VOCAB_SIZE - 2)) + 2;
}

export function encodeText(text: string): BigInt64Array {
  const chars = [...text];
  const ids = new BigInt64Array(chars.length);
  for (let i = 0; i < chars.length; i++) {
    ids[i] = BigInt(charId(chars[i]!));
  }
  return ids;
}

export type NeuralPredictResult = {
  segments: string[];
  labels: number[];
  confidence: number;
};

function viterbiDecode(
  emissions: Float32Array,
  seqLen: number,
  numTags: number,
  crf: CrfParams,
): number[] {
  if (seqLen === 0) return [];
  const dp = new Float32Array(seqLen * numTags).fill(-1e9);
  const bp = new Int8Array(seqLen * numTags);
  const { transitions, start, end } = crf;

  for (let t = 0; t < numTags; t++) {
    dp[t] = start[t]! + emissions[t]!;
  }
  dp[LABEL_I] = -1e9;

  for (let i = 1; i < seqLen; i++) {
    for (let cur = 0; cur < numTags; cur++) {
      let best = -Infinity;
      let bestPrev = 0;
      for (let prev = 0; prev < numTags; prev++) {
        const score =
          dp[(i - 1) * numTags + prev]! +
          transitions[prev * numTags + cur]! +
          emissions[i * numTags + cur]!;
        if (score > best) {
          best = score;
          bestPrev = prev;
        }
      }
      bp[i * numTags + cur] = bestPrev;
      dp[i * numTags + cur] = best;
    }
  }

  for (let t = 0; t < numTags; t++) {
    dp[(seqLen - 1) * numTags + t]! += end[t]!;
  }

  const labels = new Array<number>(seqLen).fill(0);
  let bestLast = 0;
  let bestScore = -Infinity;
  for (let t = 0; t < numTags; t++) {
    const s = dp[(seqLen - 1) * numTags + t]!;
    if (s > bestScore) {
      bestScore = s;
      bestLast = t;
    }
  }
  labels[seqLen - 1] = bestLast;
  for (let i = seqLen - 2; i >= 0; i--) {
    labels[i] = bp[(i + 1) * numTags + labels[i + 1]!]!;
  }
  labels[0] = LABEL_B;
  return labels;
}

function greedyDecode(pB: Float32Array): number[] {
  const labels: number[] = [];
  for (let i = 0; i < pB.length; i++) {
    labels.push(i === 0 || pB[i]! >= 0.5 ? LABEL_B : LABEL_I);
  }
  if (labels.length) labels[0] = LABEL_B;
  return labels;
}

function softmaxRow(logits: Float32Array, row: number, numTags: number): Float32Array {
  const out = new Float32Array(numTags);
  let max = -Infinity;
  for (let t = 0; t < numTags; t++) {
    max = Math.max(max, logits[row * numTags + t]!);
  }
  let sum = 0;
  for (let t = 0; t < numTags; t++) {
    const v = Math.exp(logits[row * numTags + t]! - max);
    out[t] = v;
    sum += v;
  }
  for (let t = 0; t < numTags; t++) out[t]! /= sum;
  return out;
}

function configureOrtWasm(): void {
  try {
    ort.env.wasm.numThreads = 1;
    // onnxruntime-web (bundled) loads *.jsep.* under this prefix.
    ort.env.wasm.wasmPaths = chrome.runtime.getURL("ort/");
  } catch {
    // Non-extension contexts (tests) may lack chrome.runtime.
  }
}

export class OnnxBoundaryModel {
  private constructor(
    private session: ort.InferenceSession,
    private inputName: string,
    private crf: CrfParams | null,
  ) {}

  static async loadFromUrls(
    modelUrl: string,
    crfUrl?: string,
  ): Promise<OnnxBoundaryModel> {
    configureOrtWasm();
    const modelRes = await fetch(modelUrl);
    if (!modelRes.ok) throw new Error(`Failed to fetch ONNX model (${modelRes.status})`);
    const modelBytes = new Uint8Array(await modelRes.arrayBuffer());

    const session = await ort.InferenceSession.create(modelBytes, {
      executionProviders: ["wasm"],
    });
    const inputName = session.inputNames[0];
    if (!inputName) throw new Error("ONNX model has no inputs");

    let crf: CrfParams | null = null;
    if (crfUrl) {
      try {
        const crfRes = await fetch(crfUrl);
        if (crfRes.ok) {
          crf = loadCrfParamsFromBytes(new Uint8Array(await crfRes.arrayBuffer()));
        }
      } catch {
        crf = null;
      }
    }

    return new OnnxBoundaryModel(session, inputName, crf);
  }

  async predict(text: string): Promise<NeuralPredictResult> {
    if (!text) return { segments: [], labels: [], confidence: 1 };
    const chars = [...text];
    const ids = encodeText(text);
    const tensor = new ort.Tensor("int64", ids, [1, ids.length]);
    const outputs = await this.session.run({ [this.inputName]: tensor });
    const outName = this.session.outputNames[0];
    if (!outName) throw new Error("ONNX model has no outputs");
    const logitsTensor = outputs[outName]!;
    const logitsData = logitsTensor.data as Float32Array | Float64Array | BigInt64Array;
    const numTags = 2;
    const seqLen = chars.length;
    const logits = new Float32Array(seqLen * numTags);
    for (let i = 0; i < seqLen * numTags; i++) {
      logits[i] = Number(logitsData[i]);
    }

    const pB = new Float32Array(seqLen);
    for (let i = 0; i < seqLen; i++) {
      pB[i] = softmaxRow(logits, i, numTags)[LABEL_B]!;
    }

    const labels = this.crf
      ? viterbiDecode(logits, seqLen, numTags, this.crf)
      : greedyDecode(pB);

    let confSum = 0;
    for (let i = 0; i < seqLen; i++) {
      confSum += labels[i] === LABEL_B ? pB[i]! : 1 - pB[i]!;
    }
    return {
      segments: bioToSegments(text, labels),
      labels,
      confidence: confSum / seqLen,
    };
  }
}

let cached: OnnxBoundaryModel | null = null;

export async function getDefaultModel(): Promise<OnnxBoundaryModel> {
  if (!cached) {
    const modelUrl = chrome.runtime.getURL("models/default.onnx");
    const crfUrl = chrome.runtime.getURL("models/default.onnx.crf.npz");
    cached = await OnnxBoundaryModel.loadFromUrls(modelUrl, crfUrl);
  }
  return cached;
}

export function resetModelCache(): void {
  cached = null;
}
