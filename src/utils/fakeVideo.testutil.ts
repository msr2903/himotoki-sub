/** A media-clock double for unit tests: an EventTarget with the HTMLVideoElement fields the code reads. */
export class FakeVideo extends EventTarget {
  currentTime = 0;
  seeking = false;
  playbackRate = 1;
  paused = true;
  ended = false;
  pauseCalls = 0;
  playCalls = 0;

  play() {
    this.playCalls++;
    this.paused = false;
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  }

  pause() {
    this.pauseCalls++;
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }

  /** Deliver a `timeupdate` at `ms` media time. */
  tick(ms: number) {
    this.currentTime = ms / 1000;
    this.dispatchEvent(new Event("timeupdate"));
  }

  asVideo() {
    return this as unknown as HTMLVideoElement;
  }
}
