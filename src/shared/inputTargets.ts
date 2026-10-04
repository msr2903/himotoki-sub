/**
 * Which event targets the playback shortcuts (src/utils/keyboardHandler.ts) and mouse bindings
 * (src/utils/mouseHandler.ts) must leave alone. Written as plain ancestor walks over the few
 * element properties they need, so they work across shadow roots and can be unit-tested without a DOM.
 */

export type TElementLike = {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
  parentElement?: TElementLike | null;
  parentNode?: { host?: TElementLike } | TElementLike | null;
};

const asElement = (target: unknown): TElementLike | null =>
  target && typeof target === "object" && typeof (target as TElementLike).getAttribute === "function"
    ? (target as TElementLike)
    : null;

/** The element and its ancestors, continuing from a shadow root to its host. */
function* ancestors(start: TElementLike | null): Generator<TElementLike> {
  let node = start;
  while (node) {
    yield node;
    const parentNode = node.parentNode as { host?: TElementLike } | null | undefined;
    node = node.parentElement ?? asElement(parentNode?.host) ?? null;
  }
}

/** Where the event really started: the innermost target, even inside a shadow root. */
export const eventOrigin = (event: { target: EventTarget | null; composedPath?: () => EventTarget[] }): unknown => {
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  return path[0] ?? event.target;
};

const tagOf = (el: TElementLike) => (el.tagName ?? "").toUpperCase();

/**
 * Whether typing into this target edits text: form fields and any contenteditable host —
 * including `plaintext-only`, which the old `[contenteditable='true']` selector missed.
 * Uses the browser's effective `isContentEditable` when available; otherwise follows the attribute
 * inheritance rules (nearest explicit value wins, `false` stops it).
 */
export const isEditableTarget = (target: unknown): boolean => {
  const el = asElement(target);
  if (!el) return false;
  if (el.isContentEditable === true) return true;
  for (const node of ancestors(el)) {
    const tag = tagOf(node);
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    const editable = node.getAttribute?.("contenteditable");
    if (editable != null) {
      const value = editable.trim().toLowerCase();
      if (value === "" || value === "true" || value === "plaintext-only") return true;
      if (value === "false") return false;
    }
  }
  return false;
};

const INTERACTIVE_ROLES = new Set([
  "link",
  "dialog",
  "alertdialog",
  "menu",
  "menubar",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "listbox",
  "option",
]);

/**
 * Whether a mouse press on this target belongs to an interactive control rather than the playback
 * surface: links (middle click opens them in a new tab), dialogs and menus layered over the player
 * (the extension's own settings panel and modals included).
 *
 * `isSurface` marks where the playback surface begins (e.g. an element containing the video): the walk
 * stops there, so a player wrapper that happens to carry a dialog role does not swallow every click.
 */
export const isInteractiveTarget = (target: unknown, isSurface: (el: TElementLike) => boolean = () => false): boolean => {
  const el = asElement(target);
  if (!el) return false;
  for (const node of ancestors(el)) {
    if (isSurface(node)) return false;
    const tag = tagOf(node);
    if ((tag === "A" || tag === "AREA") && node.getAttribute?.("href") != null) return true;
    if (tag === "DIALOG") return true;
    const role = node.getAttribute?.("role")?.trim().toLowerCase();
    if (role && INTERACTIVE_ROLES.has(role)) return true;
    if (node.getAttribute?.("aria-modal") === "true") return true;
    const className = node.getAttribute?.("class") ?? "";
    if (/(^|\s)(es-settings|es-settings-content|es-modal-overlay)(\s|$)/.test(className)) return true;
  }
  return false;
};
