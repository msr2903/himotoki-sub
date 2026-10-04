import { describe, expect, it } from "vitest";
import { SLOW_REPLAY_RATE } from "@src/shared/playbackRate";
import { FakeVideo } from "./fakeVideo.testutil";
import { cancelSlowReplay, startSlowReplay } from "./slowReplay";

const seekOf = (video: FakeVideo) => (ms: number) => {
  video.currentTime = ms / 1000;
};

describe("slow replay owner (#108)", () => {
  it("restores the latest user speed when playback leaves the line", () => {
    const video = new FakeVideo();
    let userRate = 1;
    startSlowReplay(video.asVideo(), 1000, 5000, seekOf(video), () => userRate);
    expect(video.playbackRate).toBe(SLOW_REPLAY_RATE);
    video.tick(1000);
    video.tick(3000);
    userRate = 1.25;
    video.tick(4000);
    expect(video.playbackRate).toBe(SLOW_REPLAY_RATE);
    video.tick(5100);
    expect(video.playbackRate).toBe(1.25);
  });

  it("a speed change cancels the replay, which then never overrides it", () => {
    const video = new FakeVideo();
    startSlowReplay(video.asVideo(), 1000, 5000, seekOf(video), () => 1);
    video.tick(1500);
    // What applyPlaybackRate does when the setting changes to 1.5×.
    cancelSlowReplay(1.5);
    expect(video.playbackRate).toBe(1.5);
    video.tick(2000);
    video.tick(5100);
    video.tick(9000);
    expect(video.playbackRate).toBe(1.5);
  });

  it("a second replay is not cut short by the first one", () => {
    const video = new FakeVideo();
    startSlowReplay(video.asVideo(), 1000, 5000, seekOf(video), () => 1);
    video.tick(1000);
    video.tick(2000);
    startSlowReplay(video.asVideo(), 1000, 5000, seekOf(video), () => 1);
    [1000, 2000, 3000, 4000, 4900].forEach((t) => video.tick(t));
    expect(video.playbackRate).toBe(SLOW_REPLAY_RATE);
    video.tick(5100);
    expect(video.playbackRate).toBe(1);
  });

  it("restores the speed after seeking away from the line", () => {
    const video = new FakeVideo();
    startSlowReplay(video.asVideo(), 1000, 5000, seekOf(video), () => 1);
    video.tick(1200);
    video.tick(60000);
    expect(video.playbackRate).toBe(1);
  });

  it("a replaced video keeps the restored speed and the new one is untouched", () => {
    const oldVideo = new FakeVideo();
    const newVideo = new FakeVideo();
    startSlowReplay(oldVideo.asVideo(), 1000, 5000, seekOf(oldVideo), () => 1);
    cancelSlowReplay(1);
    expect(oldVideo.playbackRate).toBe(1);
    newVideo.playbackRate = 2;
    oldVideo.tick(1200);
    oldVideo.tick(5100);
    expect(newVideo.playbackRate).toBe(2);
  });
});
