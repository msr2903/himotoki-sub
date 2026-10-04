import { esRenderSetings } from "@src/models/settings";
import Service from "./service";
import { parse } from "subtitle";
import { esSubsChanged, rawSubsAdded } from "@src/models/subs";
import { $video } from "@src/models/videos";
import { readCaptionParts, waitForElement, watchCaptionSource } from "./captionObserver";

class Kinopoisk implements Service {
  name = "kinopoisk";

  /** Bumped per video; a wait or observer started for an earlier video is no longer current. */
  private generation = 0;
  private stopCaptions: (() => void) | null = null;

  constructor() {
    waitForElement('[data-tid="SettingPopupButton"]', () => {
      esRenderSetings();
    });
  }

  public init(): void {
    $video.watch((video) => {
      this.stopCaptions?.();
      this.stopCaptions = null;
      const generation = ++this.generation;
      if (!video) return;
      esSubsChanged("en");
      waitForElement(
        'div[data-tid="SubtitlesPortalRoot"]',
        (subtitleSource) => {
          this.stopCaptions = watchCaptionSource({
            source: subtitleSource,
            read: () => readCaptionParts(subtitleSource, "div[class*='Subtitles_text']"),
            currentTime: () => video.currentTime,
            emit: rawSubsAdded,
          });
        },
        () => generation === this.generation,
      );
    });
  }

  public async getSubs(title: string) {
    return parse("");
  }

  public getSubsContainer() {
    const selector = document.querySelector("div[class*='styles_controlsLayer']");
    if (selector === null) throw new Error("Subtitles container not found");
    return selector as HTMLElement;
  }

  public getSettingsButtonContainer() {
    const selector = document.querySelector('[data-tid="SettingPopupButton"]');
    if (selector === null) throw new Error("Settings button container not found");
    return selector as HTMLElement;
  }

  public getSettingsContentContainer() {
    const selector = document.querySelector("yaplayertag");
    if (selector === null) throw new Error("Settings content container not found");
    return selector as HTMLElement;
  }

  public isOnFlight() {
    return true;
  }
}

export default Kinopoisk;
