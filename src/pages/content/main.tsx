import { createRoot, Root } from "react-dom/client";
import refreshOnUpdate from "virtual:reload-on-update-in-view";

import { $streaming, streamingDetected } from "@src/models/streamings";
import { esRenderSetings } from "@src/models/settings";
import { esSubsChanged } from "@src/models/subs";
import { $video, getCurrentVideoFx, videoTimeUpdate } from "@src/models/videos";
import { Settings } from "@src/pages/content/components/Settings";
import { Subs } from "./components/Subs";
import { ProgressBar } from "./components/ProgressBar";
import { removeKeyboardEventsListeners } from "@src/utils/keyboardHandler";
import { removeMouseEventsListeners } from "@src/utils/mouseHandler";
import { getCurrentService } from "@src/utils/getCurrentService";

refreshOnUpdate("pages/content");

const handleTimeUpdate = () => {
  videoTimeUpdate();
};

let videoWatchAttached = false;
let settingsWatchAttached = false;
let initializedService: { name: string } | null = null;

// Removing a root's container does not unmount the tree — detached roots keep their store
// subscriptions, effects and portals alive (duplicated toasts, orphaned panels, stray unpin
// handlers). Keep track of every root and unmount it before re-mounting.
let settingsRoot: Root | null = null;
let subsRoot: Root | null = null;
let progressRoot: Root | null = null;

const unmountSettings = () => {
  settingsRoot?.unmount();
  settingsRoot = null;
  document.querySelectorAll(".es-settings").forEach((e) => e.remove());
};

const unmountSubsUi = () => {
  subsRoot?.unmount();
  subsRoot = null;
  progressRoot?.unmount();
  progressRoot = null;
  document.querySelectorAll("#es").forEach((e) => e.remove());
  document.querySelectorAll(".es-progress-bar").forEach((e) => e.remove());
};

const mountSettings = () => {
  try {
    const streaming = $streaming.getState();
    if (!streaming || streaming.name === "stub") return;

    unmountSettings();
    const buttonContainer = streaming.getSettingsButtonContainer();
    const contentContainer = streaming.getSettingsContentContainer();
    if (!buttonContainer || !contentContainer) {
      console.warn("[himotoki] settings containers not ready yet");
      return;
    }

    const parentNode = buttonContainer.parentNode;
    if (!parentNode) {
      console.warn("[himotoki] settings button parent missing");
      return;
    }

    const settingNode = document.createElement("div");
    settingNode.className = "es-settings";
    parentNode.insertBefore(settingNode, buttonContainer);

    getCurrentVideoFx();
    if (!videoWatchAttached) {
      videoWatchAttached = true;
      $video.watch((video) => {
        video?.removeEventListener("timeupdate", handleTimeUpdate as EventListener);
        video?.addEventListener("timeupdate", handleTimeUpdate as EventListener);
      });
    }
    settingsRoot = createRoot(settingNode);
    settingsRoot.render(<Settings contentContainer={contentContainer} />);
  } catch (error) {
    console.warn("[himotoki] failed to render settings", error);
  }
};

const mountSubsUi = (language: string) => {
  try {
    console.log("Event:", "esSubsChanged", language);
    removeKeyboardEventsListeners();
    removeMouseEventsListeners();
    unmountSubsUi();

    // Empty language = captions off / reset (EasySubs behavior).
    if (!language) return;

    const streaming = $streaming.getState();
    if (!streaming || streaming.name === "stub") return;

    const subsContainer = streaming.getSubsContainer();
    if (!subsContainer) {
      console.warn("[himotoki] subs container not ready yet");
      return;
    }

    const subsNode = document.createElement("div");
    subsNode.id = "es";
    subsContainer.appendChild(subsNode);
    subsRoot = createRoot(subsNode);
    subsRoot.render(<Subs />);

    if (!streaming.isOnFlight()) {
      const progressBarNode = document.createElement("div");
      progressBarNode.classList.add("es-progress-bar");
      subsContainer.appendChild(progressBarNode);
      progressRoot = createRoot(progressBarNode);
      progressRoot.render(<ProgressBar />);
    }
  } catch (error) {
    console.warn("[himotoki] failed to render subs UI", error);
  }
};

$streaming.watch((streaming) => {
  if (!streaming || streaming.name === "stub") return;

  console.log("streaming changed", streaming.name);
  document.body.classList.add("es-" + streaming.name);

  if (!settingsWatchAttached) {
    settingsWatchAttached = true;
    esRenderSetings.watch(mountSettings);
  }

  // Guard by instance identity so listeners always live on the active object.
  if (initializedService === streaming) return;
  initializedService = streaming;

  try {
    streaming.init();
  } catch (error) {
    console.warn("[himotoki] streaming.init failed", error);
  }
});

esSubsChanged.watch(mountSubsUi);

// Detect once synchronously — avoid dual Youtube instances (detect + fetch effect).
try {
  streamingDetected(getCurrentService());
} catch (error) {
  console.warn("[himotoki] service detect failed", error);
}
