import { describe, expect, it } from "vitest";
import { FakeVideo } from "./fakeVideo.testutil";
import { cancelVideoClip, replayVideoClip } from "./replayVideoClip";
import { MEDIA_WINDOW_ARM_UPDATES } from "./mediaWindow";

const start = (video: FakeVideo, from = 1000, to = 2000) =>
  replayVideoClip(video.asVideo(), from, to, (ms) => {
    video.currentTime = ms / 1000;
  });

describe("replayVideoClip (#129)", () => {
  it("pauses once when playback runs through the clip end", () => {
    const video = new FakeVideo();
    start(video);
    [1000, 1250, 1500, 1750, 2010].forEach((t) => video.tick(t));
    expect(video.pauseCalls).toBe(1);
    video.play();
    video.tick(2250);
    video.tick(2500);
    expect(video.pauseCalls).toBe(1);
  });

  it("does not pause a scene the user seeked forward to", () => {
    const video = new FakeVideo();
    start(video);
    video.tick(1250);
    video.tick(60000);
    video.tick(60250);
    expect(video.pauseCalls).toBe(0);
  });

  it("lets go after a backward seek", () => {
    const video = new FakeVideo();
    start(video);
    video.tick(1250);
    video.tick(100);
    [1000, 1500, 2010].forEach((t) => video.tick(t));
    expect(video.pauseCalls).toBe(0);
  });

  it("ignores time updates while seeking", () => {
    const video = new FakeVideo();
    start(video);
    video.tick(1250);
    video.seeking = true;
    video.tick(60000);
    video.seeking = false;
    video.tick(1500);
    video.tick(2010);
    expect(video.pauseCalls).toBe(1);
  });

  it("waits for a delayed seek before watching (old position past the end)", () => {
    const video = new FakeVideo();
    replayVideoClip(video.asVideo(), 1000, 2000, () => {
      // Seek lands later, like Netflix's player API.
    });
    video.tick(60000);
    video.tick(60250);
    expect(video.pauseCalls).toBe(0);
    [1000, 1500, 2010].forEach((t) => video.tick(t));
    expect(video.pauseCalls).toBe(1);
  });

  it("gives up when the seek never lands", () => {
    const video = new FakeVideo();
    replayVideoClip(video.asVideo(), 1000, 2000, () => {});
    for (let i = 0; i < MEDIA_WINDOW_ARM_UPDATES; i++) video.tick(60000 + i * 250);
    [1000, 1500, 2010].forEach((t) => video.tick(t));
    expect(video.pauseCalls).toBe(0);
  });

  it("a newer replay replaces the old one, and cancel releases it", () => {
    const video = new FakeVideo();
    start(video, 1000, 2000);
    start(video, 5000, 6000);
    [5000, 5500, 6010].forEach((t) => video.tick(t));
    expect(video.pauseCalls).toBe(1);

    const other = new FakeVideo();
    start(other);
    other.tick(1500);
    cancelVideoClip();
    other.tick(2010);
    expect(other.pauseCalls).toBe(0);
  });
});
