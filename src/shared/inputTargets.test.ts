import { describe, expect, it } from "vitest";
import { eventOrigin, isEditableTarget, isInteractiveTarget, type TElementLike } from "./inputTargets";

type TFake = TElementLike & { attrs: Record<string, string> };
const el = (tagName: string, attrs: Record<string, string> = {}, parent: TFake | null = null, extra: Partial<TElementLike> = {}): TFake => ({
  tagName,
  attrs,
  getAttribute: (name: string) => attrs[name] ?? null,
  parentElement: parent,
  parentNode: parent,
  ...extra,
});

describe("isEditableTarget (#128)", () => {
  it("treats form fields as editable", () => {
    expect(isEditableTarget(el("INPUT"))).toBe(true);
    expect(isEditableTarget(el("textarea"))).toBe(true);
    expect(isEditableTarget(el("SELECT"))).toBe(true);
  });

  it.each(["", "true", "TRUE", "plaintext-only", "Plaintext-Only"])("contenteditable=%j and its descendants", (value) => {
    const editor = el("DIV", { contenteditable: value });
    expect(isEditableTarget(editor)).toBe(true);
    expect(isEditableTarget(el("SPAN", {}, el("P", {}, editor)))).toBe(true);
  });

  it("uses the browser's effective state when present", () => {
    expect(isEditableTarget(el("DIV", {}, null, { isContentEditable: true }))).toBe(true);
  });

  it("respects contenteditable=false inside an editor, and plain elements", () => {
    const editor = el("DIV", { contenteditable: "plaintext-only" });
    expect(isEditableTarget(el("SPAN", {}, el("DIV", { contenteditable: "false" }, editor)))).toBe(false);
    expect(isEditableTarget(el("DIV"))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget({})).toBe(false);
  });

  it("crosses shadow roots to the host", () => {
    const host = el("CHAT-BOX", { contenteditable: "plaintext-only" });
    const inner = el("SPAN", {}, null, { parentNode: { host } });
    expect(isEditableTarget(inner)).toBe(true);
  });

  it("eventOrigin prefers the composed path", () => {
    const inner = el("DIV");
    const host = el("X-HOST");
    expect(eventOrigin({ target: host as unknown as EventTarget, composedPath: () => [inner as unknown as EventTarget] })).toBe(inner);
    expect(eventOrigin({ target: host as unknown as EventTarget })).toBe(host);
  });
});

describe("isInteractiveTarget (#137)", () => {
  it("links, dialogs, menus and the extension's settings UI are interactive", () => {
    expect(isInteractiveTarget(el("SPAN", {}, el("A", { href: "https://www.deepl.com/pro-api" })))).toBe(true);
    expect(isInteractiveTarget(el("DIV", { role: "menuitem" }))).toBe(true);
    expect(isInteractiveTarget(el("DIV", {}, el("DIV", { role: "dialog" })))).toBe(true);
    expect(isInteractiveTarget(el("DIV", { "aria-modal": "true" }))).toBe(true);
    expect(isInteractiveTarget(el("P", {}, el("DIV", { class: "es-modal-overlay" })))).toBe(true);
    expect(isInteractiveTarget(el("DIV", {}, el("DIV", { class: "es-settings-content" })))).toBe(true);
  });

  it("bare video and subtitle tokens are not", () => {
    expect(isInteractiveTarget(el("VIDEO"))).toBe(false);
    expect(isInteractiveTarget(el("SPAN", { class: "es-sub-item" }, el("DIV", { id: "es-subs" })))).toBe(false);
    expect(isInteractiveTarget(el("A"))).toBe(false); // no href: not a link
  });

  it("stops at the playback surface", () => {
    const player = el("DIV", { role: "dialog" });
    const video = el("VIDEO", {}, player);
    const isSurface = (node: TElementLike) => node === player;
    expect(isInteractiveTarget(video, isSurface)).toBe(false);
    expect(isInteractiveTarget(el("A", { href: "#" }, player), isSurface)).toBe(true);
  });
});
