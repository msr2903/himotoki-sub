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
const contentCss = fs.readdirSync(path.join(ext, "assets/css")).find((name) => name.startsWith("contentStyle"));
fs.writeFileSync(path.join(ext, "audit.html"), `<html><head><meta charset="utf-8"><link rel="stylesheet" href="assets/css/${contentCss}"></head><body class="es-enabled"><input id="typing"><div id="es" style="display:block;position:absolute;top:390px;left:100px;width:900px"><div id="root"></div></div><script src="audit.js"></script></body></html>`);
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
    // Drive captions through $rawSubs (like the real fetch path) so the stale-result guard on
    // $subs accepts them — calling processRawSubsFx directly is rejected as out-of-date.
    const load = async (captions) => { s.fetchSubsFx.use(async () => captions); s.subsRequested("ja"); await tick(); };
    // The real ONNX upgrade effect would rewrite $subs mid-check; keep it pending like a slow batch.
    s.processJapaneseSubsFx.use(() => new Promise(() => {}));
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
    const word = { source: "猫", headword: "猫", reading: "ねこ", pitch: "0/2", mainTranslation: "cat", translations: [{ word: "cat", partOfSpeech: "noun", synonyms: [], popularity: 0 }], targetLanguage: "en", transcription: "", himotokiSave: { source: "jitendex", seq: 1, headword: "猫" } };
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
  // Pitch accent: hidden by default; every recorded contour or numbers only when chosen.
  assert.equal(await page.locator(".es-pitch").count(), 0, "Pitch accent is hidden by default");
  await page.evaluate(() => window.audit.settings.pitchDisplayChanged("contour"));
  await page.waitForFunction(() => document.querySelectorAll(".es-pitch-variant").length === 2);
  await page.locator(".es-word-translation").screenshot({ path: "/tmp/himotoki-pitch-contour.png" });
  await page.evaluate(() => window.audit.settings.pitchDisplayChanged("number"));
  await page.waitForFunction(() => document.querySelectorAll(".es-pitch-num").length === 2 && document.querySelectorAll(".es-pitch-variant").length === 0);
  await page.locator(".es-word-translation").screenshot({ path: "/tmp/himotoki-pitch-number.png" });
  await page.evaluate(() => window.audit.settings.pitchDisplayChanged("hidden"));
  await page.waitForFunction(() => document.querySelectorAll(".es-pitch").length === 0);
  await page.locator(".es-word-translation").screenshot({ path: "/tmp/himotoki-pitch-hidden.png" });
  console.log("PASS Pitch accent shows contours, numbers only, or nothing");
  assert.equal(await page.locator(".es-entry-count").textContent(), "1 / 2");
  await page.getByTitle("Next entry").click();
  assert.equal(await page.locator(".es-entry-count").textContent(), "2 / 2");
  await page.getByRole("button", { name: "Known", exact: true }).click();
  assert.equal(await page.locator(".es-sub-item-pinned").count(), 1);
  assert.ok(await page.evaluate(() => window.audit.settings.$knownWords.getState().includes("seq:jitendex:2")));
  console.log("PASS Entry switching and mark-known keep the popup pinned and select the correct entry");
  // New words only (beta): the line becomes a glossary of words above the learner's level.
  await page.keyboard.press("Escape");
  await page.evaluate(async () => {
    const { subs: s, settings: st, translations: tr } = window.audit;
    const data = {
      昨日: { jlpt: ["n5"], mainTranslation: "yesterday" }, 偶然: { jlpt: ["n2"], mainTranslation: "by chance; unexpectedly" },
      懐かしい: { jlpt: ["n3"], mainTranslation: "nostalgic" }, 映画: { jlpt: ["n5"], mainTranslation: "movie" },
      を: { jlpt: ["n5"], mainTranslation: "object marker" }, 見つけた: { jlpt: ["n4"], mainTranslation: "to find" },
      邂逅: { frequency: 40000, mainTranslation: "chance meeting" }, 未知語: { mainTranslation: "" },
    };
    tr.fetchWordTranslationFx.use(async ({ source }) => ({ source, headword: source, reading: "", mainTranslation: source, translations: [{ word: source, partOfSpeech: "noun", synonyms: [], popularity: 0 }], targetLanguage: "en", transcription: "", lookupSource: "local", ...data[source] }));
    await tr.fetchWordTranslationFx({ source: "warm-up" }); // marks the dictionary ready
    const text = "昨日 偶然 懐かしい 映画 を 見つけた 邂逅 未知語";
    const line = { id: 9, start: 0, end: 4000, text, cleanedText: text, items: text.split(" ").map((t) => ({ text: t, cleanedText: t, type: "word", tag: "span" })) };
    s.updateCurrentSubsFx.use(async () => [line]); await s.updateCurrentSubsFx({ subs: [], video: null });
    st.newWordsLevelChanged("n3");
  });
  const glossary = () => page.evaluate(() => [...document.querySelectorAll("#es-subs .es-glossary__row")].map((r) => r.textContent).join(" | "));
  await page.waitForFunction(() => document.querySelectorAll("#es-subs .es-glossary__row").length === 2);
  assert.equal(await glossary(), "偶然by chance; unexpectedly | 邂逅chance meeting", "N3 lists N2/N1 and rare words with meanings");
  assert.equal(await page.locator("#es-subs .es-sub").count(), 0, "The line itself is replaced by the glossary");
  await page.evaluate(() => window.audit.settings.newWordsLevelChanged("n1"));
  await page.waitForFunction(() => document.querySelectorAll("#es-subs .es-glossary__row").length === 1);
  assert.equal(await glossary(), "邂逅chance meeting", "N1 lists only rare words");
  await page.evaluate(() => window.audit.settings.listeningPeekToggled());
  await page.waitForFunction(() => document.querySelectorAll("#es-subs .es-sub").length === 1 && document.querySelector("#es-subs .es-glossary"));
  await page.evaluate(() => window.audit.settings.newWordsLevelChanged("off"));
  await page.waitForFunction(() => !document.querySelector("#es-subs .es-glossary") && document.querySelectorAll("#es-subs .es-sub").length === 1);
  console.log("PASS New words only swaps the line for a glossary of words above the learner's level; H shows the line");
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
  // Exercise the shipped options page (hub + drill-in panels) with real extension storage and two open pages.
  const options = await ctx.newPage();
  options.on("pageerror", (e) => errors.push(String(e)));
  const optionsUrl = `chrome-extension://${new URL(sw.url()).host}/src/pages/options/index.html`;
  const persisted = (page, key, value) =>
    page.waitForFunction(async ([key, value]) => (await chrome.storage.local.get(`persist:${key}`))[`persist:${key}`] === JSON.stringify(value), [key, value]);
  await options.goto(optionsUrl);
  await options.locator("#furigana").getByRole("radio", { name: "On hover" }).click();
  await persisted(options, "furigana", "hover");
  await options.getByRole("button", { name: /^Words/ }).click();
  await options.waitForSelector("#hover-action");
  assert.ok(options.url().endsWith("?panel=words"), "Menu row opens its panel");
  for (const [id, key, value] of [["hover-action", "hoverAction", "meaning"], ["click-action", "clickAction", "none"]]) {
    await options.locator(`#${id}`).selectOption(value);
    await persisted(options, key, value);
  }
  const increaseScale = options.locator("#ui-scale").getByRole("button", { name: /Increase/ });
  while (await increaseScale.isEnabled()) await increaseScale.click();
  await persisted(options, "uiScale", 150);
  await options.locator("#dim-known").check();
  assert.equal(await options.locator("#pitch-display").getByRole("radio", { name: "Hidden" }).getAttribute("aria-checked"), "true", "Pitch accent defaults to hidden");
  await options.locator("#pitch-display").getByRole("radio", { name: "Number" }).click();
  await persisted(options, "pitchDisplay", "number");
  await options.goBack();
  // Theme: defaults to dark, the Light tile switches this page and other open extension pages.
  assert.equal(await options.evaluate(() => document.documentElement.dataset.hmTheme), "dark");
  await options.locator("#theme").getByRole("radio", { name: "Light" }).click();
  await persisted(options, "theme", "light");
  await options.waitForFunction(() => getComputedStyle(document.body).backgroundColor === "rgb(250, 250, 248)");
  await options.waitForSelector("#furigana");
  await options.fill("input[type=search]", "second line");
  await options.getByRole("button", { name: /^Second line/ }).click();
  await options.locator("#secondary-subs").getByRole("radio", { name: "Translation" }).click();
  await persisted(options, "secondarySubs", "translate");
  await options.locator("#reading-line").getByRole("radio", { name: "Show as text" }).click();
  await persisted(options, "readingLine", "text");
  await options.evaluate(() => chrome.storage.local.set({
    "persist:knownWords": JSON.stringify(["seq:jitendex:10", "seq:jitendex:11"]),
    // The popup test above persisted a "known" word status; clear it so the count is just the array.
    "persist:wordStatuses": "{}",
  }));
  await options.goto(`${optionsUrl}?panel=data`);
  await options.getByText("2 words marked known.", { exact: true }).waitFor();
  const options2 = await ctx.newPage();
  await options2.goto(`${optionsUrl}?panel=data`);
  await options2.getByText("2 words marked known.", { exact: true }).waitFor();
  const forget = options.getByRole("button", { name: "Forget all", exact: true });
  await forget.click();
  await options.getByRole("button", { name: "Click to confirm", exact: true }).click();
  await options2.locator("#known-words").getByText("Nothing here yet", { exact: true }).waitFor();
  await options.goto(`${optionsUrl}?panel=words`);
  await options2.goto(`${optionsUrl}?panel=words`);
  await options2.waitForFunction(() => document.querySelector("#hover-action")?.value === "meaning");
  assert.equal(await options2.locator("#dim-known").isChecked(), true, "Forget all must not toggle dimming");
  assert.equal(await options2.locator("#ui-scale .step-value").textContent(), "150%");
  assert.equal(await options2.locator("#pitch-display").getByRole("radio", { name: "Number" }).getAttribute("aria-checked"), "true");
  assert.equal(await options2.evaluate(() => document.documentElement.dataset.hmTheme), "light", "Theme applies to every extension page");
  await options2.locator("#hover-action").selectOption("both");
  await options.waitForFunction(() => document.querySelector("#hover-action")?.value === "both");
  await options.goto(`${optionsUrl}?panel=subtitles`);
  assert.equal(await options.locator("#secondary-subs").getByRole("radio", { name: "Translation" }).getAttribute("aria-checked"), "true");
  await options.getByRole("button", { name: "Settings", exact: true }).click();
  await options.waitForSelector("#furigana");
  await options.setViewportSize({ width: 1280, height: 800 });
  await options.screenshot({ path: "/tmp/himotoki-audit-options-desktop.png", fullPage: true });
  for (const url of [optionsUrl, `${optionsUrl}?panel=words`, `${optionsUrl}?panel=advanced`]) {
    await options.goto(url);
    for (const width of [720, 360, 320]) {
      await options.setViewportSize({ width, height: 800 });
      assert.ok(await options.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Options overflow at ${width}px (${url})`);
    }
  }
  await options.goto(optionsUrl);
  await options.screenshot({ path: "/tmp/himotoki-audit-options-mobile.png", fullPage: true });
  const popup = await ctx.newPage();
  popup.on("pageerror", (e) => errors.push(String(e)));
  await popup.goto(`chrome-extension://${new URL(sw.url()).host}/src/pages/popup/index.html`);
  await popup.waitForFunction(() => document.documentElement.dataset.hmTheme === "light");
  await options.locator("#theme").getByRole("radio", { name: "Dark" }).click();
  await popup.waitForFunction(() => document.documentElement.dataset.hmTheme === "dark");
  console.log("PASS Theme persists and follows live on the popup");
  console.log("PASS Options preserve controls, persist values, sync across pages, navigate panels and search, and fit narrow windows");
  assert.deepEqual(errors, [], "Browser runtime errors");
  console.log(`PASS browser runtime errors: ${errors.length}`);
} finally {
  await ctx.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
