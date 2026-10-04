import { Parser } from "m3u8-parser";
import { parse } from "subtitle";

import { esSubsChanged } from "@src/models/subs";
import { esRenderSetings } from "@src/models/settings";
import Service from "./service";

class KinoPub implements Service {
  name = "kinopub";

  private videoPlaylistUrl: string | undefined;
  private subsName: string | undefined;

  constructor() {
    this.handleKinopubFirstFrame = this.handleKinopubFirstFrame.bind(this);
    this.handleKinopubCaptionsChanged =
      this.handleKinopubCaptionsChanged.bind(this);
  }

  public init(): void {
    console.debug("++++++++++++ KINOPUB INIT ++++++++++++");
    this.injectScript();

    window.addEventListener(
      "kinopubFirstFrame",
      this.handleKinopubFirstFrame as EventListener,
    );
    window.addEventListener(
      "kinopubCaptionsChanged",
      this.handleKinopubCaptionsChanged as EventListener,
    );
  }

  public async getSubs(label: string) {
    if (!label) return parse("");
    if (!this.videoPlaylistUrl) return parse("");

    const masterUrl = this.videoPlaylistUrl;
    const master = parsePlaylist(await fetchText(masterUrl));
    const track = findSubtitleTrack(master, label);
    if (!track?.uri) throw new Error(`No subtitle track "${label}" in the KinoPub playlist`);

    // HLS URIs may be relative to the playlist that contains them (RFC 8216 §4.1).
    const subsPlaylistUrl = new URL(track.uri, masterUrl).href;
    const subsPlaylist = parsePlaylist(await fetchText(subsPlaylistUrl));
    const segmentUri = subsPlaylist.segments?.[0]?.uri;
    if (!segmentUri) throw new Error(`Subtitle track "${label}" has no segments`);
    const segmentUrl = new URL(segmentUri, subsPlaylistUrl);

    // KinoPub serves a track's segments under /hls/<track>/seg… and the whole file under /pd/<track>.
    const subPath = segmentUrl.pathname.match(/.*\/hls\/(.*)\/seg.*/)?.[1];
    const subUrl = subPath ? `${segmentUrl.origin}/pd/${subPath}` : segmentUrl.href;

    return parse(await fetchText(subUrl));
  }

  public getSubsContainer() {
    const selector = activePlayer();
    if (selector === null) throw new Error("Subtitles container not found");
    return selector as HTMLElement;
  }

  public getSettingsButtonContainer() {
    // Try multiple selectors for Vidstack controls
    // Vidstack controls are typically inside media-controls with media-controls-group
    const selector = document.querySelector(".control-button.btn-settings");

    if (selector === null)
      throw new Error("Settings button container not found");
    return selector as HTMLElement;
  }

  public getSettingsContentContainer() {
    const selector = activePlayer();
    if (selector === null)
      throw new Error("Settings content container not found");
    return selector as HTMLElement;
  }

  public isOnFlight() {
    return false;
  }

  private handleKinopubFirstFrame(event: CustomEvent) {
    this.videoPlaylistUrl = event.detail;
    if (this.subsName) {
      esSubsChanged(this.subsName);
    }
    esRenderSetings();
  }

  private handleKinopubCaptionsChanged(event: CustomEvent) {
    this.subsName = event.detail;
    esSubsChanged(this.subsName);
    esRenderSetings();
  }

  private injectScript() {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("assets/js/kinopub.js");
    script.type = "module";
    document.head.prepend(script);
  }
}

/** The Vidstack player, or the old layout's #player. */
const activePlayer = () => document.querySelector("media-player") || document.querySelector("#player");

type Playlist = Parser["manifest"];

async function fetchText(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`KinoPub request failed (${resp.status}): ${url}`);
  return resp.text();
}

function parsePlaylist(text: string): Playlist {
  const parser = new Parser();
  parser.push(text);
  parser.end();
  return parser.manifest;
}

/**
 * The subtitle track named `label`, from the group the variants reference. GROUP-ID is chosen by
 * the manifest (RFC 8216 §4.3.4.1), so it is looked up rather than assumed; groups no variant
 * references are tried last.
 */
function findSubtitleTrack(master: Playlist, label: string): { uri?: string } | undefined {
  const groups = (master.mediaGroups?.SUBTITLES ?? {}) as Record<string, Record<string, { uri?: string }>>;
  const referenced = (master.playlists ?? [])
    .map((playlist: { attributes?: { SUBTITLES?: string } }) => playlist.attributes?.SUBTITLES)
    .filter((id: string | undefined): id is string => Boolean(id));
  const groupIds = [...new Set([...referenced, ...Object.keys(groups)])];
  for (const id of groupIds) {
    const track = groups[id]?.[label];
    if (track) return track;
  }
  return undefined;
}

export default KinoPub;
