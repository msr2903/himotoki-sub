import { describe, expect, it, vi } from "vitest";
import { createVideoClockBinding } from "./videoClock";

const tick = (video: EventTarget) => video.dispatchEvent(new Event("timeupdate"));

describe("video clock binding (#155)", () => {
  it("only the current video drives the clock after a replacement", () => {
    const onTick = vi.fn();
    const bind = createVideoClockBinding(onTick);
    const a = new EventTarget();
    const b = new EventTarget();
    bind(a);
    tick(a);
    expect(onTick).toHaveBeenCalledTimes(1);
    bind(b);
    tick(a);
    expect(onTick).toHaveBeenCalledTimes(1);
    tick(b);
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it("binding the same video again does not add a second listener", () => {
    const onTick = vi.fn();
    const bind = createVideoClockBinding(onTick);
    const a = new EventTarget();
    bind(a);
    bind(a);
    tick(a);
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it("clearing the video detaches it", () => {
    const onTick = vi.fn();
    const bind = createVideoClockBinding(onTick);
    const a = new EventTarget();
    bind(a);
    bind(null);
    tick(a);
    expect(onTick).not.toHaveBeenCalled();
  });
});
