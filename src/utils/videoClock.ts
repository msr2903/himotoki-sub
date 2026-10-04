type ClockSource = Pick<EventTarget, "addEventListener" | "removeEventListener">;

/**
 * Keeps exactly one `timeupdate` listener on the current video. Switching to another element (or to
 * none) first detaches the previous one, so a replaced player can no longer drive the shared clock
 * (#155); binding the same element again is a no-op.
 */
export const createVideoClockBinding = (onTick: () => void) => {
  let current: ClockSource | null = null;
  const listener = () => onTick();
  return (video: ClockSource | null | undefined) => {
    const next = video ?? null;
    if (next === current) return;
    current?.removeEventListener("timeupdate", listener);
    current = next;
    current?.addEventListener("timeupdate", listener);
  };
};
