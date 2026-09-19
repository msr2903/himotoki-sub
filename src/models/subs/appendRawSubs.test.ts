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

  it("does not mutate cue objects already in the list (immutability)", () => {
    const first = cue("A", 0, 1000);
    const subs = appendRawSubs([first], [cue("B", 1000, 2000)]);
    // original object untouched…
    expect(first.end).toBe(1000);
    // …and the stored previous cue is a new object with a clamped end.
    expect(subs[0]).not.toBe(first);
    expect(subs[0].end).toBe(subs[0].start);
  });

  it("treats a duplicate of the last cue as a no-op (same reference)", () => {
    const subs: Captions = [cue("A", 0, 1000)];
    const next = appendRawSubs(subs, [cue("A", 0, 1000)]);
    expect(next).toBe(subs);
  });
});
