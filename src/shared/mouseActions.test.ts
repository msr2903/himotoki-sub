import { describe, it, expect } from "vitest";
import { MOUSE_BUTTONS, isMouseAction, isPointInRect, mouseButtonOf } from "./mouseActions";

describe("mouseButtonOf", () => {
  it("maps middle and side buttons", () => {
    expect(mouseButtonOf(1)).toBe("middle");
    expect(mouseButtonOf(3)).toBe("back");
    expect(mouseButtonOf(4)).toBe("forward");
  });

  it("never claims the primary or secondary button", () => {
    expect(mouseButtonOf(0)).toBeUndefined();
    expect(mouseButtonOf(2)).toBeUndefined();
  });

  it("uses a distinct storage key per button", () => {
    expect(new Set(MOUSE_BUTTONS.map((b) => b.setting)).size).toBe(MOUSE_BUTTONS.length);
  });
});

describe("isMouseAction", () => {
  it("accepts known actions only", () => {
    expect(isMouseAction("prev")).toBe(true);
    expect(isMouseAction("showLine")).toBe(true);
    expect(isMouseAction("none")).toBe(true);
    expect(isMouseAction("popup")).toBe(false);
    expect(isMouseAction(undefined)).toBe(false);
  });
});

describe("isPointInRect", () => {
  const rect = { left: 10, top: 20, right: 110, bottom: 80 };

  it("includes the inside and the edges", () => {
    expect(isPointInRect(50, 50, rect)).toBe(true);
    expect(isPointInRect(10, 20, rect)).toBe(true);
    expect(isPointInRect(110, 80, rect)).toBe(true);
  });

  it("excludes points outside", () => {
    expect(isPointInRect(9, 50, rect)).toBe(false);
    expect(isPointInRect(50, 81, rect)).toBe(false);
  });

  it("treats an empty rect (hidden video) as never hit", () => {
    expect(isPointInRect(0, 0, { left: 0, top: 0, right: 0, bottom: 0 })).toBe(false);
  });
});
