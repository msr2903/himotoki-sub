import { useEffect, useState } from "react";

/**
 * Element that overlay UI (dropdown menus, toasts, modals) should be portaled into. While an
 * element is full screen the browser renders only its subtree on the top layer, so a portal into
 * document.body is invisible — portal into the fullscreen element instead.
 */
export const overlayPortalTarget = (): HTMLElement => {
  const el = typeof document !== "undefined" ? document.fullscreenElement : null;
  return el instanceof HTMLElement ? el : document.body;
};

/** React version of overlayPortalTarget: re-evaluates whenever fullscreen state changes. */
export const useOverlayPortalTarget = (): HTMLElement => {
  const [target, setTarget] = useState<HTMLElement>(overlayPortalTarget);
  useEffect(() => {
    const onChange = () => setTarget(overlayPortalTarget());
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  return target;
};
