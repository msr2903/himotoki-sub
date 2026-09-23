function videoIdFromUrl() {
  const m = location.href.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|live\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/);
  return m && m[2].length === 11 ? m[2] : "";
}

function captionTracksFromResponse(resp) {
  if (!resp) return [];
  // During SPA navigation a stale response still describes the previous video — only
  // trust it when its videoId matches the URL (or the URL carries no id to compare).
  const vid = resp.videoDetails && resp.videoDetails.videoId;
  const urlVid = videoIdFromUrl();
  if (vid && urlVid && vid !== urlVid) return [];
  const tracks = resp.captions && resp.captions.playerCaptionsTracklistRenderer
    ? resp.captions.playerCaptionsTracklistRenderer.captionTracks
    : null;
  return Array.isArray(tracks) && tracks.length ? tracks : [];
}

function getCaptionTracksFromPage() {
  try {
    // movie_player.getPlayerResponse() is live and follows SPA navigation;
    // ytInitialPlayerResponse is only written on the initial document load and goes stale.
    const player = document.getElementById("movie_player");
    const live =
      player && typeof player.getPlayerResponse === "function" ? player.getPlayerResponse() : null;
    const fromPlayer = captionTracksFromResponse(live);
    if (fromPlayer.length) return fromPlayer;

    const fromInitial = captionTracksFromResponse(window.ytInitialPlayerResponse);
    if (fromInitial.length) return fromInitial;

    const raw = window.ytplayer?.config?.args?.player_response;
    if (raw) {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const fromConfig = captionTracksFromResponse(parsed);
      if (fromConfig.length) return fromConfig;
    }
  } catch {
    // player response not ready yet
  }
  return [];
}

let lastPublishedBaseUrl = "";

function publishCaptionTracks() {
  const tracks = getCaptionTracksFromPage();
  if (!tracks.length) return;

  const firstUrl = tracks[0]?.baseUrl || "";
  if (firstUrl && firstUrl === lastPublishedBaseUrl) return;
  lastPublishedBaseUrl = firstUrl;

  const compact = tracks.map((t) => ({
    baseUrl: t.baseUrl,
    languageCode: t.languageCode,
    vssId: t.vssId,
    name: t.name?.simpleText || t.name,
  }));
  window.dispatchEvent(new CustomEvent("esYoutubeCaptionTracks", { detail: compact }));
}

function notifyTimedtext(url) {
  try {
    if (!url || typeof url !== "string") return;
    if (!url.includes("/api/timedtext")) return;
    const urlObject = new URL(url, location.origin);
    window.subtitlesEnabled = true;
    const lang = urlObject.searchParams.get("tlang") || urlObject.searchParams.get("lang") || "";
    window.dispatchEvent(new CustomEvent("esYoutubeCaptionsData", { detail: urlObject.href }));
    window.dispatchEvent(new CustomEvent("esYoutubeCaptionsChanged", { detail: lang }));
  } catch {
    // ignore malformed urls
  }
}

window.setInterval(() => {
  const player = document.getElementById("movie_player");
  const subsToggleElement = document.querySelector(".ytp-subtitles-button");

  if (player) {
    if (!window.isLoaded) {
      window.isLoaded = true;
      lastPublishedBaseUrl = "";
      publishCaptionTracks();
      window.dispatchEvent(new CustomEvent("esYoutubeLoaded"));

      if (subsToggleElement && subsToggleElement.getAttribute("aria-pressed") === "true") {
        player.toggleSubtitles();
        player.toggleSubtitles();
      }
      // Do not dispatch empty captionsChanged on first load — Himotoki auto-loads
      // from caption tracks. EasySubs used "" to reset; that wiped our JP overlay.
    } else {
      publishCaptionTracks();
    }
  } else {
    window.isLoaded = false;
    lastPublishedBaseUrl = "";
  }

  if (subsToggleElement) {
    if (window.subtitlesEnabled && subsToggleElement.getAttribute("aria-pressed") === "false") {
      window.subtitlesEnabled = false;
      window.dispatchEvent(new CustomEvent("esYoutubeCaptionsChanged", { detail: "" }));
    }
  }
}, 500);

// EasySubs-compatible XHR hook (primary timedtext capture path).
((open) => {
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      notifyTimedtext(String(url));
    } catch {
      // ignore
    }
    // Preserve EasySubs arity: async=true when not provided.
    if (rest.length === 0) {
      return open.call(this, method, url, true);
    }
    return open.call(this, method, url, ...rest);
  };
})(XMLHttpRequest.prototype.open);

// Content script asks the player to load a caption track. The player then fetches
// /api/timedtext with its own PO token ("pot"), which the hooks below capture. Fetching a
// track URL without that token returns an empty 200 body.
window.addEventListener("esYoutubeSelectTrack", (event) => {
  const languageCode = typeof event.detail === "string" ? event.detail : "";
  const player = document.getElementById("movie_player");
  if (!player || !languageCode) return;
  try {
    if (typeof player.loadModule === "function") player.loadModule("captions");
    if (typeof player.setOption === "function") {
      player.setOption("captions", "track", { languageCode });
    }
  } catch {
    // player API not ready
  }
});

// Modern YouTube often uses fetch for timedtext — observe only, don't break Request objects.
((originalFetch) => {
  window.fetch = function (input, init) {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input && typeof input.url === "string"
              ? input.url
              : "";
      notifyTimedtext(url);
    } catch {
      // ignore
    }
    return originalFetch.apply(this, arguments);
  };
})(window.fetch);
