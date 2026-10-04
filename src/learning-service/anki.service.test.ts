import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Anki, isNoteId, parseAnkiReply } from "./anki";
import { HIMOTOKI_BACK_TEMPLATE, HIMOTOKI_CARD_CSS, HIMOTOKI_FRONT_TEMPLATE } from "@src/utils/ankiNote";

type Request = { action: string; params: Record<string, unknown> };
type Responder = (req: Request) => unknown;

let requests: Request[] = [];

/** AnkiConnect double behind chrome.runtime.sendMessage; `overrides` replace single actions. */
const useAnki = (overrides: Record<string, Responder> = {}) => {
  const defaults: Record<string, Responder> = {
    createDeck: () => ({ result: 1, error: null }),
    modelNames: () => ({ result: ["Basic", "Himotoki"], error: null }),
    modelTemplates: () => ({ result: { Himotoki: { Front: HIMOTOKI_FRONT_TEMPLATE, Back: HIMOTOKI_BACK_TEMPLATE } }, error: null }),
    modelStyling: () => ({ result: { css: HIMOTOKI_CARD_CSS }, error: null }),
    storeMediaFile: (req) => ({ result: req.params.filename, error: null }),
    addNote: () => ({ result: 1700000000000, error: null }),
  };
  const handlers = { ...defaults, ...overrides };
  vi.stubGlobal("chrome", {
    runtime: {
      sendMessage: (msg: { data: Request }) => {
        requests.push(msg.data);
        const handler = handlers[msg.data.action];
        const reply = handler ? handler(msg.data) : { result: null, error: null };
        return reply instanceof Promise ? reply : Promise.resolve(reply);
      },
    },
  });
};

const actions = () => requests.map((r) => r.action);
const addedNote = () => requests.find((r) => r.action === "addNote")?.params.note as {
  fields: Record<string, string>;
};
const save = (extra: Record<string, unknown> = {}, word = "食べた") =>
  new Anki().addWord(word, "to eat", {
    contextSentence: "朝ご飯を食べた。",
    surface: "食べた",
    himotokiSave: { source: "jitendex", seq: 1358280, headword: "食べる", reading: "たべる" },
    ...extra,
  });

beforeEach(() => {
  requests = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("parseAnkiReply / isNoteId", () => {
  it("validates the AnkiConnect envelope", () => {
    expect(parseAnkiReply({ result: 5, error: null })).toEqual({ ok: true, result: 5 });
    expect(parseAnkiReply({ result: null, error: "boom" })).toEqual({ ok: false, error: "boom" });
    expect(parseAnkiReply({ error: "No response within 15 s", timeout: true })).toMatchObject({ ok: false, timeout: true });
    expect(parseAnkiReply(undefined).ok).toBe(false);
    expect(parseAnkiReply({ foo: 1 }).ok).toBe(false);
  });

  it("only accepts a positive numeric note ID", () => {
    expect(isNoteId(1700000000000)).toBe(true);
    expect(isNoteId(null)).toBe(false);
    expect(isNoteId("1")).toBe(false);
    expect(isNoteId(0)).toBe(false);
  });
});

describe("Anki.addWord", () => {
  it("reports success only with a note ID", async () => {
    useAnki();
    await expect(save()).resolves.toBe("Word added to Anki");
  });

  it("rejects when addNote returns no note ID (#123)", async () => {
    useAnki({ addNote: () => ({ result: null, error: null }) });
    await expect(save()).rejects.toMatch(/no note ID/);
  });

  it("rejects a malformed addNote reply (#123)", async () => {
    useAnki({ addNote: () => ({ ok: true }) });
    await expect(save()).rejects.toMatch(/Unexpected response/);
  });

  it("omits media whose storage is not confirmed (#123)", async () => {
    useAnki({ storeMediaFile: () => ({ result: null, error: null }) });
    const result = await save({ audio: { filename: "a.webm", dataBase64: "QQ==" } });
    expect(result).toBe("Word added to Anki");
    expect(addedNote().fields.Audio).toBe("");
  });

  it("keeps the duplicate message", async () => {
    useAnki({ addNote: () => ({ result: null, error: "cannot create note because it is a duplicate" }) });
    await expect(save()).resolves.toBe("Word already exists in Anki");
  });

  it("does not overwrite a customized note type (#124)", async () => {
    useAnki({
      modelTemplates: () => ({ result: { Himotoki: { Front: "{{Word}} custom", Back: "{{Sentence}}" } }, error: null }),
      modelStyling: () => ({ result: { css: ".card { font-size: 40px; }" }, error: null }),
    });
    await save();
    expect(actions()).not.toContain("updateModelTemplates");
    expect(actions()).not.toContain("updateModelStyling");
    expect(actions()).toContain("addNote");
  });

  it("does not rewrite a note type that already has the current design (#124)", async () => {
    useAnki();
    await save();
    expect(actions()).not.toContain("updateModelTemplates");
    expect(actions()).not.toContain("updateModelStyling");
  });

  it("migrates an unmodified earlier built-in stylesheet (#124)", async () => {
    const start = HIMOTOKI_CARD_CSS.indexOf(".hm-senses {");
    const end = HIMOTOKI_CARD_CSS.indexOf(".hm-level {");
    const previousCss = HIMOTOKI_CARD_CSS.slice(0, start) + HIMOTOKI_CARD_CSS.slice(end);
    useAnki({ modelStyling: () => ({ result: { css: previousCss }, error: null }) });
    await save();
    expect(actions()).toContain("updateModelStyling");
    expect(actions()).not.toContain("updateModelTemplates");
  });

  it("creates the note type when it is missing", async () => {
    useAnki({ modelNames: () => ({ result: ["Basic"], error: null }) });
    await save();
    expect(actions()).toContain("createModel");
  });

  it("bolds the conjugated subtitle surface and keeps the lemma as Word (#157)", async () => {
    useAnki();
    await save();
    expect(addedNote().fields.Word).toBe("食べる");
    expect(addedNote().fields.Sentence).toBe("朝ご飯を<b>食べた</b>。");
  });

  it("falls back to the headword when the surface is not in the sentence", async () => {
    useAnki();
    await save({ contextSentence: "毎日食べる。", surface: "たべた" });
    expect(addedNote().fields.Sentence).toBe("毎日<b>食べる</b>。");
  });

  it("gives a timeout hint when Anki does not answer createDeck (#162)", async () => {
    useAnki({ createDeck: () => ({ error: "No response within 15 s", timeout: true }) });
    await expect(save()).rejects.toMatch(/did not respond in time/);
    expect(actions()).toEqual(["createDeck"]);
  });

  it("tells the user to verify Anki when addNote times out, without resubmitting (#162)", async () => {
    useAnki({ addNote: () => ({ error: "No response within 15 s", timeout: true }) });
    await expect(save()).rejects.toMatch(/check Anki before saving again/);
    expect(actions().filter((a) => a === "addNote")).toHaveLength(1);
  });

  it("settles even if the background never answers (#162)", async () => {
    vi.useFakeTimers();
    useAnki({ createDeck: () => new Promise(() => {}) });
    const result = save();
    const settled = expect(result).rejects.toMatch(/did not respond in time/);
    await vi.advanceTimersByTimeAsync(20000);
    await settled;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports a closed message port as a connection error", async () => {
    useAnki({ createDeck: () => Promise.reject(new Error("Could not establish connection. Receiving end does not exist.")) });
    await expect(save()).rejects.toMatch(/Error connecting to Anki/);
  });
});
