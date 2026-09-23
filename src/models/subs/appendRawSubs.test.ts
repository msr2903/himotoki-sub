import { describe, it, expect } from "vitest";
import { appendRawSubs } from "./appendRawSubs";
import { Captions } from "../types";

const cue = (text: string, start: number, end: number): Captions[number] =>
  ({ text, start, end }) as Captions[number];

describe("appendRawSubs", () => {
  it("appends sequential incremental cues instead of replacing", () => {
    let subs: Captions = [];
    subs = appendRawSubs(subs, [cue("A", 0, 1000)]);
    subs = appendRawSubs(subs, [cue("B", 1000, 2000)]);
    subs = appendRawSubs(subs, [cue("C", 2000, 3000)]);
    expect(subs.map((s) => s.text)).toEqual(["A", "B", "C"]);
  });

  it("clamps the previous cue's end to the new cue's start, not to zero (#70)", () => {
    const first = cue("A", 0, 5000);
    const subs = appendRawSubs([first], [cue("B", 1000, 2000)]);
    // original object untouched…
    expect(first.end).toBe(5000);
    // …and the stored previous cue ends where the next cue starts, keeping it visible.
    expect(subs[0]).not.toBe(first);
    expect(subs[0].end).toBe(1000);
  });

  it("keeps the previous cue's real end when it does not overlap the new one", () => {
    const subs = appendRawSubs([cue("A", 0, 500)], [cue("B", 1000, 2000)]);
    expect(subs[0].end).toBe(500);
  });

  it("replaces the last cue when a revised cue reuses its start (#70)", () => {
    const subs = appendRawSubs([cue("A partial", 0, 1000)], [cue("A full line", 0, 2000)]);
    expect(subs.map((s) => s.text)).toEqual(["A full line"]);
  });

  it("treats a duplicate of the last cue as a no-op (same reference)", () => {
    const subs: Captions = [cue("A", 0, 1000)];
    const next = appendRawSubs(subs, [cue("A", 0, 1000)]);
    expect(next).toBe(subs);
  });
});
