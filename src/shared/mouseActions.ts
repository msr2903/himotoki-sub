import type { TMouseAction, TMouseButton } from "@src/models/types";

/**
 * Mouse-only playback control: what the middle and side (back/forward) buttons do while the pointer
 * is over the video. Shared by the in-player panel, the options page and src/utils/mouseHandler.ts.
 */
export const MOUSE_ACTIONS: Array<{ value: TMouseAction; label: string; description: string }> = [
  { value: "none", label: "No action", description: "Keep the browser's usual behaviour for this button." },
  { value: "prev", label: "Previous line", description: "Jump to the start of the previous subtitle line." },
  { value: "next", label: "Next line", description: "Jump to the start of the next subtitle line." },
  { value: "replay", label: "Replay line", description: "Replay the current subtitle line from its start." },
  { value: "loop", label: "Loop line", description: "Loop the current subtitle line; press again to stop." },
  { value: "slowReplay", label: "Slow replay", description: "Replay the current line at 0.75× speed." },
  { value: "playPause", label: "Play / pause", description: "Toggle playback." },
];

/** `MouseEvent.button` values: 1 = middle (wheel), 3 = back side button, 4 = forward side button. */
export const MOUSE_BUTTONS: Array<{ id: TMouseButton; button: number; label: string; setting: string }> = [
  { id: "middle", button: 1, label: "Middle click", setting: "mouseMiddleAction" },
  { id: "back", button: 3, label: "Back side button", setting: "mouseBackAction" },
  { id: "forward", button: 4, label: "Forward side button", setting: "mouseForwardAction" },
];

/** Off by default: an assigned button stops navigating back/forward while over the video. */
export const DEFAULT_MOUSE_ACTION: TMouseAction = "none";

export const isMouseAction = (value: unknown): value is TMouseAction => MOUSE_ACTIONS.some((a) => a.value === value);

/** Which configurable button a `MouseEvent.button` value is, if any. Pure. */
export const mouseButtonOf = (button: number): TMouseButton | undefined =>
  MOUSE_BUTTONS.find((b) => b.button === button)?.id;

/** Whether a client point falls inside a rect (edges inclusive). Pure. */
export const isPointInRect = (
  x: number,
  y: number,
  rect: { left: number; top: number; right: number; bottom: number },
): boolean => rect.right > rect.left && rect.bottom > rect.top && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
