import { $streaming } from "@src/models/streamings";
import { moveKeyPressed } from "@src/models/videos";
import { secondarySubsCycled, listeningPeekToggled } from "@src/models/settings";
import { replayLinePressed, loopLineToggled } from "@src/models/videos";
import { sentenceToggled, transcriptToggled } from "@src/models/subs";

const isEditable = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  return Boolean(el.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']"));
};

const keyboardEvents = ["keyup", "keydown", "keypress"];

export const keyboardHandler = (event: KeyboardEvent) => {
  // Never hijack keys while the user is typing (search box, comments).
  if (isEditable(event.target)) return;
  if (event.code === "KeyD" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    event.stopPropagation();
    event.preventDefault();
    if (event.type === "keydown") secondarySubsCycled();
    return;
  }
  if (event.code === "KeyB" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    event.stopPropagation();
    event.preventDefault();
    if (event.type === "keydown") sentenceToggled();
    return;
  }
  if (event.code === "KeyT" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    event.stopPropagation();
    event.preventDefault();
    if (event.type === "keydown") transcriptToggled();
    return;
  }
  if (event.code === "KeyR" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    event.stopPropagation();
    event.preventDefault();
    if (event.type === "keydown") replayLinePressed();
    return;
  }
  if (event.code === "KeyL" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    event.stopPropagation();
    event.preventDefault();
    if (event.type === "keydown") loopLineToggled();
    return;
  }
  if (event.code === "KeyH" && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    event.stopPropagation();
    event.preventDefault();
    if (event.type === "keydown") listeningPeekToggled();
    return;
  }
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
