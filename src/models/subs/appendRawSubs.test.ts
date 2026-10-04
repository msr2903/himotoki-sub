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

  describe("seeking backward (#120)", () => {
    const abc = () => [cue("A", 0, 1000), cue("B", 1000, 2000), cue("C", 2000, 3000)];
    const view = (subs: Captions) => subs.map((s) => [s.text, s.start, s.end]);

    it("revisiting an earlier cue keeps the newest one and adds no duplicate", () => {
      const subs = abc();
      expect(appendRawSubs(subs, [cue("A", 0, 100000)])).toBe(subs);
    });

    it("replaying through recorded cues (observer timing jitter) changes nothing", () => {
      let subs = abc();
      const before = subs;
      subs = appendRawSubs(subs, [cue("A", 120, 100120)]);
      subs = appendRawSubs(subs, [cue("B", 1050, 101050)]);
      subs = appendRawSubs(subs, [cue("C", 2040, 102040)]);
      expect(subs).toBe(before);
    });

    it("a new cue at an earlier time is inserted in order, between its neighbours", () => {
      const subs = appendRawSubs([cue("A", 0, 100000), cue("C", 5000, 6000)], [cue("B", 2000, 102000)]);
      expect(view(subs)).toEqual([
        ["A", 0, 2000],
        ["B", 2000, 5000],
        ["C", 5000, 6000],
      ]);
    });

    it("a revision of an earlier cue replaces it in place", () => {
      const subs = appendRawSubs(abc(), [cue("B full line", 1000, 101000)]);
      expect(view(subs)).toEqual([
        ["A", 0, 1000],
        ["B full line", 1000, 2000],
        ["C", 2000, 3000],
      ]);
    });

    it("ignores a cleared caption at an earlier time", () => {
      const subs = abc();
      expect(appendRawSubs(subs, [cue("", 1500, 1500)])).toBe(subs);
    });

    it("continuing past the newest cue appends again", () => {
      let subs = appendRawSubs(abc(), [cue("A", 0, 100000)]);
      subs = appendRawSubs(subs, [cue("D", 3500, 103500)]);
      expect(subs.map((s) => s.text)).toEqual(["A", "B", "C", "D"]);
    });
  });
});
