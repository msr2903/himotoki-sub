import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Anki } from "./learning-service/anki";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Runs the unchanged background module statements after removing import declarations.
 * External imports are inert doubles; its actual onMessage handler, fetch chain and
 * actual Anki service are retained. No extension, Anki collection or network is used.
 */
function background(fetchDouble: typeof fetch) {
  const text = readFileSync(new URL("./pages/background/index.ts", import.meta.url), "utf8");
  const file = ts.createSourceFile("background.ts", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const statements = file.statements.filter((n) => !ts.isImportDeclaration(n));
  const printer = ts.createPrinter();
  const stripped = statements.map((n) => printer.printNode(ts.EmitHint.Unspecified, n, file)).join("\n");
  const compiled = ts.transpileModule(stripped, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  let listener: (message: unknown, sender: unknown, respond: (response: unknown) => void) => boolean;
  const chromeDouble = {
    runtime: {
      onMessage: { addListener: (fn: typeof listener) => { listener = fn; } },
      onInstalled: { addListener: vi.fn() },
      sendMessage: (message: unknown) => new Promise((resolve) => {
        expect(listener(message, {}, resolve)).toBe(true);
      }),
    },
    identity: { getRedirectURL: () => "https://fixture.invalid/" },
  };
  vm.runInNewContext(compiled, {
    exports: {}, chrome: chromeDouble, fetch: fetchDouble,
    createHimotokiAccount: () => ({}), reloadOnUpdate: () => {},
    HIMOTOKI_FIREBASE_API_KEY: "fixture", HIMOTOKI_FIREBASE_PROJECT_ID: "fixture",
    Date, setTimeout, clearTimeout,
  });
  vi.stubGlobal("chrome", chromeDouble);
}

describe("audit: Sub Anki requests have no application deadline", () => {
  it.each(["headers", "json-body"] as const)("keeps an addWord pending for 60 seconds on stalled %s", async (stage) => {
    vi.useFakeTimers();
    let release!: (value: unknown) => void;
    const stalled = new Promise((resolve) => { release = resolve; });
    const requests: Array<{ action: string; hasSignal: boolean }> = [];
    const replyFor = (action: string) => ({
      error: null,
      result: action === "modelNames" ? [] : action === "addNote" ? 123 : 1,
    });
    background(vi.fn(async (_url, init) => {
      const action = JSON.parse(String(init?.body)).action as string;
      requests.push({ action, hasSignal: Boolean(init?.signal) });
      if (action === "createDeck") {
        if (stage === "headers") return await stalled as Response;
        return { ok: true, json: () => stalled } as Response;
      }
      return { ok: true, json: async () => replyFor(action) } as Response;
    }));
    let outcome = "pending";
    const save = new Anki().addWord("猫", "cat", { richCards: false })
      .then((value) => { outcome = value; }, (error) => { outcome = String(error); });
    await vi.advanceTimersByTimeAsync(60_000);
    console.log(JSON.stringify({ stage, elapsedMs: 60000, outcome, requests, timerCount: vi.getTimerCount() }));
    expect(outcome).toBe("pending");
    expect(requests).toEqual([{ action: "createDeck", hasSignal: false }]);
    expect(vi.getTimerCount()).toBe(0);
    // Controlled release proves the exact transport/service path can settle normally;
    // the pending state is not a missing test response bridge.
    release(stage === "headers"
      ? { ok: true, json: async () => replyFor("createDeck") }
      : replyFor("createDeck"));
    await save;
    expect(outcome).toBe("Word added to Anki");
  });
});
