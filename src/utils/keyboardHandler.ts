import { $streaming } from "@src/models/streamings";
import { moveKeyPressed } from "@src/models/videos";
import { $enabled, $moveBySubsEnabled, secondarySubsCycled, playbackRateSpeedUp, playbackRateSpeedDown, listeningPeekToggled } from "@src/models/settings";
import { replayLinePressed, loopLineToggled, slowReplayRequested } from "@src/models/videos";
import { sentenceToggled, transcriptToggled } from "@src/models/subs";
import { eventOrigin, isEditableTarget } from "@src/shared/inputTargets";

// Plain-letter shortcuts. `repeat: false` means one action per key press: holding the key must not
// flicker a panel open/closed or restart a replay with every OS auto-repeat. Speed steps keep repeating.
const SHORTCUTS: Record<string, { run: () => void; repeat: boolean }> = {
  KeyD: { run: () => secondarySubsCycled(), repeat: false },
  KeyB: { run: () => sentenceToggled(), repeat: false },
  KeyT: { run: () => transcriptToggled(), repeat: false },
  KeyR: { run: () => replayLinePressed(), repeat: false },
  KeyL: { run: () => loopLineToggled(), repeat: false },
  Comma: { run: () => playbackRateSpeedDown(), repeat: true },
  Period: { run: () => playbackRateSpeedUp(), repeat: true },
  Backslash: { run: () => slowReplayRequested(), repeat: false },
  KeyH: { run: () => listeningPeekToggled(), repeat: false },
};

const keyboardEvents = ["keyup", "keydown", "keypress"];

export const keyboardHandler = (event: KeyboardEvent) => {
  // Disabled: the overlay is hidden, so every key belongs to the site again.
  if (!$enabled.getState()) return;
  // Never hijack keys while the user is typing (search box, comments, any contenteditable editor).
  if (isEditableTarget(eventOrigin(event))) return;
  const shortcut = SHORTCUTS[event.code];
  if (shortcut && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    // Claimed for keyup/keypress and repeats too, so the player never sees half of the gesture.
    event.stopPropagation();
    event.preventDefault();
    if (event.type === "keydown" && (shortcut.repeat || !event.repeat)) shortcut.run();
    return;
  }
  // Arrow-key navigation is the only part gated by the "move by subtitles" setting; the other
  // shortcuts above are always available. Checked live so toggling the setting takes effect at once.
  if (!$moveBySubsEnabled.getState()) return;
  if (event.code === "ArrowLeft") {
    event.stopPropagation();
    if (event.type === "keydown") {
      moveKeyPressed({ direction: "prev", force: event.altKey });
    }
  }
  if (event.code === "ArrowRight") {
    event.stopPropagation();
    if (event.type === "keydown") {
      moveKeyPressed({ direction: "next", force: event.altKey });
    }
  }
  if (event.code === "ArrowDown") {
    event.stopPropagation();
    event.preventDefault();
    if (event.type === "keydown") {
      moveKeyPressed({ direction: "current", force: false });
    }
  }
};

export const addKeyboardEventsListeners = () => {
  if ($streaming.getState().isOnFlight()) {
    return;
  }
  keyboardEvents.forEach((eventType) => {
    document.addEventListener(eventType as any, keyboardHandler, true);
  });
};

export const removeKeyboardEventsListeners = () => {
  keyboardEvents.forEach((eventType) => {
    document.removeEventListener(eventType as any, keyboardHandler, true);
  });
};
