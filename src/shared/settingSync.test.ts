import { describe, expect, it } from "vitest";
import { syncSetting } from "./settingSync";

/** A deferred initial read plus a controllable change channel, like chrome.storage. */
function harness<T>() {
  let release!: (v: T) => void;
  let fail!: (e: unknown) => void;
  const listeners = new Set<(v: T) => void>();
  const shown: T[] = [];
  const s = syncSetting<T>({
    read: () =>
      new Promise<T>((resolve, reject) => {
        release = resolve;
        fail = reject;
      }),
    subscribe: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    apply: (v) => shown.push(v),
  });
  const emit = (v: T) => listeners.forEach((cb) => cb(v));
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return { s, shown, emit, flush, release: (v: T) => release(v), fail: (e: unknown) => fail(e), listeners };
}

describe("syncSetting (#107)", () => {
  it("applies the initial read when nothing newer happened", async () => {
    const h = harness<string>();
    h.release("stored");
    await h.flush();
    expect(h.shown).toEqual(["stored"]);
  });

  it("ignores a late initial read after a local edit and its change event", async () => {
    const h = harness<string>();
    h.s.supersede(); // update("new-choice")
    h.emit("new-choice");
    h.release("old-choice");
    await h.flush();
    expect(h.shown.at(-1)).toBe("new-choice");
    expect(h.shown).not.toContain("old-choice");
  });

  it("ignores a late initial read after a local edit alone (endpoint URL)", async () => {
    const h = harness<string>();
    h.s.supersede();
    h.release("https://old.example/dict.sqlite");
    await h.flush();
    expect(h.shown).toEqual([]);
  });

  it("ignores a late initial read after a change from another page", async () => {
    const h = harness<string>();
    h.emit("from-other-tab");
    h.release("old");
    await h.flush();
    expect(h.shown).toEqual(["from-other-tab"]);
  });

  it("applies nothing after stop (unmount or key change)", async () => {
    const h = harness<string>();
    h.s.stop();
    expect(h.listeners.size).toBe(0);
    h.release("old-key-value");
    await h.flush();
    expect(h.shown).toEqual([]);
  });

  it("keeps the current value when the read fails", async () => {
    const h = harness<string>();
    h.fail(new Error("storage unavailable"));
    await h.flush();
    expect(h.shown).toEqual([]);
    h.emit("later");
    expect(h.shown).toEqual(["later"]);
  });
});
