/** Load CRF params from a numpy .npz sidecar (ZIP of .npy arrays). Browser-safe. */

import { unzipSync } from "fflate";

function parseNpy(buf: Uint8Array): Float32Array {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const magicOk =
    buf[0] === 0x93 &&
    buf[1] === 0x4e &&
    buf[2] === 0x55 &&
    buf[3] === 0x4d &&
    buf[4] === 0x50 &&
    buf[5] === 0x59;
  if (!magicOk) {
    throw new Error("invalid npy magic");
  }
  const major = buf[6]!;
  const headerLen = major === 1 ? view.getUint16(8, true) : view.getUint32(8, true);
  const headerOffset = major === 1 ? 10 : 12;
  const headerBytes = buf.subarray(headerOffset, headerOffset + headerLen);
  const header = new TextDecoder("ascii").decode(headerBytes);
  const descrMatch = /'descr':\s*'([^']+)'/.exec(header);
  const shapeMatch = /'shape':\s*\(([^)]*)\)/.exec(header);
  if (!descrMatch || !shapeMatch) throw new Error("cannot parse npy header");
  const descr = descrMatch[1]!;
  const shapeParts = shapeMatch[1]!
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s));
  const count = shapeParts.reduce((a, b) => a * b, 1) || 0;
  const dataOffset = headerOffset + headerLen;
  const data = buf.subarray(dataOffset);

  if (descr === "<f4" || descr === "|f4") {
    return new Float32Array(data.buffer, data.byteOffset, count);
  }
  if (descr === "<f8") {
    const doubles = new Float64Array(data.buffer, data.byteOffset, count);
    return Float32Array.from(doubles);
  }
  throw new Error(`unsupported npy dtype: ${descr}`);
}

export type CrfParams = {
  transitions: Float32Array;
  start: Float32Array;
  end: Float32Array;
  numTags: number;
};

export function loadCrfParamsFromBytes(buf: Uint8Array): CrfParams {
  const entries = unzipSync(buf);
  const transitionsBuf = entries["transitions.npy"];
  const startBuf = entries["start.npy"];
  const endBuf = entries["end.npy"];
  if (!transitionsBuf || !startBuf || !endBuf) {
    throw new Error("CRF npz missing arrays");
  }
  const transitions = parseNpy(transitionsBuf);
  const start = parseNpy(startBuf);
  const end = parseNpy(endBuf);
  return { transitions, start, end, numTags: start.length };
}
