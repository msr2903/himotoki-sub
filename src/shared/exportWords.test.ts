import { describe, it, expect } from "vitest";
import { parseKey, buildRows, toCsv, toJson } from "./exportWords";

describe("parseKey", () => {
  it("parses an hw: key", () => {
    expect(parseKey("hw:顔")).toEqual({ headword: "顔", source: "", seq: "" });
  });

  it("parses a seq: key", () => {
    expect(parseKey("seq:jitendex:1217730")).toEqual({ headword: "", source: "jitendex", seq: "1217730" });
  });

  it("treats an unknown form as a headword", () => {
    expect(parseKey("猫")).toEqual({ headword: "猫", source: "", seq: "" });
  });
});

describe("buildRows", () => {
  it("returns [] for empty input", () => {
    expect(buildRows([], {})).toEqual([]);
  });

  it("marks known keys and applies the status map", () => {
    const rows = buildRows(["hw:顔"], { "seq:jitendex:1": "learning" });
    expect(rows).toContainEqual({ key: "hw:顔", headword: "顔", source: "", seq: "", status: "known" });
    expect(rows).toContainEqual({ key: "seq:jitendex:1", headword: "", source: "jitendex", seq: "1", status: "learning" });
  });

  it("dedupes a key present in both inputs, status wins", () => {
    const rows = buildRows(["hw:顔"], { "hw:顔": "ignored" });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("ignored");
  });
});

describe("toCsv", () => {
  it("emits a header and escapes commas/quotes", () => {
    const csv = toCsv([{ key: "hw:a,b", headword: 'x"y', source: "", seq: "", status: "known" }]);
    const [header, row] = csv.split("\n");
    expect(header).toBe("key,headword,source,seq,status");
    expect(row).toBe('"hw:a,b","x""y",,,known');
  });
});

describe("toJson", () => {
  it("is valid JSON round-tripping the rows", () => {
    const rows = buildRows(["hw:顔"], {});
    expect(JSON.parse(toJson(rows))).toEqual(rows);
  });
});
