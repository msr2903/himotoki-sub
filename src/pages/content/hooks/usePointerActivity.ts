import { useEffect, useState } from "react";

import { isPointInRect } from "@src/shared/mouseActions";

/**
 * True while the pointer is moving over the video (or the subtitle overlay), and for `idleMs` after it
 * stops, like a player's own controls. Used to show on-screen controls only when the user reaches for
 * the mouse.
 */
export function usePointerActivity(video: HTMLVideoElement | null, idleMs: number): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!video) return;
    let timer: number | undefined;
    let lastHit = -Infinity;
    const onMove = (event: MouseEvent) => {
      // mousemove fires at display rate; once the pointer is known to be over the video, refreshing
      // the idle timer a few times a second is enough. Moves outside never count toward the throttle,
      // so the first move into the video is always seen.
      if (event.timeStamp - lastHit < 100) return;
      const overSubs = (event.target as Element | null)?.closest?.("#es-subs") != null;
      if (!overSubs && !isPointInRect(event.clientX, event.clientY, video.getBoundingClientRect())) return;
      lastHit = event.timeStamp;
      setActive(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setActive(false), idleMs);
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
