import { useEffect, useState } from "react";

import { isPointInRect } from "@src/shared/mouseActions";

/**
 * True while the pointer is moving over the video (or the subtitle overlay), and for `idleMs` after it
 * stops, like a player's own controls. Used to show on-screen controls only when the user reaches for
 * the mouse. It stays true while the pointer rests on a control marked `data-pointer-hold`, as a
 * player keeps its controls up under the cursor; otherwise the control would vanish (and stop taking
 * clicks) beneath a still pointer.
 */
export function usePointerActivity(video: HTMLVideoElement | null, idleMs: number): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!video) return;
    let timer: number | undefined;
    let lastHit = -Infinity;
    let lastTarget: Element | null = null;
    const idle = () => {
      if (lastTarget?.isConnected && lastTarget.closest?.("[data-pointer-hold]")) timer = window.setTimeout(idle, idleMs);
      else setActive(false);
    };
    const onMove = (event: MouseEvent) => {
      lastTarget = event.target as Element | null;
      // mousemove fires at display rate; once the pointer is known to be over the video, refreshing
      // the idle timer a few times a second is enough. Moves outside never count toward the throttle,
      // so the first move into the video is always seen.
      if (event.timeStamp - lastHit < 100) return;
      const overSubs = (event.target as Element | null)?.closest?.("#es-subs") != null;
      if (!overSubs && !isPointInRect(event.clientX, event.clientY, video.getBoundingClientRect())) return;
      lastHit = event.timeStamp;
      setActive(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(idle, idleMs);
    };
    document.addEventListener("mousemove", onMove, { capture: true, passive: true });
    return () => {
      document.removeEventListener("mousemove", onMove, { capture: true });
      window.clearTimeout(timer);
      setActive(false);
    };
  }, [video, idleMs]);
  return active;
}
