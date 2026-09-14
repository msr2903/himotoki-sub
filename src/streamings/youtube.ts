import { parse, subTitleType } from "subtitle";

import { esSubsChanged } from "@src/models/subs";
import { esRenderSetings } from "@src/models/settings";
import Service from "./service";

type YoutubeSubtitle = {
  dDurationMs: number;
  tStartMs: number;
  segs:
    | {
        utf8: string;
        tOffsetMs?: number;
      }[]
    | undefined;
};

type CaptionTrack = {
  baseUrl: string;
  languageCode?: string;
  vssId?: string;
  name?: { simpleText?: string } | string;
};

const JP_LANGS = ["ja", "ja-JP"];

/** True when a timedtext URL carries YouTube's PO token; token-less URLs return empty bodies. */
const hasPoToken = (url: string): boolean => /[?&]pot=/.test(url);

/** Query params the player adds to its own timedtext requests; needed on any track URL we build ourselves. */
const PLAYER_PARAMS = ["pot", "potc", "xorb", "xobt", "xovt", "c", "cver", "cplayer", "cos", "cosver", "cplatform", "cbrand", "cbr", "cbrver"];

const withPlayerParams = (targetUrl: string, sourceUrl: string): string => {
  const target = new URL(targetUrl, "https://www.youtube.com");
  const source = new URL(sourceUrl, "https://www.youtube.com");
  for (const key of PLAYER_PARAMS) {
    const value = source.searchParams.get(key);
    if (value && !target.searchParams.has(key)) target.searchParams.set(key, value);
  }
  return target.href;
};

class Youtube implements Service {
  name = "youtube";

  private subCache: {
    [videoId: string]: {
      [lang: string]: string;
    };
  };
  private captionTracks: CaptionTrack[] = [];
  private lastVideoId = "";
  /** Resolvers waiting for the player to fetch a given language's timedtext URL. */
  private captionsDataWaiters = new Map<string, Array<(url: string) => void>>();
  /** Last (videoId, label) handed to esSubsChanged; repeats would rebuild the whole subtitle UI. */
  private lastEmitted: { videoId: string; label: string } | null = null;

  /**
   * The player requests timedtext repeatedly (seeks, quality changes, CC toggles). Each emit
   * refetches captions and remounts every subtitle token, so only emit when something changed.
   */
  private emitSubsChanged(label: string): void {
    const videoId = this.getVideoId();
    const mounted = Boolean(document.getElementById("es"));
    if (mounted && this.lastEmitted && this.lastEmitted.videoId === videoId && this.lastEmitted.label === label) return;
    this.lastEmitted = { videoId, label };
    esSubsChanged(label);
  }

  constructor() {
    this.subCache = {};
    this.handleCaptionsData = this.handleCaptionsData.bind(this);
    this.handleCaptionsChanges = this.handleCaptionsChanges.bind(this);
    this.handleCaptionTracks = this.handleCaptionTracks.bind(this);
    this.handleLoaded = this.handleLoaded.bind(this);
  }

  public init(): void {
    this.injectScript();
    window.addEventListener("esYoutubeCaptionsData", this.handleCaptionsData as EventListener);
    window.addEventListener("esYoutubeCaptionsChanged", this.handleCaptionsChanges as EventListener);
    window.addEventListener("esYoutubeCaptionTracks", this.handleCaptionTracks as EventListener);
    window.addEventListener("esYoutubeLoaded", this.handleLoaded as EventListener);
  }

  public async getSubs(label: string) {
    const videoId = this.getVideoId();
    if (!videoId) return parse("");
    if (!label) return parse("");

    this.ensureVideoCache(videoId);

    const preferJa = label === "ja" || label.startsWith("ja");
    const langCandidates = preferJa ? [...JP_LANGS, label] : [label, ...JP_LANGS];

    // 1. URLs the player itself fetched (they carry the PO token) always work.
    for (const lang of langCandidates) {
      const cached = this.subCache[videoId]?.[lang];
      if (!cached || !hasPoToken(cached)) continue;
      try {
        const subs = await this.fetchTimedtextJson(cached);
        if (subs.length > 0) return subs;
      } catch (error) {
        console.warn("[himotoki] cached timedtext failed", lang, error);
      }
    }

    // 2. Ask the player to load the wanted track so it fetches it with a PO token.
    const tracks = this.getCaptionTracks();
    for (const lang of langCandidates) {
      const track = this.pickCaptionTrack(tracks, [lang]);
      if (!track?.languageCode) continue;
      const url = await this.requestPlayerTrack(videoId, track.languageCode);
      if (!url) continue;
      try {
        const subs = await this.fetchTimedtextJson(url);
        if (subs.length > 0) return subs;
      } catch (error) {
        console.warn("[himotoki] player-loaded timedtext failed", lang, error);
      }
    }

    // 3. Token-less attempts (older videos still serve these).
    for (const lang of langCandidates) {
      const cached = this.subCache[videoId]?.[lang];
      if (!cached) continue;
      try {
        const subs = await this.fetchTimedtextJson(cached);
        if (subs.length > 0) return subs;
      } catch (error) {
        console.warn("[himotoki] cached timedtext failed", lang, error);
      }
    }

    const fromPlayer = await this.fetchCaptionsFromPlayer(videoId, langCandidates);
    if (fromPlayer.length > 0) return fromPlayer;

    const cachedLangs = Object.keys(this.subCache[videoId] || {});
    for (const lang of cachedLangs) {
      if (langCandidates.includes(lang)) continue;
      try {
        const subs = await this.fetchTimedtextJson(this.subCache[videoId][lang]);
        if (subs.length > 0) return subs;
      } catch {
        // ignore
      }
    }

    const anyTrack = this.getCaptionTracks()[0];
    if (anyTrack?.baseUrl) {
      try {
        return await this.fetchTimedtextJson(anyTrack.baseUrl);
      } catch {
        // ignore
      }
    }

    return parse("");
  }

  /**
   * Second subtitle line. Prefers a real track in `language`; otherwise YouTube's own translation of
   * the Japanese track (`tlang`). Both reuse the PO token from a URL the player already fetched.
   */
  public async getSecondarySubs(language: string): Promise<subTitleType[]> {
    const videoId = this.getVideoId();
    if (!videoId || !language) return [];
    const cache = this.subCache[videoId] || {};
    const tokenUrl = Object.values(cache).find(hasPoToken);
    if (!tokenUrl) return [];

    const track = this.pickCaptionTrack(this.getCaptionTracks(), [language]);
    if (track?.baseUrl && !JP_LANGS.includes(track.languageCode ?? "")) {
      try {
        const subs = await this.fetchTimedtextJson(withPlayerParams(track.baseUrl, tokenUrl));
        if (subs.length) return subs;
      } catch (error) {
        console.warn("[himotoki] secondary track failed", language, error);
      }
    }

    const jaUrl = [cache.ja, cache["ja-JP"], tokenUrl].find((u) => u && hasPoToken(u));
    if (!jaUrl) return [];
    try {
      const translated = new URL(jaUrl);
      translated.searchParams.set("tlang", language);
      return await this.fetchTimedtextJson(translated.href);
    } catch (error) {
      console.warn("[himotoki] secondary auto-translation failed", language, error);
      return [];
    }
  }

  /**
   * Make the YouTube player select `languageCode`; resolve with the timedtext URL it fetches
   * (captured by the injected hooks), or null on timeout. The player's URL carries the PO token
   * that direct fetches lack.
   */
  private requestPlayerTrack(videoId: string, languageCode: string, timeoutMs = 8000): Promise<string | null> {
    const existing = this.subCache[videoId]?.[languageCode];
    if (existing && hasPoToken(existing)) return Promise.resolve(existing);

    return new Promise<string | null>((resolve) => {
      const waiters = this.captionsDataWaiters.get(languageCode) ?? [];
      let settled = false;
      const select = () =>
        window.dispatchEvent(new CustomEvent("esYoutubeSelectTrack", { detail: languageCode }));
      // The player ignores setOption until it has started; keep asking until the URL shows up.
      const retry = window.setInterval(select, 1000);
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        window.clearInterval(retry);
        resolve(null);
      }, timeoutMs);
      waiters.push((url) => {
        if (settled) return;
        settled = true;
        window.clearInterval(retry);
        window.clearTimeout(timer);
        resolve(url);
      });
      this.captionsDataWaiters.set(languageCode, waiters);
      select();
    });
  }

  private ensureVideoCache(videoId: string) {
    if (!videoId) return;
    if (this.lastVideoId !== videoId) {
      this.lastVideoId = videoId;
      this.captionTracks = [];
      this.lastEmitted = null;
      this.subCache[videoId] = this.subCache[videoId] || {};
    }
  }

  private getCaptionTracks(): CaptionTrack[] {
    return this.captionTracks;
  }

  private pickCaptionTrack(tracks: CaptionTrack[], langs: string[]): CaptionTrack | undefined {
    const normalized = langs.map((l) => l.toLowerCase());
    return (
      tracks.find((t) => normalized.includes((t.languageCode ?? "").toLowerCase())) ||
      tracks.find((t) => normalized.some((l) => (t.vssId ?? "").toLowerCase().includes(`.${l}`))) ||
      tracks.find((t) => normalized.some((l) => (t.vssId ?? "").toLowerCase().includes(`a.${l}`)))
    );
  }

  private async fetchCaptionsFromPlayer(videoId: string, langs: string[]): Promise<subTitleType[]> {
    const tracks = this.getCaptionTracks();
    if (!tracks.length) return [];

    const track = this.pickCaptionTrack(tracks, langs) || tracks[0];
    if (!track?.baseUrl) return [];

    this.subCache[videoId] = this.subCache[videoId] || {};
    if (track.languageCode) {
      this.subCache[videoId][track.languageCode] = track.baseUrl;
    }
    for (const lang of langs) {
      this.subCache[videoId][lang] = track.baseUrl;
    }

    try {
      return await this.fetchTimedtextJson(track.baseUrl);
    } catch (error) {
      console.warn("[himotoki] player caption fetch failed", error);
      return [];
    }
  }

  private async fetchTimedtextJson(baseUrl: string): Promise<subTitleType[]> {
    const url = new URL(baseUrl, "https://www.youtube.com");
    url.searchParams.set("fmt", "json3");

    const resp = await fetch(url.href);
    if (!resp.ok) {
      throw new Error(`timedtext fetch failed: ${resp.status}`);
    }

    const bodyText = await resp.text();
    if (!bodyText.trim()) {
      // YouTube answers 200 with an empty body when the PO token ("pot") is missing.
      throw new Error("timedtext returned an empty body (missing PO token)");
    }

    const respJson: { events?: YoutubeSubtitle[] } = JSON.parse(bodyText);
    const events = respJson.events ?? [];

    return events
      .map((sub) => {
        if (!sub.segs?.length) {
          return {
            start: sub.tStartMs,
            end: sub.tStartMs + (sub.dDurationMs || 0),
            text: "",
          };
        }

        const lastSeg = sub.segs[sub.segs.length - 1];
        const end =
          typeof lastSeg?.tOffsetMs === "number"
            ? lastSeg.tOffsetMs + sub.tStartMs
            : sub.tStartMs + (sub.dDurationMs || 0);

        return {
          start: sub.tStartMs,
          end,
          text: sub.segs.map((seg) => seg.utf8).join(""),
        };
      })
      .filter((sub) => sub.text.trim().length > 0);
  }

  public getSubsContainer(): HTMLElement | null {
    return (document.querySelector(".html5-video-player") as HTMLElement) || null;
  }

  public getSettingsButtonContainer(): HTMLElement | null {
    return (
      (document.querySelector(".ytp-right-controls .ytp-size-button") as HTMLElement) ||
      (document.querySelector(".ytp-right-controls") as HTMLElement) ||
      null
    );
  }

  public getSettingsContentContainer(): HTMLElement | null {
    return (document.querySelector(".html5-video-player") as HTMLElement) || null;
  }

  public isOnFlight() {
    return false;
  }

  private getVideoId(): string {
    const regExpression = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = window.location.href.match(regExpression);
    if (match && match[2].length === 11) {
      return match[2];
    }
    return "";
  }

  private hasJapaneseTrack(): boolean {
    return Boolean(this.pickCaptionTrack(this.getCaptionTracks(), JP_LANGS));
  }

  /** Himotoki: prefer JP when available, otherwise keep YouTube's active lang. */
  private preferredSubsLabel(youtubeLang: string): string {
    if (this.hasJapaneseTrack()) return "ja";
    return youtubeLang || "ja";
  }

  private handleCaptionsData(event: CustomEvent): void {
    try {
      const urlObject = new URL(event.detail);
      const lang = urlObject.searchParams.get("tlang") || urlObject.searchParams.get("lang") || "";
      const videoId = urlObject.searchParams.get("v") || this.getVideoId();
      if (!videoId || !lang) return;
      this.ensureVideoCache(videoId);
      this.subCache[videoId] = this.subCache[videoId] || {};
      // Never overwrite a token-bearing URL with a token-less one.
      const previous = this.subCache[videoId][lang];
      if (!previous || hasPoToken(urlObject.href) || !hasPoToken(previous)) {
        this.subCache[videoId][lang] = urlObject.href;
      }
      if (hasPoToken(urlObject.href)) {
        const waiters = this.captionsDataWaiters.get(lang);
        if (waiters?.length) {
          this.captionsDataWaiters.delete(lang);
          waiters.forEach((resolve) => resolve(urlObject.href));
        }
      }
    } catch (error) {
      console.warn("[himotoki] failed to cache caption url", error);
    }
  }

  private handleCaptionsChanges(event: CustomEvent): void {
    const lang = (event.detail as string) || "";
    // User turned CC off — keep Himotoki JP overlay if a JP track exists.
    if (!lang) {
      if (this.hasJapaneseTrack()) {
        this.emitSubsChanged("ja");
        return;
      }
      this.emitSubsChanged("");
      return;
    }
    this.emitSubsChanged(this.preferredSubsLabel(lang));
  }

  private handleCaptionTracks(event: CustomEvent): void {
    const tracks = event.detail as CaptionTrack[];
    if (!Array.isArray(tracks) || !tracks.length) return;

    const videoId = this.getVideoId();
    if (!videoId) return;

    // Only clear tracks when the video id changes (SPA navigation).
    if (this.lastVideoId && this.lastVideoId !== videoId) {
      this.captionTracks = [];
      this.lastEmitted = null;
    }
    this.lastVideoId = videoId;
    this.subCache[videoId] = this.subCache[videoId] || {};
    this.captionTracks = tracks;

    this.emitSubsChanged(this.preferredSubsLabel(tracks[0]?.languageCode || "ja"));
  }

  private handleLoaded() {
    // EasySubs only rendered settings here. Do NOT clear captionTracks —
    // youtube.js publishes tracks before this event.
    esRenderSetings();

    const videoId = this.getVideoId();
    if (!videoId) return;

    // If tracks already arrived, ensure subs are requested.
    if (this.captionTracks.length) {
      this.emitSubsChanged(this.preferredSubsLabel("ja"));
    }
  }

  private injectScript() {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("assets/js/youtube.js");
    script.type = "module";
    document.head.prepend(script);
  }
}

export default Youtube;
