import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@src/models/subs", () => ({ esSubsChanged: vi.fn() }));
vi.mock("@src/models/settings", () => ({ esRenderSetings: vi.fn() }));

import KinoPub from "./kinopub";

const VTT = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n猫です。\n";

const master = (media: string, variantGroup: string) =>
  [
    "#EXTM3U",
    media,
    `#EXT-X-STREAM-INF:BANDWIDTH=1000000,SUBTITLES="${variantGroup}"`,
    "video/720.m3u8",
  ].join("\n");

const subsPlaylist = (segment: string) =>
  ["#EXTM3U", "#EXT-X-TARGETDURATION:600", "#EXTINF:600,", segment, "#EXT-X-ENDLIST"].join("\n");

/** Serve `files` by absolute URL and record every request. */
function serve(files: Record<string, string>) {
  const requested: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    requested.push(url);
    if (!(url in files)) return { ok: false, status: 404, text: async () => "" };
    return { ok: true, status: 200, text: async () => files[url]! };
  });
  return requested;
}

function adapter(playlistUrl: string) {
  const kinopub = new KinoPub();
  (kinopub as unknown as { videoPlaylistUrl: string }).videoPlaylistUrl = playlistUrl;
  return kinopub;
}

beforeEach(() => vi.spyOn(console, "debug").mockImplementation(() => undefined));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("KinoPub HLS subtitles", () => {
  it("resolves relative subtitle and segment URIs against their playlists (#134)", async () => {
    const requested = serve({
      "https://cdn.example.test/series/master.m3u8": master(
        '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="sub",NAME="Japanese",URI="captions/ja.m3u8"',
        "sub",
      ),
      "https://cdn.example.test/series/captions/ja.m3u8": subsPlaylist("ja.vtt"),
      "https://cdn.example.test/series/captions/ja.vtt": VTT,
    });
    const subs = await adapter("https://cdn.example.test/series/master.m3u8").getSubs("Japanese");
    expect(requested).toEqual([
      "https://cdn.example.test/series/master.m3u8",
      "https://cdn.example.test/series/captions/ja.m3u8",
      "https://cdn.example.test/series/captions/ja.vtt",
    ]);
    expect(subs.map((c) => c.text)).toEqual(["猫です。"]);
  });

  it("keeps ports for root-relative URIs and the KinoPub /hls/ → /pd/ conversion", async () => {
    const requested = serve({
      "https://cdn.example.test:8443/a/master.m3u8?t=1": master(
        '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="sub",NAME="Japanese",URI="/subs/ja.m3u8?t=1"',
        "sub",
      ),
      "https://cdn.example.test:8443/subs/ja.m3u8?t=1": subsPlaylist("https://media.example.test/hls/ja-track/seg-1.vtt"),
      "https://media.example.test/pd/ja-track": VTT,
    });
    const subs = await adapter("https://cdn.example.test:8443/a/master.m3u8?t=1").getSubs("Japanese");
    expect(requested.slice(1)).toEqual(["https://cdn.example.test:8443/subs/ja.m3u8?t=1", "https://media.example.test/pd/ja-track"]);
    expect(subs).toHaveLength(1);
  });

  it("uses the subtitle group the variant names, whatever its GROUP-ID (#135)", async () => {
    const requested = serve({
      "https://cdn.example.test/master.m3u8": master(
        [
          '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="other",NAME="Japanese",URI="https://cdn.example.test/wrong.m3u8"',
          '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="captions",NAME="Japanese",URI="https://cdn.example.test/ja.m3u8"',
        ].join("\n"),
        "captions",
      ),
      "https://cdn.example.test/ja.m3u8": subsPlaylist("ja.vtt"),
      "https://cdn.example.test/ja.vtt": VTT,
    });
    const subs = await adapter("https://cdn.example.test/master.m3u8").getSubs("Japanese");
    expect(requested).toContain("https://cdn.example.test/ja.m3u8");
    expect(requested).not.toContain("https://cdn.example.test/wrong.m3u8");
    expect(subs).toHaveLength(1);
  });

  it("names the missing track instead of throwing a TypeError", async () => {
    serve({
      "https://cdn.example.test/master.m3u8": master(
        '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="captions",NAME="English",URI="en.m3u8"',
        "captions",
      ),
    });
    await expect(adapter("https://cdn.example.test/master.m3u8").getSubs("Japanese")).rejects.toThrow(
      'No subtitle track "Japanese"',
    );
  });
});

describe("KinoPub player containers (#154)", () => {
  const page = (elements: Record<string, object>) =>
    vi.stubGlobal("document", { querySelector: (selector: string) => elements[selector] ?? null });

  it("renders settings into the Vidstack player when there is no legacy #player", () => {
    const player = { tag: "media-player" };
    page({ "media-player": player, ".control-button.btn-settings": {} });
    const kinopub = new KinoPub();
    expect(kinopub.getSubsContainer()).toBe(player);
    expect(kinopub.getSettingsContentContainer()).toBe(player);
  });

  it("still uses #player on the old layout", () => {
    const player = { id: "player" };
    page({ "#player": player });
    const kinopub = new KinoPub();
    expect(kinopub.getSubsContainer()).toBe(player);
    expect(kinopub.getSettingsContentContainer()).toBe(player);
  });
});
