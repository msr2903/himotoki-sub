// Deterministic browser tests of the real React components and Effector models.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { chromium } from "playwright";
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "himotoki-regressions-"));
const ext = path.join(temp, "extension");
fs.cpSync(path.join(root, "dist"), ext, { recursive: true });
await build({ entryPoints: [path.join(root, "scripts/e2e/fixtures/regressions.tsx")], bundle: true, outfile: path.join(ext, "audit.js"), format: "iife", platform: "browser", define: { "process.env.NODE_ENV": '"production"' }, alias: { "@src": path.join(root, "src") } });
fs.writeFileSync(path.join(ext, "audit.html"), '<html><head><meta charset="utf-8"></head><body><input id="typing"><div id="root"></div><script src="audit.js"></script></body></html>');
const ctx = await chromium.launchPersistentContext(path.join(temp, "profile"), { headless: false, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`] });
try {
  const sw = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent("serviceworker", { timeout: 20000 });
  const page = await ctx.newPage();
  const errors = [];
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => { errors.push(String(e)); console.error(e); });
  await page.goto(`chrome-extension://${new URL(sw.url()).host}/audit.html`);
  await page.waitForFunction(() => window.audit);
  // Let settings rehydrate before changing them.
  await page.waitForTimeout(200);
  const checks = await page.evaluate(async () => {
    const { subs: s, settings: st, videos: v, translations: tr, $videoStats, knownKeyOf, replayVideoClip, cancelVideoClip } = window.audit;
    const check = (condition, label) => { if (!condition) throw new Error(label); passed.push(label); };
    const passed = [];
    const tick = () => new Promise((r) => setTimeout(r, 30));
    const cue = (text, id = 0) => ({ id, start: 1000 + id * 4000, end: 4000 + id * 4000, text, cleanedText: text, items: text.split(" ").map((text) => ({ text, cleanedText: text, type: "word", tag: "span" })) });
    st.furiganaChanged("never"); st.hoverActionChanged("none"); st.clickActionChanged("popup");
    // Deferred dictionary responses expose races between caption changes and reset.
    const requests = [];
    s.computeCoverageFx.use((captions) => new Promise((resolve) => requests.push({ captions, resolve })));
    s.processRawSubsFx.use(async (captions) => captions);
    const load = (captions) => s.processRawSubsFx(captions);
    const first = [cue("猫 犬")], second = [cue("鳥")];
    await load(first); await load(second);
    requests[1].resolve({ 鳥: "bird" }); await tick();
    requests[0].resolve({ 猫: "cat", 犬: "dog" }); await tick();
    check(s.$coverageKeys.getState().鳥 === "bird" && !s.$coverageKeys.getState().猫, "Late old captions cannot overwrite coverage");
    await load(first); s.resetSubs(""); requests[2].resolve({ 猫: "cat" }); await tick();
    check(Object.keys(s.$coverageKeys.getState()).length === 0 && s.$coverageStatus.getState() === "idle", "Reset discards pending coverage");
    const mixed = [cue("猫 犬"), cue("猫 未収録", 1), cue("犬 犬", 2)];
    await load(mixed); requests[3].resolve({ 猫: "cat", 犬: "dog", 未収録: null }); await tick();
    st.wordMarkedKnown("cat");
    check(JSON.stringify($videoStats.getState()) === JSON.stringify({ total: 2, known: 1, percent: 50, i1: 2 }), "Coverage deduplicates words and excludes unresolved i+1 cues");
    st.wordUnmarkedKnown("cat");
    check($videoStats.getState().known === 0, "Coverage reacts to known-word changes");
    await load(second); requests[4].resolve(null); await tick();
    check(s.$coverageStatus.getState() === "missing", "Missing dictionary ends loading state");
    check(knownKeyOf({ source: "missing", translations: [] }) === null, "Unresolved words cannot be marked known");
    // Media-clock replay must survive buffering, playback-rate changes, and popup unmounts.
    class FakeVideo extends EventTarget {
      currentTime = 0; paused = true; seeking = false; playbackRate = 2;
      play() { this.paused = false; return Promise.resolve(); }
      pause() { this.paused = true; }
    }
    const media = new FakeVideo();
    replayVideoClip(media, 1000, 4000, (ms) => { media.currentTime = ms / 1000; });
    media.currentTime = 2; media.dispatchEvent(new Event("timeupdate"));
    check(!media.paused, "Replay continues before the cue end at 2x speed");
    media.currentTime = 4; media.dispatchEvent(new Event("timeupdate"));
    check(media.paused, "Replay pauses at the media cue end");
    replayVideoClip(media, 1000, 4000, (ms) => { media.currentTime = ms / 1000; });
    cancelVideoClip(); media.currentTime = 6; media.dispatchEvent(new Event("timeupdate"));
    check(!media.paused, "Cancelled replay does not pause unrelated playback");
    v.getCurrentVideoFx.use(async () => media); await v.getCurrentVideoFx();
    s.updateCurrentSubsFx.use(async () => [cue("猫")]); await s.updateCurrentSubsFx({ subs: [], video: null });
    st.autoPauseChanged(true);
    v.loopLineToggled(); media.currentTime = 3.9; v.videoTimeUpdate(); await tick();
    check(!media.paused, "Auto-pause does not interrupt an active loop");
    v.loopLineToggled();
    // Populate the real popup cache with two different dictionary entries.
    st.furiganaChanged("never"); st.hoverActionChanged("none"); st.clickActionChanged("popup");
    const word = { source: "猫", headword: "猫", reading: "ねこ", mainTranslation: "cat", translations: [{ word: "cat", partOfSpeech: "noun", synonyms: [], popularity: 0 }], targetLanguage: "en", transcription: "", himotokiSave: { source: "jitendex", seq: 1, headword: "猫" } };
    tr.fetchWordTranslationFx.use(async () => ({ ...word, alternatives: [{ ...word, headword: "ネコ", himotokiSave: { source: "jitendex", seq: 2, headword: "ネコ" } }] }));
    await tr.fetchWordTranslationFx({ source: "猫" });
    // Use a real element for React's layout reads; no actual media source is required.
    const video = document.createElement("video"); document.body.append(video);
    v.getCurrentVideoFx.use(async () => video); await v.getCurrentVideoFx();
    s.updateCurrentSubsFx.use(async () => [cue("猫")]); await s.updateCurrentSubsFx({ subs: [], video: null });
    window.renderAudit();
    return passed;
  });
  for (const check of checks) console.log("PASS", check);
  await page.locator(".es-sub-item").click();
  await page.waitForSelector(".es-word-translation");
  assert.equal(await page.locator(".es-entry-count").textContent(), "1 / 2");
  await page.getByTitle("Next entry").click();
  assert.equal(await page.locator(".es-entry-count").textContent(), "2 / 2");
  await page.getByRole("button", { name: "Mark known", exact: true }).click();
  assert.equal(await page.locator(".es-sub-item-pinned").count(), 1);
  assert.ok(await page.evaluate(() => window.audit.settings.$knownWords.getState().includes("seq:jitendex:2")));
  console.log("PASS Entry switching and mark-known keep the popup pinned and select the correct entry");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".es-word-translation").count(), 0);
  await page.locator("#typing").focus(); await page.keyboard.press("b");
  assert.equal(await page.locator(".es-breakdown").count(), 0);
  await page.locator("#typing").evaluate((el) => el.blur());
  await page.evaluate(() => {
    window.auditMessages = [];
    const send = chrome.runtime.sendMessage.bind(chrome.runtime);
    chrome.runtime.sendMessage = (msg) => { window.auditMessages.push(msg.type); return send(msg); };
  });
  const before = [];
  page.on("request", (req) => { if (req.url().startsWith("http")) before.push(req.url()); });
  await page.keyboard.press("b");
  await page.waitForFunction(() => document.querySelector(".es-breakdown-empty")?.textContent.includes("Install the offline dictionary"));
  assert.deepEqual(await page.evaluate(() => window.auditMessages), ["himotokiLookupBatch"]);
  assert.equal(before.length, 0, "Sentence breakdown must not use HTTP fallback");
  console.log("PASS Editable hotkey guard and offline-only sentence breakdown");
  assert.deepEqual(errors, [], "Browser runtime errors");
  console.log(`PASS browser runtime errors: ${errors.length}`);
} finally {
  await ctx.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
