import { esRenderSetings } from "@src/models/settings";
import Service from "./service";
import { parse } from "subtitle";
import { esSubsChanged, rawSubsAdded } from "@src/models/subs";
import { readCaptionParts, waitForElement, watchCaptionSource } from "./captionObserver";

class NetflixOnFlight implements Service {
  name = "netflix";

  constructor() {
    setInterval(() => {
      const videoControlContainer = document.querySelector(".watch-video--bottom-controls-container");
      const subsContainer = document.querySelector(".watch-video--player-view");
      const easysubsSettings = document.querySelector(".es-settings");
      if (videoControlContainer && subsContainer && !easysubsSettings) {
        esRenderSetings();
      }
    }, 100);
  }

  public init(): void {
    waitForElement(".player-timedtext", (subtitleSource) => {
      esSubsChanged("en");
      const videoElement = document.querySelector("video");
      if (!videoElement) return;
      watchCaptionSource({
        source: subtitleSource,
        read: () => readCaptionParts(subtitleSource, ".player-timedtext-text-container"),
        currentTime: () => videoElement.currentTime,
        emit: rawSubsAdded,
      });
    });
  }

  public async getSubs(title: string) {
    return parse("");
  }

  public getSubsContainer() {
    const selector = document.querySelector(".watch-video--player-view");
    if (selector === null) throw new Error("Subtitles container not found");
    return selector as HTMLElement;
  }

  public getSettingsButtonContainer() {
    const selector = (
      document.querySelector('[data-uia="control-fullscreen-enter"]') ||
      document.querySelector('[data-uia="control-fullscreen-exit"]')
    ).parentElement;
    if (selector === null) throw new Error("Settings button container not found");
    return selector as HTMLElement;
  }

  public getSettingsContentContainer() {
    const selector = document.querySelector("#appMountPoint");
    if (selector === null) throw new Error("Settings content container not found");
    return selector as HTMLElement;
  }

  public isOnFlight() {
    return true;
  }
}

export default NetflixOnFlight;
