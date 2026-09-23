import { describe, it, expect } from "vitest";
import { deconjugate_recursive, forward_conjugate } from "./conj_rules";

// Regression for the `str.endswith(tuple)` mis-port at _auxiliary_steps: a past
// form reached through a non-"Past" rule (e.g. passive された) must still record
// the implicit Past (~ta) auxiliary step. Before the fix, `ends_with.endsWith(array)`
// coerced the array to a comma-joined string and never matched, so no Past step
// was ever appended for these forms.

const hasStep = (surface: string, conjType: string): boolean =>
  deconjugate_recursive(surface).some(([, steps]) => steps.some((s) => s.conj_type === conjType));

describe("deconjugate_recursive — implicit past auxiliary", () => {
  it("records a Past (~ta) step for a passive-past form (された)", () => {
    expect(hasStep("愛された", "Passive")).toBe(true);
    expect(hasStep("愛された", "Past (~ta)")).toBe(true);
  });

  it("records a Past (~ta) step for a causative-passive-past form (させられた)", () => {
    expect(hasStep("食べさせられた", "Past (~ta)")).toBe(true);
  });

  it("does not invent a Past (~ta) step for a plain non-past form", () => {
    // Passive non-past: Passive is present, Past must not be.
    expect(hasStep("愛される", "Passive")).toBe(true);
    expect(hasStep("愛される", "Past (~ta)")).toBe(false);
  });
});

const lemmas = (surface: string): string[] => deconjugate_recursive(surface).map(([lemma]) => lemma);

const singleStep = (surface: string, lemma: string, conjType: string): boolean =>
  deconjugate_recursive(surface).some(
    ([l, steps]) => l === lemma && steps.length === 1 && steps[0]!.conj_type === conjType,
  );

describe("deconjugate_recursive — godan past suffixes (#56)", () => {
  it.each([
    ["書いた", "書く"],
    ["泳いだ", "泳ぐ"],
    ["話した", "話す"],
  ])("peels %s back to %s", (surface, lemma) => {
    expect(lemmas(surface)).toContain(lemma);
  });
});

describe("deconjugate_recursive — bare kana past forms (#83)", () => {
  it.each([
    ["いた", "いる"],
    ["みた", "みる"],
  ])("allows strip-た on %s → %s", (surface, lemma) => {
    expect(lemmas(surface)).toContain(lemma);
  });
});

describe("deconjugate_recursive — godan potential (#87)", () => {
  it.each([
    ["勝てる", "勝つ"],
    ["待てる", "待つ"],
    ["帰れる", "帰る"],
  ])("%s has a single-step Potential peel to %s", (surface, lemma) => {
    expect(singleStep(surface, lemma, "Potential")).toBe(true);
  });
});

describe("forward_conjugate — kana くる (#88)", () => {
  it("keeps kana script in derived forms for a kana lemma", () => {
    const forms = forward_conjugate("くる", ["vk"]) as Record<string, string>;
    expect(forms["Polite"]).toBe("きます");
    expect(forms["Past"]).toBe("きた");
    expect(forms["Negative"]).toBe("こない");
    expect(forms["Imperative"]).toBe("こい");
  });

  it("still produces kanji forms for 来る", () => {
    const forms = forward_conjugate("来る", ["vk"]) as Record<string, string>;
    expect(forms["Polite"]).toBe("来ます");
    expect(forms["Past"]).toBe("来た");
  });
});
