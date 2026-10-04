import { esRenderSetings } from "@src/models/settings";
import Service from "./service";
import { parse } from "subtitle";
import { esSubsChanged, rawSubsAdded } from "@src/models/subs";
import { $video } from "@src/models/videos";
import { readCaptionParts, waitForElement, watchCaptionSource } from "./captionObserver";

class Amazon implements Service {
  name = "amazon";

  /** Bumped per video; a wait or observer started for an earlier video is no longer current. */
  private generation = 0;
  private stopCaptions: (() => void) | null = null;

  constructor() {
    waitForElement("#dv-web-player video", () => esRenderSetings(), undefined, hasSource);
  }

  public init(): void {
    $video.watch((video) => {
      // Each video owns one caption observer; the previous video's stops before anything else runs.
      this.stopCaptions?.();
      this.stopCaptions = null;
      const generation = ++this.generation;
      if (!video) return;
      const isCurrent = () => generation === this.generation;
      waitForElement(
        "#dv-web-player video, .tst-video-overlay-player-html5",
        () => {
          esSubsChanged("en");
          const subtitleSource = document.querySelector(".atvwebplayersdk-captions-overlay");
          if (!subtitleSource) return;
          this.stopCaptions = watchCaptionSource({
            source: subtitleSource,
            read: () => readCaptionParts(subtitleSource, ".atvwebplayersdk-captions-text"),
            currentTime: () => video.currentTime,
            emit: rawSubsAdded,
          });
        },
        isCurrent,
        hasSource,
      );
    });
  }

  public async getSubs(title: string) {
    return parse("");
  }

  public getSubsContainer() {
    const selector = document.querySelector(".atvwebplayersdk-overlays-container");
    if (selector === null) throw new Error("Subtitles container not found");
    return selector as HTMLElement;
  }

  public getSettingsButtonContainer() {
    const selector = document.querySelector(".atvwebplayersdk-options-wrapper");
    if (selector === null) throw new Error("Settings button container not found");
    return selector as HTMLElement;
  }

  public getSettingsContentContainer() {
    const selector = document.querySelector(".atvwebplayersdk-overlays-container");
    if (selector === null) throw new Error("Settings content container not found");
    return selector as HTMLElement;
  }

  public isOnFlight() {
    return true;
  }
}

const hasSource = (element: Element) => (element as HTMLMediaElement).src !== "";

export default Amazon;
