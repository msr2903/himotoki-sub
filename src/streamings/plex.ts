import { esRenderSetings } from "@src/models/settings";
import Service from "./service";
import { parse } from "subtitle";
import { esSubsChanged, rawSubsAdded } from "@src/models/subs";
import { readCaptionParts, waitForElement, watchCaptionSource } from "./captionObserver";

class Plex implements Service {
  name = "plex";

  constructor() {
    setInterval(() => {
      const subtitleContainer = document.querySelector(".libjass-subs");
      const easysubsSettings = document.querySelector(".es-settings");
      if (subtitleContainer && !easysubsSettings) {
        esRenderSetings();
      }
    }, 100);
  }

  public init(): void {
    waitForElement(".libjass-subs", (subtitleSource) => {
      esSubsChanged("en");
      const videoElement = document.querySelector("video");
      if (!videoElement) return;
      watchCaptionSource({
        source: subtitleSource,
        // libjass nests styled spans; each rendered run is read once.
        read: () => readCaptionParts(subtitleSource, "span span", { runs: true }),
        currentTime: () => videoElement.currentTime,
        emit: rawSubsAdded,
      });
    });
  }

  public async getSubs(title: string) {
    return parse("");
  }

  public getSubsContainer() {
    const selector = document.querySelector("div[class*='Player-fullPlayerContainer']");
    if (selector === null) throw new Error("Subtitles container not found");
    return selector as HTMLElement;
  }

  public getSettingsButtonContainer() {
    const selector = document.querySelector('[data-testid="videoSettingsButton"]');
    if (selector === null) throw new Error("Settings button container not found");
    return selector as HTMLElement;
  }

  public getSettingsContentContainer() {
    const selector = document.querySelector("div[class*='Player-fullPlayerContainer']");
    if (selector === null) throw new Error("Settings content container not found");
    return selector as HTMLElement;
  }

  public isOnFlight() {
    return true;
  }
}

export default Plex;
