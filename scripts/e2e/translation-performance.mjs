import assert from "node:assert/strict";

export async function checkTranslationPerformance(page) {
  const splitCounts = await page.evaluate(async () => {
    const original = chrome.runtime.sendMessage;
    const calls = [];
    chrome.runtime.sendMessage = async (message) => {
      calls.push(message);
      if (message.type === "himotokiSplitBatch") {
        return { ok: true, data: message.texts.map((text) => ({ segments: [text] })) };
      }
      return { ok: true, data: { available: true, cues: message.cues } };
    };
    try {
      const captions = Array.from({ length: 100 }, (_, index) => ({
        start: index * 1000, end: index * 1000 + 900, text: "猫 猫<br>犬",
      }));
      const output = await window.convertJapaneseSubsWithLocalSplit(captions);
      const timingAndLayoutPreserved = output.every((cue, index) =>
        cue.start === captions[index].start && cue.end === captions[index].end &&
        cue.items.map((item) => item.text).join("") === "猫 猫\n犬" && cue.analyzed,
      );
      // A later pass must repair again, so an install/update can change the answer.
      await window.convertJapaneseSubsWithLocalSplit(captions);
      chrome.runtime.sendMessage = async () => ({ ok: false, error: "unavailable" });
      const fallback = await window.convertJapaneseSubsWithLocalSplit(captions.slice(0, 1));
      return {
        splitTexts: calls[0].texts, repairRuns: calls[1].cues.length,
        calls: calls.length, timingAndLayoutPreserved,
        fallbackPreserved: !fallback[0].analyzed && fallback[0].items.map((item) => item.text).join("") === "猫 猫\n犬",
      };
    } finally {
      chrome.runtime.sendMessage = original;
    }
  });
  assert.deepEqual(splitCounts.splitTexts, ["猫", "犬"]);
  assert.equal(splitCounts.repairRuns, 2);
  assert.equal(splitCounts.calls, 4);
  assert.ok(splitCounts.timingAndLayoutPreserved);
  assert.ok(splitCounts.fallbackPreserved);
  console.log("PASS Repeated-caption fixture: 300 text runs → 2 inference/repair inputs; timing, layout and fallback preserved");

  const renderCounts = await page.evaluate(async () => {
    const { translations: tr, settings: st } = window.audit;
    const tick = () => new Promise((resolve) => setTimeout(resolve, 30));
    const wordHandler = tr.fetchWordTranslationFx.use.getCurrent();
    const lineHandler = tr.fetchSubTranslationFx.use.getCurrent();
    const language = st.$translateLanguage.getState();
    const translation = (source) => ({ source, mainTranslation: source, translations: [], targetLanguage: "en", transcription: "" });
    const lines = [];
    tr.fetchWordTranslationFx.use(async ({ source }) => translation(source));
    tr.fetchSubTranslationFx.use((params) => new Promise((resolve) => lines.push({ params, resolve })));
    const unmount = window.mountHookProbes();
    try {
      await tick();
      if (lines.length !== 1) throw new Error("Mounted line did not request its translation");
      const before = { ...window.hookRenders };
      // Separate completions simulate dictionary results arriving over time, not a
      // single React batch that might hide subscriptions to the entire cache.
      for (let i = 0; i < 10; i++) {
        await tr.fetchWordTranslationFx({ source: `unrelated-${i}` });
        await tick();
      }
      const unrelated = Object.fromEntries(Object.keys(before).map((key) => [key, window.hookRenders[key] - before[key]]));
      st.translateLanguageChanged(language === "id" ? "en" : "id");
      await tick();
      if (lines.length !== 2) throw new Error("Visible line did not re-request after settings changed");
      lines[0].resolve("obsolete");
      await tick();
      const pendingAfterOld = JSON.parse(document.getElementById("audit-line").textContent).pending;
      lines[1].resolve("current translation");
      await tick();
      const current = JSON.parse(document.getElementById("audit-line").textContent);
      const lineBefore = window.hookRenders.line;
      tr.lineTranslationRequested("unrelated line");
      await tick();
      lines[2].resolve("unrelated translation");
      await tick();
      return { unrelated, pendingAfterOld, current, unrelatedLineRenders: window.hookRenders.line - lineBefore };
    } finally {
      unmount();
      tr.fetchWordTranslationFx.use(wordHandler);
      tr.fetchSubTranslationFx.use(lineHandler);
      st.translateLanguageChanged(language);
    }
  });
  assert.deepEqual(renderCounts.unrelated, { word: 0, disabled: 0, line: 0 });
  assert.equal(renderCounts.unrelatedLineRenders, 0);
  assert.equal(renderCounts.pendingAfterOld, true);
  assert.deepEqual(renderCounts.current, { translation: "current translation", error: null, pending: false });
  console.log("PASS Unrelated cache updates cause zero probe rerenders; mounted line refreshes after settings change");
}
