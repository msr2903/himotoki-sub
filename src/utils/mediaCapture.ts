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

/** How long the seek to the cue start / the start of playback may take before audio is omitted. */
const SEEK_TIMEOUT_MS = 4000;
const PLAY_TIMEOUT_MS = 4000;
/** Wall-clock slack on top of the clip length for buffering before a stalled capture gives up. */
const STALL_SLACK_MS = 5000;
const POLL_MS = 50;
/** A pause this close to the clip end (auto-pause stops 250 ms early) still counts as complete. */
const END_TOLERANCE_SEC = 0.35;
/** The seek must land this close to the cue start, or the clip would hold the wrong audio. */
const SEEK_TOLERANCE_SEC = 1;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Resolve true when `promise` settles successfully within `ms`, false on rejection or timeout. */
const settlesWithin = (promise: Promise<unknown>, ms: number): Promise<boolean> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    promise.then(
      () => {
        clearTimeout(timer);
        resolve(true);
      },
      () => {
        clearTimeout(timer);
        resolve(false);
      },
    );
  });

/** Captures run one at a time: each restores the player before the next one snapshots it. */
let captureQueue: Promise<unknown> = Promise.resolve();

/**
 * Record the cue's audio from the video by seeking to its start, playing until media time reaches
 * its end, then restoring the previous position, speed and paused state. Returns null when the
 * browser cannot capture the media stream, playback does not start or stalls, or the user takes
 * over the player mid-capture (their seek, pause and speed change are kept). Times are in seconds.
 */
export const captureCueAudio = (
  video: HTMLVideoElement,
  startSec: number,
  endSec: number,
  baseName: string,
): Promise<TCapturedMedia | null> => {
  const run = captureQueue.then(() => captureNow(video, startSec, endSec, baseName));
  captureQueue = run.catch(() => null).then(() => settlePlayer(video));
  return run;
};

/**
 * Let the restore's own seek / pause / ratechange events land before the next capture starts
 * listening, so they are not mistaken for user actions.
 */
const settlePlayer = async (video: HTMLVideoElement): Promise<void> => {
  if (video.seeking) {
    await settlesWithin(
      new Promise<void>((resolve) => video.addEventListener("seeked", () => resolve(), { once: true })),
      SEEK_TIMEOUT_MS,
    );
  }
  await sleep(POLL_MS);
};

const captureNow = async (
  video: HTMLVideoElement,
  startSec: number,
  endSec: number,
  baseName: string,
): Promise<TCapturedMedia | null> => {
  const v = video as CapturableVideo;
  const capture = v.captureStream || v.mozCaptureStream;
  const mime = pickAudioMime();
  if (!capture || !mime) return null;

  const clipMs = Math.min(MAX_AUDIO_MS, Math.max(MIN_AUDIO_MS, (endSec - startSec) * 1000));
  const stopAtSec = startSec + clipMs / 1000;
  const prevTime = video.currentTime;
  const wasPaused = video.paused;
  const prevRate = video.playbackRate;
  const endTolerance = Math.min(END_TOLERANCE_SEC, clipMs / 3000);

  // Player changes this capture did not make belong to the user (or the page) and must survive the
  // restore. Each of our own seeks / speed changes fires exactly one event, which is discounted.
  let ownSeeks = 0;
  let ownRateChanges = 0;
  let seekDone: (() => void) | null = null;
  let userSeeked = false;
  let userRate = false;
  let userPaused = false;
  const onSeeking = () => {
    if (ownSeeks > 0) ownSeeks--;
    else userSeeked = true;
  };
  const onRateChange = () => {
    if (ownRateChanges > 0) ownRateChanges--;
    else userRate = true;
  };
  const onSeeked = () => seekDone?.();
  const onPause = () => {
    // Auto-pause (or the player) stopping right at the cue end is a completed clip, not a takeover.
    if (video.currentTime < stopAtSec - endTolerance) userPaused = true;
  };
  video.addEventListener("seeking", onSeeking);
  video.addEventListener("seeked", onSeeked);
  video.addEventListener("ratechange", onRateChange);
  video.addEventListener("pause", onPause);
  const userTookOver = () => userSeeked || userPaused;

  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  try {
    stream = capture.call(v);
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) return null;
    recorder = new MediaRecorder(new MediaStream(audioTracks), { mimeType: mime });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };

    // Record at 1x so the clip sounds natural; the stop point is media time, so speed and
    // buffering cannot shorten or lengthen the clip.
    if (video.playbackRate !== 1) {
      try {
        ownRateChanges++;
        video.playbackRate = 1;
      } catch {
        ownRateChanges--;
      }
    }
    ownSeeks++;
    video.currentTime = startSec;
    const seeked = video.seeking ? new Promise<void>((resolve) => (seekDone = resolve)) : Promise.resolve();
    if (!(await settlesWithin(seeked, SEEK_TIMEOUT_MS)) || userTookOver()) return null;
    if (Math.abs(video.currentTime - startSec) > SEEK_TOLERANCE_SEC) return null;

    if (!(await settlesWithin(Promise.resolve(video.play()), PLAY_TIMEOUT_MS)) || userTookOver()) return null;
    recorder.start();

    const deadline = Date.now() + clipMs + STALL_SLACK_MS;
    let reached = false;
    while (!userTookOver()) {
      const t = video.currentTime;
      if (t >= stopAtSec || ((video.paused || video.ended) && t >= stopAtSec - endTolerance)) {
        reached = true;
        break;
      }
      if (video.ended || Date.now() >= deadline) break;
      await sleep(POLL_MS);
    }

    const rec = recorder;
    await settlesWithin(
      new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        rec.stop();
      }),
      2000,
    );
    // Stalled playback or a user takeover leaves a clip that does not hold the cue: omit it.
    if (!reached || userTookOver()) return null;

    const ext = mime.includes("ogg") ? "ogg" : "webm";
    const blob = new Blob(chunks, { type: mime });
    if (!blob.size) return null;
    const dataBase64 = await blobToBase64(blob);
    if (!dataBase64) return null;
    return { filename: `${baseName}.${ext}`, dataBase64 };
  } catch {
    return null;
  } finally {
    try {
      if (recorder && recorder.state !== "inactive") recorder.stop();
    } catch {
      // ignore
    }
    // captureStream() created these tracks for this capture alone; release them on every exit.
    stream?.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // ignore
      }
    });
    video.removeEventListener("seeking", onSeeking);
    video.removeEventListener("seeked", onSeeked);
    video.removeEventListener("ratechange", onRateChange);
    video.removeEventListener("pause", onPause);
    // Restore only what this capture still owns: a user seek keeps its position (and play state),
    // a user pause stays paused, a user speed change keeps its speed.
    try {
      if (!userSeeked) {
        video.currentTime = prevTime;
        if (wasPaused) video.pause();
      }
      if (!userRate && video.playbackRate !== prevRate) video.playbackRate = prevRate;
    } catch {
      // ignore
    }
  }
};
