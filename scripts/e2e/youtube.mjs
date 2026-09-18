// End-to-end smoke test: loads dist/ into Playwright Chromium, opens a YouTube video with Japanese
// captions, and checks split rendering, the dictionary popup, settings, and keyboard navigation.
// Usage: pnpm build && npx playwright install chromium && node scripts/e2e/youtube.mjs [videoUrl]
// YouTube intermittently refuses captions to automated browsers; rerun if the player itself gets no data.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import fs from "node:fs";

import path from "node:path";
import { fileURLToPath } from "node:url";
const EXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../dist");
const VIDEO = process.argv[2] || "https://www.youtube.com/watch?v=4tKK4rP1XrQ";
const userDataDir = fs.mkdtempSync("/tmp/ext-profile-");
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const JP = /[぀-ヿ㐀-鿿]/;

const ctx = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  viewport: { width: 1280, height: 800 },
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    "--mute-audio",
    "--autoplay-policy=no-user-gesture-required",
    "--disable-blink-features=AutomationControlled",
  ],
});

let sw = ctx.serviceWorkers()[0];
if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 20000 });
const extId = new URL(sw.url()).host;
log("extension id", extId, "sw", sw.url());
sw.on("console", (m) => log("[SW]", m.type(), m.text()));

// 1. Pipeline test through an extension page (popup) -> background -> offscreen -> ONNX
const popup = await ctx.newPage();
popup.on("console", (m) => log("[popup]", m.type(), m.text()));
await popup.goto(`chrome-extension://${extId}/src/pages/popup/index.html`);
const texts = ["昨日は友達と映画を見に行きました", "ちょっと待ってください"];
const t0 = Date.now();
const splitResp = await popup.evaluate(
  (texts) => chrome.runtime.sendMessage({ type: "himotokiSplitBatch", texts }),
  texts,
);
log(
  "split via extension (ms):",
  Date.now() - t0,
  JSON.stringify(splitResp?.ok ? splitResp.data.map((r) => r.segments.join("|")) : splitResp),
);
const searchResp = await popup.evaluate(() =>
  chrome.runtime.sendMessage({ type: "himotokiSearch", q: "食べた", lang: "eng", limit: 2 }),
);
log(
  "search via extension:",
  searchResp?.ok
    ? JSON.stringify(searchResp.data.map((e) => [e.kanji?.[0], e.readings?.[0], e.senses?.[0]?.glosses?.[0]]))
    : JSON.stringify(searchResp),
);
const session = await popup.evaluate(() => chrome.runtime.sendMessage({ type: "himotokiGetSession" }));
log("session user:", JSON.stringify(session?.data?.user ?? null));

// Optional: install the offline dictionary from a local build (HIMOTOKI_DICT_DIR=/tmp/himotoki-dict).
let dictServer = null;
if (process.env.HIMOTOKI_DICT_DIR) {
  const http = await import("node:http");
  const dir = process.env.HIMOTOKI_DICT_DIR;
  dictServer = http.createServer((req, res) => {
    const file = path.join(dir, path.basename(req.url.split("?")[0]));
    if (!fs.existsSync(file)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { "Access-Control-Allow-Origin": "*", "Content-Length": fs.statSync(file).size });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => dictServer.listen(0, "127.0.0.1", r));
  const dictUrl = `http://127.0.0.1:${dictServer.address().port}/jitendex-lite.sqlite.gz`;
  await popup.evaluate((u) => chrome.storage.local.set({ himotokiDictUrl: u }), dictUrl);
  const td = Date.now();
  const inst = await popup.evaluate(() => chrome.runtime.sendMessage({ type: "himotokiDictInstall" }));
  log("dictionary install:", inst?.data?.state ?? inst?.error, "in", ((Date.now() - td) / 1000).toFixed(1), "s");
}

// 2. Real page test
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => {
  pageErrors.push(String(e));
  log("[pageerror]", String(e));
});
page.on("console", (m) => {
  const t = m.text();
  if (/himotoki|Event:|streaming|content loaded|es-|error/i.test(t)) log("[page]", m.type(), t.slice(0, 200));
});
const cdp = await ctx.newCDPSession(page);
await cdp.send("Network.enable");
const reqs = new Map();
cdp.on("Network.requestWillBeSent", (e) => {
  if (e.request.url.includes("/api/timedtext")) reqs.set(e.requestId, { url: e.request.url, type: e.type });
});
cdp.on("Network.loadingFinished", (e) => {
  const r = reqs.get(e.requestId);
  if (!r) return;
  const q = new URL(r.url).searchParams;
  if (q.has("pot") && e.encodedDataLength > 0) lastPotUrl = r.url;
  log("[net] timedtext", "lang=" + q.get("lang"), "pot=" + (q.has("pot") ? "yes" : "no"), "type=" + r.type, "bytes=" + e.encodedDataLength);
});
let lastPotUrl = "";
await page.goto(VIDEO, { waitUntil: "domcontentloaded" });
for (const label of ["Accept all", "Reject all", "I agree"]) {
  const b = page.getByRole("button", { name: label });
  if (await b.count()) {
    await b.first().click().catch(() => {});
    log("clicked consent", label);
    break;
  }
}
await page.waitForSelector("video", { timeout: 30000 });

const deadline = Date.now() + 45000;
let subsFound = false;
let tick = 0;
while (Date.now() < deadline) {
  const st = await page.evaluate(() => {
    const v = document.querySelector("video");
    const player = document.getElementById("movie_player");
    const ad = player?.classList.contains("ad-showing");
    const skip = document.querySelector(".ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern");
    if (skip) skip.click();
    if (v && v.paused) v.play().catch(() => {});
    return {
      ad,
      t: v?.currentTime,
      paused: v?.paused,
      es: !!document.querySelector("#es"),
      settings: !!document.querySelector(".es-settings"),
      progress: !!document.querySelector(".es-progress-bar"),
      cuesNearby: document.querySelectorAll(".es-progress-bar-element").length,
      subs: [...document.querySelectorAll(".es-sub")].map((s) =>
        [...s.querySelectorAll(".es-sub-item")].map((i) => i.textContent),
      ),
    };
  });
  if (st.subs.some((s) => s.length > 0)) {
    log("state", JSON.stringify(st));
    subsFound = true;
    break;
  }
  if (st.cuesNearby > 0 && tick > 2) {
    // Transcript is loaded but no cue is active right now: jump to the next cue via the extension's hotkey.
    await page.keyboard.press("ArrowRight");
    log("transcript loaded (cues nearby:", st.cuesNearby, ") -> pressed ArrowRight to jump to next cue");
  }
  if (tick++ % 4 === 0)
    log(
      "waiting",
      JSON.stringify({ ad: st.ad, t: st.t, paused: st.paused, es: st.es, settings: st.settings, progress: st.progress, cuesNearby: st.cuesNearby }),
    );
  await page.waitForTimeout(1500);
}
if (!subsFound) {
  log("FAIL: no subtitles rendered");
  const diag = await page.evaluate(() => {
    const tracks = window.ytInitialPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    const player = document.getElementById("movie_player");
    const v = document.querySelector("video");
    return {
      url: location.href,
      title: document.title,
      tracks: (tracks || []).map((t) => [t.languageCode, t.kind || "manual", t.vssId]),
      ccPressed: document.querySelector(".ytp-subtitles-button")?.getAttribute("aria-pressed"),
      playerState: player?.getPlayerState?.(),
      hasSetOption: typeof player?.setOption,
      captionOption: (() => { try { return JSON.stringify(player?.getOption?.("captions", "track")); } catch (e) { return "err " + e; } })(),
      videoDuration: v?.duration,
      videoSrc: (v?.src || "").slice(0, 60),
      esHtml: document.querySelector("#es")?.outerHTML?.slice(0, 300),
      nativeCaption: document.querySelector(".captions-text")?.textContent?.slice(0, 100),
      adShowing: player?.classList.contains("ad-showing"),
      playerClasses: player?.className?.slice(0, 200),
    };
  });
  log("diag", JSON.stringify(diag, null, 1));
  await page.screenshot({ path: "/tmp/himotoki-e2e-fail.png" });
  await ctx.close();
  process.exit(1);
}

// Observe several cues over ~12s, compare with Intl.Segmenter and ONNX
const seen = new Map();
for (let i = 0; i < 12; i++) {
  const cues = await page.evaluate(() =>
    [...document.querySelectorAll(".es-sub")].map((s) => ({
      text: s.textContent,
      items: [...s.querySelectorAll(".es-sub-item")].map((i) => i.textContent),
    })),
  );
  for (const c of cues) if (c.items.length && !seen.has(c.text)) seen.set(c.text, c.items);
  await page.waitForTimeout(1000);
}
log("distinct cues observed:", seen.size);

// --- Furigana (ideas 9+10) ---
const setPersist = (obj) => popup.evaluate((o) => chrome.storage.local.set(o), obj);
const furiState = () =>
  page.evaluate(() => {
    const rubies = [...document.querySelectorAll(".es-sub-item ruby rt")].map((rt) => rt.textContent);
    return {
      rubyCount: rubies.length,
      sampleRuby: rubies.slice(0, 4),
      readingLineText: [...document.querySelectorAll(".es-sub-reading-line")].map((e) => e.textContent.slice(0, 40)),
    };
  });
await page.evaluate(() => { const v = document.querySelector("video"); v.currentTime = 1; v.pause(); });
await setPersist({ "persist:furigana": JSON.stringify("always"), "persist:readingLine": JSON.stringify("hide") });
await page.waitForFunction(() => document.querySelector(".es-sub-item ruby rt"), null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(600);
log("furigana=always, readingLine=hide (expect ruby>0, no reading line):", JSON.stringify(await furiState()));
await page.screenshot({ path: "/tmp/himotoki-e2e-furigana.png" });
await setPersist({ "persist:readingLine": JSON.stringify("text") });
await page.waitForTimeout(600);
log("readingLine=text (expect a kana reading line when the cue has one):", JSON.stringify(await furiState()));
await setPersist({ "persist:furigana": JSON.stringify("never"), "persist:readingLine": JSON.stringify("hide") });
await page.waitForTimeout(500);
log("furigana=never (expect ruby=0):", JSON.stringify(await furiState()));
await setPersist({ "persist:furigana": JSON.stringify("always") });

let matched = 0;
let total = 0;
for (const [text, rendered] of [...seen.entries()].slice(0, 6)) {
  const onnx =
    (await popup.evaluate((t) => chrome.runtime.sendMessage({ type: "himotokiSplitBatch", texts: [t] }), text))
      ?.data?.[0]?.segments ?? [];
  const intl = [...new Intl.Segmenter("ja", { granularity: "word" }).segment(text)]
    .map((s) => s.segment)
    .filter((s) => s.trim());
  const eqOnnx = rendered.join("") === onnx.join("");
  const eqIntl = rendered.join("") === intl.join("");
  total++;
  if (eqOnnx) matched++;
  log(
    `cue: ${text}\n   rendered: ${rendered.join(" | ")}\n   onnx    : ${onnx.join(" | ")}  ${eqOnnx ? "== rendered" : "!= rendered"}\n   intl    : ${intl.join(" | ")}  ${eqIntl ? "== rendered" : "!= rendered"}`,
  );
}
log(`ONNX split matches rendered DOM: ${matched}/${total} cues`);

// Ground truth for the raw caption format (line breaks between cue lines?)
if (lastPotUrl) {
  // Fetched outside the page so the extension's timedtext hooks do not see it.
  try {
    const j = await (await ctx.request.get(lastPotUrl)).json();
    const ev = (j.events || []).filter((e) => e.segs?.length).slice(0, 4);
    log("raw json3 first cues:", JSON.stringify(ev.map((e) => ({ t: e.tStartMs, d: e.dDurationMs, segs: e.segs.map((s) => s.utf8) }))));
  } catch (e) {
    log("raw json3 fetch failed:", String(e));
  }
}

// Interaction test. Defaults: hover = furigana + meaning label, click = pinned pop-up dictionary.
// Jump cues until a kanji token is on screen, then pause so the cue stays put.
const setActions = (hover, click) =>
  popup.evaluate(
    ([h, c]) => chrome.storage.local.set({ "persist:hoverAction": JSON.stringify(h), "persist:clickAction": JSON.stringify(c) }),
    [hover, click],
  );
await setActions("both", "popup");
let target = null;
let targetText = null;
// HIMOTOKI_E2E_WORD=食べる targets a specific word (seeks to HIMOTOKI_E2E_TIME seconds first, default 2).
const wantWord = process.env.HIMOTOKI_E2E_WORD || null;
if (wantWord) {
  await page.evaluate((t) => { const v = document.querySelector("video"); v.currentTime = t; v.pause(); }, Number(process.env.HIMOTOKI_E2E_TIME || 2));
  await page.waitForTimeout(1500);
}
for (let attempt = 0; attempt < 10 && !targetText; attempt++) {
  target = await page.evaluateHandle(([jpSrc, want]) => {
    // Surface text without ruby <rt> (furigana), so exact word matching still works.
    const surface = (el) => {
      if (!el.querySelector("rt")) return el.textContent;
      const c = el.cloneNode(true);
      c.querySelectorAll("rt").forEach((x) => x.remove());
      return c.textContent;
    };
    const jp = new RegExp(jpSrc);
    const all = [...document.querySelectorAll(".es-sub-item")];
    if (want) return all.find((i) => surface(i) === want) || null;
    const items = all.filter((i) => jp.test(surface(i)) && surface(i).length >= 2);
    return items[0] || null;
  }, [JP.source, wantWord]);
  targetText = await target.evaluate((e) => e?.textContent ?? null);
  if (!targetText) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(1200);
  }
}
if (!targetText) {
  log("FAIL: could not find a word token to hover");
  await ctx.close();
  process.exit(1);
}
await page.evaluate(() => document.querySelector("video").pause());
await page.waitForTimeout(300);
const box = await target.asElement().boundingBox();
log("hover target:", targetText, JSON.stringify(box));
const state = () =>
  page.evaluate(() => ({
    label: document.querySelector(".es-token-label")?.innerText?.replace(/\n/g, " / ") ?? null,
    popup: document.querySelector(".es-word-translation")?.innerText?.split("\n").slice(0, 4).join(" | ") ?? null,
    pinned: document.querySelectorAll(".es-sub-item-pinned").length,
    hint: !!document.querySelector(".es-word-hint"),
  }));

await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForFunction(() => document.querySelector(".es-token-label") || document.querySelector(".es-word-translation"), null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(400);
log("after hover (expect label, no popup):", JSON.stringify(await state()));
await page.screenshot({ path: "/tmp/himotoki-e2e-hover.png" });
await page.mouse.move(10, 10);
await page.waitForTimeout(400);
log("after leave (expect nothing):", JSON.stringify(await state()));

// Moving directly from one word onto the adjacent word must keep a label (leave of A must not clear B).
const neighbor = await target.evaluateHandle((el) => {
  let n = el.nextElementSibling;
  while (n && !(n.classList.contains("es-sub-item") && n.textContent.trim())) n = n.nextElementSibling;
  return n;
});
const nbox = await neighbor.asElement()?.boundingBox();
if (nbox) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(400);
  await page.mouse.move(nbox.x + nbox.width / 2, nbox.y + nbox.height / 2, { steps: 4 });
  await page.waitForTimeout(500);
  log("after moving to adjacent token", JSON.stringify(await neighbor.evaluate((e) => e.textContent)), "(expect a label, 600ms later still there):", JSON.stringify(await state()));
  await page.waitForTimeout(600);
  log("adjacent token, 600ms later:", JSON.stringify(await state()));
  await page.mouse.move(10, 10);
  await page.waitForTimeout(300);
}

await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForFunction(() => { const p = document.querySelector(".es-word-translation"); return p && !/Looking up/.test(p.textContent); }, null, { timeout: 15000 }).catch(() => {});
assert.equal((await state()).pinned, 1, "Word click must pin the popup");
log("after click (expect popup, pinned=1):", JSON.stringify(await state()));
log("popup depth:", JSON.stringify(await page.evaluate(() => {
  const p = document.querySelector(".es-word-translation");
  if (!p) return null;
  return {
    entrySwitch: p.querySelector(".es-entry-count")?.textContent ?? null,
    playFromVideo: !!p.querySelector(".es-popup-speak[title*='video']"),
  };
})));
await page.screenshot({ path: "/tmp/hf-pf-popup.png" });
log("pitch/freq/jlpt tags:", JSON.stringify(await page.evaluate(() => {
  const p = document.querySelector(".es-word-translation");
  if (!p) return null;
  return {
    pitch: !!p.querySelector(".es-pitch-diagram, .es-pitch-num"),
    pitchMorae: [...p.querySelectorAll(".es-pitch-mora")].map((m) => m.className.includes("high") ? "H" : "L").join(""),
    freq: p.querySelector(".es-tag-freq")?.textContent ?? null,
    jlpt: [...p.querySelectorAll(".es-tag")].map((t) => t.textContent).filter((t) => /^N[1-5]$/.test(t)),
  };
})));
// Grammar (idea 12): the deconjugation chain renders from data (no click needed).
await page.evaluate(() => document.querySelector("video")?.pause());
await page.waitForTimeout(200);
log("conjugation chain:", JSON.stringify(await page.evaluate(() =>
  document.querySelector(".es-conj-chain")?.textContent?.replace(/\s+/g, " ").trim() ?? null)));
// Conjugation table: flip showConj in-place and read it, tolerant of popup timing.
await page.evaluate(() => document.querySelector(".es-conj .es-word-more")?.click());
await page.waitForTimeout(1200);

// Word status (New/Learning/Known/Ignored): set from the pop-up, verify storage, then dim.
await page.evaluate(() => {
  const b = document.querySelector(".es-word-translation .es-status-btn--known");
  b && b.click();
});
await page.waitForTimeout(300);
log("word statuses in storage after Known:", JSON.stringify(await popup.evaluate(() => chrome.storage.local.get(["persist:wordStatuses", "persist:knownWords"]))));
log("active status button now:", JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll(".es-word-translation .es-status-btn--active")].map((x) => x.textContent))));
// Scroll the pop-up to its footer so the New/Learning/Known/Ignored row is in frame.
await page.evaluate(() => { const p = document.querySelector(".es-word-translation"); if (p) p.scrollTop = p.scrollHeight; });
await page.waitForTimeout(200);
await page.screenshot({ path: "/tmp/himotoki-unitB-popup.png" });
await popup.evaluate(() => chrome.storage.local.set({ "persist:dimKnownWords": JSON.stringify(true) }));
await page.waitForTimeout(700);
log("dimmed tokens with dim on:", await page.evaluate(() => document.querySelectorAll(".es-sub-item--known").length));
// Mark the same word "learning" (dim off) to show the underline highlight on the line.
await popup.evaluate((key) => chrome.storage.local.set({
  "persist:dimKnownWords": JSON.stringify(false),
  "persist:wordStatuses": JSON.stringify({ [key]: "learning" }),
}), "seq:jitendex:1217730");
await page.mouse.move(10, 10);
await page.keyboard.press("Escape");
await page.waitForTimeout(600);
log("learning tokens on line:", await page.evaluate(() => document.querySelectorAll(".es-sub-item--learning").length));
await page.screenshot({ path: "/tmp/himotoki-unitB-line.png" });
await popup.evaluate(() => chrome.storage.local.set({ "persist:dimKnownWords": JSON.stringify(false), "persist:knownWords": JSON.stringify([]), "persist:wordStatuses": JSON.stringify({}) }));
log("conjugation table:", JSON.stringify(await page.evaluate(() => ({
  rows: document.querySelectorAll(".es-conj-table tr").length,
  sample: [...document.querySelectorAll(".es-conj-table tr")].slice(0, 3).map((r) => r.textContent.replace(/\s+/g, " ").trim()),
  status: document.querySelector(".es-conj-status")?.textContent ?? null,
}))));
log("popup fit:", JSON.stringify(await page.evaluate(() => { const p = document.querySelector(".es-word-translation"); const pl = document.querySelector(".html5-video-player"); if (!p || !pl) return null; const r = p.getBoundingClientRect(), q = pl.getBoundingClientRect(); return { insideTop: r.top >= q.top, insideLeft: r.left >= q.left, insideRight: r.right <= q.right, maxHeight: p.style.maxHeight, scrollable: p.classList.contains("es-word-translation--scrollable"), senses: document.querySelectorAll(".es-sense").length, more: document.querySelector(".es-word-more")?.textContent ?? null }; })));
await page.screenshot({ path: "/tmp/himotoki-e2e-pinned.png" });
await popup.evaluate(() => chrome.storage.local.set({ "persist:uiScale": JSON.stringify(70) }));
await page.waitForTimeout(400);
log("pop-up size 70%: popup zoom / label font / panel zoom:", JSON.stringify(await page.evaluate(() => ({ popupZoom: getComputedStyle(document.querySelector(".es-word-translation") || document.body).zoom, popupInside: (() => { const p = document.querySelector(".es-word-translation"), pl = document.querySelector(".html5-video-player"); if (!p || !pl) return null; const r = p.getBoundingClientRect(), q = pl.getBoundingClientRect(); return r.top >= q.top && r.left >= q.left; })(), subsVar: getComputedStyle(document.querySelector("#es-subs")).getPropertyValue("--es-ui-scale").trim() }))));
await popup.evaluate(() => chrome.storage.local.set({ "persist:uiScale": JSON.stringify(100) }));
await page.waitForTimeout(300);
await page.mouse.move(10, 10);
await page.waitForTimeout(500);
log("after click then leave (expect popup still pinned):", JSON.stringify(await state()));
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
assert.equal((await state()).pinned, 0, "Escape must dismiss the popup");
log("after Escape (expect nothing):", JSON.stringify(await state()));
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(800);
await page.mouse.click(5, 5);
await page.waitForTimeout(300);
log("after click, then click outside (expect nothing):", JSON.stringify(await state()));

// Live settings change from another extension page: hover = popup, click = none.
await setActions("popup", "none");
await page.waitForTimeout(500);
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForFunction(() => { const p = document.querySelector(".es-word-translation"); return p && !/Looking up/.test(p.textContent); }, null, { timeout: 15000 }).catch(() => {});
log("hover=popup: after hover (expect popup, pinned=0):", JSON.stringify(await state()));
await page.mouse.move(10, 10);
await page.waitForTimeout(400);
log("hover=popup: after leave (expect nothing):", JSON.stringify(await state()));
await setActions("both", "popup");

// Duplicate-token check: does a cue with two identical tokens open two labels?
const dupInfo = await page.evaluate(() => {
  for (const s of document.querySelectorAll(".es-sub")) {
    const counts = {};
    for (const i of s.querySelectorAll(".es-sub-item")) counts[i.textContent] = (counts[i.textContent] || 0) + 1;
    const dup = Object.entries(counts).find(([k, v]) => v > 1 && k.trim());
    if (dup) return { text: s.textContent.slice(0, 60), dup: dup[0] };
  }
  return null;
});
log("duplicate token cue in view:", JSON.stringify(dupInfo));
if (dupInfo) {
  const el = await page.evaluateHandle((d) => [...document.querySelectorAll(".es-sub-item")].find((i) => i.textContent === d), dupInfo.dup);
  const b2 = await el.asElement().boundingBox();
  if (b2) await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
  await page.waitForTimeout(1500);
  log("labels/popups open while hovering duplicate token (expect 1):", await page.evaluate(() => document.querySelectorAll(".es-token-label, .es-word-translation").length));
  await page.mouse.move(10, 10);
  await page.waitForTimeout(300);
}
await page.evaluate(() => document.querySelector("video").play());

// Second subtitle line: track (real English track on this video), translate (Google MT), off; D key cycles.
const setSecondary = (mode) => popup.evaluate((m) => chrome.storage.local.set({ "persist:secondarySubs": JSON.stringify(m) }), mode);
const secondaryState = () =>
  page.evaluate(() => ({
    lines: [...document.querySelectorAll(".es-sub-secondary")].map((e) => e.textContent.slice(0, 80)),
    jp: [...document.querySelectorAll(".es-sub-item")].length,
  }));
await page.evaluate(() => { const v = document.querySelector("video"); v.currentTime = 9; v.pause(); });
await setSecondary("track");
await page.waitForFunction(() => document.querySelector(".es-sub-secondary"), null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(500);
log("secondary=track (expect an English line):", JSON.stringify(await secondaryState()));
await page.screenshot({ path: "/tmp/himotoki-e2e-dual.png" });
await setSecondary("translate");
await page.waitForFunction(() => { const e = document.querySelector(".es-sub-secondary"); return e && e.textContent !== "…"; }, null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(300);
log("secondary=translate (expect a translated line, needs network):", JSON.stringify(await secondaryState()));
await setSecondary("off");
await page.waitForTimeout(400);
log("secondary=off (expect none):", JSON.stringify(await secondaryState()));
await page.mouse.click(640, 200);
await page.keyboard.press("d");
await page.waitForTimeout(600);
log("after pressing D (expect mode 'track' in storage):", JSON.stringify(await popup.evaluate(() => chrome.storage.local.get("persist:secondarySubs"))));
await page.keyboard.press("d");
await page.keyboard.press("d");
await page.waitForTimeout(400);
log("after two more D presses (expect 'off'):", JSON.stringify(await popup.evaluate(() => chrome.storage.local.get("persist:secondarySubs"))));

// Settings gear
const gearInfo = await page.evaluate(() => {
  const root = document.querySelector(".es-settings");
  const btn = root?.querySelector("button, svg, div");
  btn?.click();
  return { hasRoot: !!root, html: root?.outerHTML?.slice(0, 200) };
});
await page.waitForTimeout(800);
log("settings root:", JSON.stringify(gearInfo));
log(
  "settings content rendered:",
  await page.evaluate(() => !!document.querySelector("[class*=es-settings-content]")),
);
log("video stats:", JSON.stringify(await page.evaluate(() => document.querySelector(".es-video-stats")?.textContent ?? null)));
log("settings panel overflow (scrollHeight > clientHeight means it scrolls):", JSON.stringify(await page.evaluate(() => { const m = document.querySelector(".es-settings-content__main"); const c = document.querySelector(".es-settings-content"); return m && c ? { mainScroll: m.scrollHeight, mainClient: m.clientHeight, panel: c.getBoundingClientRect().height, playerH: document.querySelector(".html5-video-player")?.clientHeight } : null; })));
log("select values fully visible:", JSON.stringify(await page.evaluate(() => [...document.querySelectorAll(".es-settings-content [class*=singleValue]")].map((e) => [e.textContent, e.scrollWidth <= e.clientWidth + 1]))));
await page.screenshot({ path: "/tmp/himotoki-e2e-settings.png" });

// Lookup history (unit C): seed a few items and screenshot the panel's history section.
await popup.evaluate(() => chrome.storage.local.set({ "persist:lookupHistory": JSON.stringify([
  { key: "hw:顔", headword: "顔", reading: "かお", gloss: "face; visage", source: "顔", videoTimeMs: 12000, ts: Date.now() },
  { key: "hw:食べる", headword: "食べる", reading: "たべる", gloss: "to eat", source: "食べる", videoTimeMs: 8000, ts: Date.now() },
  { key: "hw:朝", headword: "朝", reading: "あさ", gloss: "morning", source: "朝", videoTimeMs: 3000, ts: Date.now() },
]) }));
await page.waitForTimeout(700);
log("lookup history items rendered:", await page.evaluate(() => document.querySelectorAll(".es-lookup-history__item").length));
{
  const historyEl = await page.$(".es-lookup-history");
  if (historyEl) {
    await historyEl.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(200);
    await historyEl.screenshot({ path: "/tmp/himotoki-unitC-panel.png" }).catch(() => page.screenshot({ path: "/tmp/himotoki-unitC-panel.png" }));
  }
}

// Keyboard nav
await page.mouse.move(10, 10);
await page.evaluate(() => document.querySelector("video").play());
const tBefore = await page.evaluate(() => document.querySelector("video").currentTime);
await page.keyboard.press("ArrowLeft");
await page.waitForTimeout(700);
const tAfter = await page.evaluate(() => document.querySelector("video").currentTime);
log("ArrowLeft:", tBefore.toFixed(2), "->", tAfter.toFixed(2));

// Navigation (idea 17): replay (R) and loop (L).
await page.evaluate(() => { const v = document.querySelector("video"); v.play(); v.currentTime = 12; });
await page.waitForTimeout(600);
const tBeforeR = await page.evaluate(() => document.querySelector("video").currentTime);
await page.keyboard.press("r");
await page.waitForTimeout(700);
const tAfterR = await page.evaluate(() => document.querySelector("video").currentTime);
log("replay R:", tBeforeR.toFixed(2), "->", tAfterR.toFixed(2), tAfterR < tBeforeR ? "(jumped back to line start)" : "(no jump)");
// Loop: enable at t inside a cue, jump near the end, expect it to seek back.
await page.evaluate(() => { const v = document.querySelector("video"); v.play(); v.currentTime = 12; });
await page.waitForTimeout(500);
await page.keyboard.press("l");
await page.waitForTimeout(300);
const loopToast = await page.evaluate(() => [...document.querySelectorAll(".es-toast, [class*=toast]")].map((e) => e.textContent).join(" | ").slice(0, 80));
await page.evaluate(() => { const v = document.querySelector("video"); v.currentTime = 15.7; });
await page.waitForTimeout(1200);
const tLoop = await page.evaluate(() => document.querySelector("video").currentTime);
log("loop L: toast=", JSON.stringify(loopToast), "; currentTime after nearing end:", tLoop.toFixed(2), tLoop < 15 ? "(looped back)" : "(did not loop)");
await page.keyboard.press("l");

// Sentence breakdown (idea 14): B opens a local word list for the current line.
await page.evaluate(() => { const v = document.querySelector("video"); v.play(); v.currentTime = 2; });
await page.waitForTimeout(700);
await page.evaluate(() => document.querySelector("video")?.pause());
await page.keyboard.press("b");
await page.waitForFunction(() => document.querySelector(".es-breakdown-row"), null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(500);
log("breakdown:", JSON.stringify(await page.evaluate(() => ({
  open: !!document.querySelector(".es-breakdown"),
  rows: document.querySelectorAll(".es-breakdown-row").length,
  sample: [...document.querySelectorAll(".es-breakdown-row")].slice(0, 3).map((r) => r.textContent.replace(/\s+/g, " ").trim()),
}))));
await page.screenshot({ path: "/tmp/hf-sent.png" });
await page.keyboard.press("b");
await page.waitForTimeout(300);
log("breakdown after second B (expect closed):", await page.evaluate(() => !!document.querySelector(".es-breakdown")));

assert.equal(await page.locator(".es-breakdown").count(), 0, "B must close sentence breakdown");
assert.deepEqual(pageErrors, [], "Unexpected browser errors");
log("page errors:", pageErrors.length, pageErrors.slice(0, 5));
await ctx.close();
dictServer?.close();
