function getCaptionTracksFromPage() {
  try {
    const fromInitial =
      window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (Array.isArray(fromInitial) && fromInitial.length) return fromInitial;

    const raw = window.ytplayer?.config?.args?.player_response;
    if (raw) {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const fromConfig = parsed?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (Array.isArray(fromConfig) && fromConfig.length) return fromConfig;
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
