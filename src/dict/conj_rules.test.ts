import { describe, it, expect } from "vitest";
import { deconjugate_recursive } from "./conj_rules";

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
