import Service from "@src/streamings/service";

export const moveVideoToTime = (video: HTMLVideoElement, streaming: Service, time: number) => {
  // `name` is a stable instance field; constructor.name is renamed by minification, which
  // silently routed Netflix seeks to a direct currentTime write the player can't tolerate.
  if (streaming.name === "netflix") {
    window.dispatchEvent(new CustomEvent("esNetflixSeek", { detail: time }));
  } else {
    video.currentTime = time / 1000;
  }
};
