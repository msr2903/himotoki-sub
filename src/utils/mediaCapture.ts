/**
 * Best-effort capture of a video frame and a cue's audio for rich Anki cards. Everything is guarded:
 * cross-origin / DRM-protected media taints the canvas or exposes no capturable stream, in which case
 * these return null and the card is built without that media. Browser-only APIs (canvas, captureStream,
 * MediaRecorder) are all feature-detected.
 */

export type TCapturedMedia = { filename: string; dataBase64: string };

/** Longest audio clip to record, so a mis-set cue can't record forever. */
const MAX_AUDIO_MS = 15000;
const MIN_AUDIO_MS = 300;

/** Capture the current frame of the video as a JPEG (downscaled). Returns null if not capturable. */
export const captureVideoFrame = (video: HTMLVideoElement, baseName: string): TCapturedMedia | null => {
  try {
    if (!video.videoWidth || !video.videoHeight) return null;
    const scale = Math.min(1, 640 / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // toDataURL throws SecurityError on a tainted (cross-origin/DRM) canvas.
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    const base64 = dataUrl.split(",")[1] || "";
    if (!base64) return null;
    return { filename: `${baseName}.jpg`, dataBase64: base64 };
  } catch {
    return null;
  }
};

const pickAudioMime = (): string | null => {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];
  for (const mime of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      // ignore
    }
  }
  return null;
};

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

type CapturableVideo = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

/**
 * Record the cue's audio from the video by seeking to its start, playing for the cue duration, then
 * restoring the previous position and paused state. Returns null when the browser cannot capture the
 * media stream. Times are in seconds.
 */
export const captureCueAudio = async (
  video: HTMLVideoElement,
  startSec: number,
  endSec: number,
  baseName: string,
): Promise<TCapturedMedia | null> => {
  const v = video as CapturableVideo;
  const capture = v.captureStream || v.mozCaptureStream;
  const mime = pickAudioMime();
  if (!capture || !mime) return null;

  const durationMs = Math.min(MAX_AUDIO_MS, Math.max(MIN_AUDIO_MS, (endSec - startSec) * 1000));
  const prevTime = video.currentTime;
  const wasPaused = video.paused;
  // The wait below is wall-clock, so the clip must play at 1x: at 0.5x it would cover only half
  // the cue, at 2x it would overrun into the next line. Restored in finally.
  const prevRate = video.playbackRate;

  try {
    const stream = capture.call(v);
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) return null;
    const audioStream = new MediaStream(audioTracks);
    const recorder = new MediaRecorder(audioStream, { mimeType: mime });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };

    video.currentTime = startSec;
    try {
      video.playbackRate = 1;
    } catch {
      // ignore — recording still works, just at the user's speed
    }
    await video.play().catch(() => {});
    recorder.start();
    await new Promise((r) => setTimeout(r, durationMs));
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    const ext = mime.includes("ogg") ? "ogg" : "webm";
    const blob = new Blob(chunks, { type: mime });
    if (!blob.size) return null;
    const dataBase64 = await blobToBase64(blob);
    if (!dataBase64) return null;
    return { filename: `${baseName}.${ext}`, dataBase64 };
  } catch {
    return null;
  } finally {
    // Restore playback position, speed and paused state.
    try {
      video.currentTime = prevTime;
      video.playbackRate = prevRate;
      if (wasPaused) video.pause();
    } catch {
      // ignore
    }
  }
};
