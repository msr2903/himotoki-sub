// Offline-dictionary smoke test: serves a locally built dictionary (scripts/build-dict.py output)
// with CORS, loads dist/ into Playwright Chromium, installs the dictionary through the extension
// popup page, then times lookups and segment repair through the extension's own message API.
// Usage: pnpm build && node scripts/e2e/dict.mjs [dictDir=/tmp/himotoki-dict]
import assert from "node:assert/strict";
import { chromium } from "playwright";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../dist");
const DICT_DIR = process.argv[2] || "/tmp/himotoki-dict";
const DICT_FILE = "jitendex-lite.sqlite.gz";
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const server = http.createServer((req, res) => {
  const file = path.join(DICT_DIR, path.basename(req.url.split("?")[0]));
  if (!fs.existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/octet-stream",
    "Content-Length": fs.statSync(file).size,
  });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const dictUrl = `http://127.0.0.1:${server.address().port}/${DICT_FILE}`;
log("serving", dictUrl);

const userDataDir = fs.mkdtempSync("/tmp/himotoki-dict-profile-");
const ctx = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
let sw = ctx.serviceWorkers()[0];
if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 20000 });
const extId = new URL(sw.url()).host;
sw.on("console", (m) => log("[SW]", m.type(), m.text()));

const popup = await ctx.newPage();
popup.on("console", (m) => log("[popup]", m.type(), m.text().slice(0, 300)));
popup.on("pageerror", (e) => log("[popup pageerror]", String(e)));
await popup.goto(`chrome-extension://${extId}/src/pages/popup/index.html`);
const send = (msg) => popup.evaluate((m) => chrome.runtime.sendMessage(m), msg);

log("status before:", JSON.stringify(await send({ type: "himotokiDictStatus" })));
await popup.evaluate((u) => chrome.storage.local.set({ himotokiDictUrl: u }), dictUrl);

const t0 = Date.now();
const installPromise = send({ type: "himotokiDictInstall" });
let last = "";
while (true) {
  const st = await send({ type: "himotokiDictStatus" });
  const s = st?.data;
  const line = s ? `${s.state} ${s.received}/${s.total}` : JSON.stringify(st);
  if (line !== last) {
    log("status:", line);
    last = line;
  }
  if (!s || s.state === "ready" || s.state === "error") break;
  await popup.waitForTimeout(1000);
}
const installResp = await installPromise;
log("install result:", JSON.stringify(installResp).slice(0, 300), "in", ((Date.now() - t0) / 1000).toFixed(1), "s");
const status = await send({ type: "himotokiDictStatus" });
log("status after:", JSON.stringify(status));

if (status?.data?.state !== "ready") {
  log("FAIL: dictionary not ready");
  await ctx.close();
  server.close();
  process.exit(1);
}

const probes = ["食べた", "見に行きました", "皆さん", "行きました", "やってんだ", "言われて", "起きたら", "します", "は", "カーテン", "あさごはん", "食べられなかった"];
for (const surface of probes) {
  const t = Date.now();
  const resp = await send({ type: "himotokiLookup", surface });
  const d = resp?.data;
  const best = d?.best;
  assert.equal(resp?.ok, true, `lookup ${surface}: ${resp?.error}`);
  if (["食べた", "皆さん", "行きました", "起きたら", "は", "カーテン", "あさごはん", "食べられなかった"].includes(surface))
    assert.ok(best, `No dictionary match for ${surface}`);
  log(
    `lookup ${surface} (${Date.now() - t} ms):`,
    best
      ? `${best.kanji?.[0] ?? best.readings?.[0]} [${best.readings?.[0] ?? ""}] ${best.senses?.[0]?.glosses?.slice(0, 2).join("; ")}` +
          (d.conj_type ? ` | ${d.source_text} (${d.conj_type})` : "") +
          ` | ${d.entries?.length} entries`
      : `NO RESULT ${JSON.stringify(resp).slice(0, 200)}`,
  );
}

// New grammar endpoint must work with both old and enriched dictionaries.
const verb = await send({ type: "himotokiLookup", surface: "食べた" });
const conj = await send({ type: "himotokiConjTable", seq: verb.data.best.seq });
assert.equal(conj?.ok, true, conj?.error);
assert.ok(conj.data.forms.some((f) => f.form === "食べた"), "Missing past conjugation");
const batch = await send({ type: "himotokiLookupBatch", surfaces: ["食べた", "顔"] });
assert.equal(batch?.ok, true, batch?.error);
assert.equal(batch.data.results.length, 2);
assert.ok(batch.data.results.every((r) => r.best));
const manifest = JSON.parse(fs.readFileSync(path.join(DICT_DIR, "jitendex-lite.json"), "utf8"));
if (manifest.pitchRows && manifest.freqRows && manifest.jlptRows) {
  assert.ok(verb.data.best.pitch_display, "Missing pitch");
  assert.ok(verb.data.best.freq > 0, "Missing frequency");
  assert.ok(verb.data.best.jlpt?.length, "Missing JLPT");
}

// Warm cache: second call should be near-instant
const t1 = Date.now();
await send({ type: "himotokiLookup", surface: "食べた" });
log("cached lookup ms:", Date.now() - t1);

const repairIn = [["朝", "ご飯", "を", "食べる"], ["あさご", "はん", "を"], ["お", "好み", "焼き"], ["皆さん", "は"]];
const t2 = Date.now();
const repair = await send({ type: "himotokiRepairSegments", cues: repairIn });
log("repair (ms):", Date.now() - t2, JSON.stringify(repair?.data?.cues));

assert.equal(repair?.ok, true, repair?.error);
assert.deepEqual(repair.data.cues[0], ["朝ご飯", "を", "食べる"]);

// Popup UI reflects state
await popup.reload();
await popup.waitForTimeout(800);
log("popup text:", (await popup.locator(".es-popup-dict").innerText()).replace(/\n/g, " | "));

// Persistence: relaunch the same profile; the OPFS-backed database must still be there.
await ctx.close();
const ctx2 = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
let sw2 = ctx2.serviceWorkers()[0];
if (!sw2) sw2 = await ctx2.waitForEvent("serviceworker", { timeout: 20000 });
const popup2 = await ctx2.newPage();
await popup2.goto(`chrome-extension://${new URL(sw2.url()).host}/src/pages/popup/index.html`);
const t3 = Date.now();
const after = await popup2.evaluate(() => chrome.runtime.sendMessage({ type: "himotokiDictStatus" }));
log("status after relaunch:", after?.data?.state, after?.data?.terms, "entries; boot ms:", Date.now() - t3);
const t4 = Date.now();
const again = await popup2.evaluate(() => chrome.runtime.sendMessage({ type: "himotokiLookup", surface: "食べた" }));
log("lookup after relaunch (ms):", Date.now() - t4, again?.data?.best?.kanji?.[0]);
assert.equal(again?.ok, true, again?.error);
assert.equal(again.data.best.kanji[0], "食べる");
await ctx2.close();
server.close();
if (after?.data?.state !== "ready") {
  log("FAIL: dictionary did not persist across relaunch");
  process.exit(1);
}
log("done");
