import { esRenderSetings } from "@src/models/settings";
import Service from "./service";
import { parse } from "subtitle";
import { esSubsChanged, rawSubsAdded } from "@src/models/subs";
import { readCaptionParts, waitForElement, watchCaptionSource } from "./captionObserver";

class Udemy implements Service {
  name = "udemy";

  constructor() {
    waitForElement('[data-purpose="settings-button"]', () => {
      esRenderSetings();
    });
  }

  public init(): void {
    waitForElement("div[class*='captions-display--captions-container']", (subtitleSource) => {
      esSubsChanged("en");
      const videoElement = document.querySelector("video");
      if (!videoElement) return;
      watchCaptionSource({
        source: subtitleSource,
        read: () => readCaptionParts(subtitleSource, '[data-purpose="captions-cue-text"]'),
        currentTime: () => videoElement.currentTime,
        emit: rawSubsAdded,
      });
    });
  }

  public async getSubs(title: string) {
    return parse("");
  }

  public getSubsContainer() {
    const selector = document.querySelector("video[class*='video-player--']").parentElement;
    if (selector === null) throw new Error("Subtitles container not found");
    return selector as HTMLElement;
  }

  public getSettingsButtonContainer() {
    const selector = document.querySelector('[data-purpose="settings-button"]');
    if (selector === null) throw new Error("Settings button container not found");
    return selector as HTMLElement;
  }

  public getSettingsContentContainer() {
    const selector = document.querySelector("video[class*='video-player--']").parentElement;
    if (selector === null) throw new Error("Settings content container not found");
    return selector as HTMLElement;
  }

  public isOnFlight() {
    return true;
  }
}

export default Udemy;
