import { $streaming } from "@src/models/streamings";
import { $mouseActions, listeningPeekToggled } from "@src/models/settings";
import { $video, loopLineToggled, moveKeyPressed, replayLinePressed, slowReplayRequested } from "@src/models/videos";
import type { TMouseAction } from "@src/models/types";
import { isPointInRect, mouseButtonOf } from "@src/shared/mouseActions";

const isEditable = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  return Boolean(el.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']"));
};

const runMouseAction = (action: TMouseAction) => {
  switch (action) {
    // A button press means "go to that line" — always jump, unlike the arrow keys, which fall back
    // to a 5 s seek when the neighbouring line is far away.
    case "prev":
      moveKeyPressed({ direction: "prev", force: true });
      break;
    case "next":
      moveKeyPressed({ direction: "next", force: true });
      break;
    case "replay":
      replayLinePressed();
      break;
    case "loop":
      loopLineToggled();
      break;
    case "slowReplay":
      slowReplayRequested();
      break;
    case "playPause": {
      const video = $video.getState();
      if (!video) break;
      if (video.paused) void video.play().catch(() => {});
      else video.pause();
      break;
    }
    case "showLine":
      listeningPeekToggled();
      break;
    case "none":
      break;
  }
};

/** The assigned action for this press, or undefined when the browser should handle it as usual. */
const actionFor = (event: MouseEvent): TMouseAction | undefined => {
  const button = mouseButtonOf(event.button);
  if (!button) return undefined;
  const action = $mouseActions[button].getState();
  if (action === "none") return undefined;
  const video = $video.getState();
  // Only over the video (subtitles included): elsewhere the buttons keep doing back/forward,
  // open-in-new-tab and auto-scroll.
  if (!video || !isPointInRect(event.clientX, event.clientY, video.getBoundingClientRect())) return undefined;
  if (isEditable(event.target)) return undefined;
  return action;
};

// Buttons whose press we took over. The browser acts on the release (back/forward navigate on
// mouseup, middle click opens links on auxclick), so those must be cancelled too — even if the
// pointer has left the video by then.
const claimedButtons = new Set<number>();

const onMouseDown = (event: MouseEvent) => {
  claimedButtons.delete(event.button);
  const action = actionFor(event);
  if (!action) return;
  claimedButtons.add(event.button);
  // Also blocks middle-click auto-scroll and keeps the player from reacting to the press.
  event.preventDefault();
  event.stopPropagation();
  runMouseAction(action);
};

const onMouseRelease = (event: MouseEvent) => {
  if (!claimedButtons.has(event.button)) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.type === "auxclick") claimedButtons.delete(event.button);
};

export const addMouseEventsListeners = () => {
  if ($streaming.getState().isOnFlight()) return;
  document.addEventListener("mousedown", onMouseDown, true);
  document.addEventListener("mouseup", onMouseRelease, true);
  document.addEventListener("auxclick", onMouseRelease, true);
};

export const removeMouseEventsListeners = () => {
  document.removeEventListener("mousedown", onMouseDown, true);
  document.removeEventListener("mouseup", onMouseRelease, true);
  document.removeEventListener("auxclick", onMouseRelease, true);
  claimedButtons.clear();
};
