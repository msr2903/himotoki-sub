import { describe, it, expect } from "vitest";
import { parseAnkiTags } from "./ankiSettings";

describe("parseAnkiTags", () => {
  it("splits on spaces and commas and drops empties", () => {
    expect(parseAnkiTags("himotoki mining, jp")).toEqual(["himotoki", "mining", "jp"]);
    expect(parseAnkiTags("  himotoki ,, mining  ")).toEqual(["himotoki", "mining"]);
  });

  it("returns an empty list for blank input", () => {
    expect(parseAnkiTags("")).toEqual([]);
    expect(parseAnkiTags("   ")).toEqual([]);
  });
});
