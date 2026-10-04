/**
 * Keeps a page's displayed setting in step with chrome.storage: an initial async read, live change
 * events, and local edits. The initial read only applies if nothing newer (a local edit or a change
 * event) arrived while it was in flight, and never after `stop()` (unmount or key change), so a
 * late read can't show an old value while storage holds the new one.
 */
export function syncSetting<T>(opts: {
  read: () => Promise<T>;
  subscribe: (callback: (value: T) => void) => () => void;
  apply: (value: T) => void;
}) {
  let version = 0;
  let stopped = false;
  const unsubscribe = opts.subscribe((value) => {
    version += 1;
    opts.apply(value);
  });
  const readVersion = version;
  void opts.read().then(
    (value) => {
      if (!stopped && version === readVersion) opts.apply(value);
    },
    () => {
      /* keep the current value */
    },
  );
  return {
    /** A local edit supersedes the pending initial read. */
    supersede() {
      version += 1;
    },
    stop() {
      stopped = true;
      unsubscribe();
    },
  };
}
