import { describe, it, expect } from "vitest";
import { videoIdFromUrl } from "./youtubeHelpers";

const ID = "jfKfPfyJRdk";

describe("videoIdFromUrl (#82)", () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/watch?v=${ID}&list=PLxyz`,
    `https://youtu.be/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/v/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `https://www.youtube.com/live/${ID}?si=abc`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://m.youtube.com/live/${ID}`,
  ])("extracts the id from %s", (url) => {
    expect(videoIdFromUrl(url)).toBe(ID);
  });

  it.each([
    "https://www.youtube.com/",
    "https://www.youtube.com/feed/subscriptions",
    "https://www.youtube.com/results?search_query=test",
    "https://www.youtube.com/watch?v=tooshort",
  ])("returns empty for %s", (url) => {
    expect(videoIdFromUrl(url)).toBe("");
  });
});
