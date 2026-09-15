# Himotoki Sub — Roadmap

A long-running plan for improving the extension. Each item below is scoped to be
picked up as **one pull request** against `msr2903/himotoki-sub`. Items are
ordered within each section roughly by priority. This file is meant to be edited:
when you ship an item, move it to "Done" (or delete it) in the same PR.

## How to use this document

- **One item = one PR.** Keep PRs small and reviewable. If an item is large,
  split it and note the split here.
- **Branch off `master`** unless an item says it depends on another. Prefer
  independent PRs so they can merge in any order.
- **Read `CLAUDE.md` and `SKILLS.md` first.** The product rule is non-negotiable:
  this is a Japanese-only Himotoki learning extension. Do not add or revive
  multi-language EasySubs features (Google word translation, English
  dictionaries, phrasal verbs, non-Japanese learning services).
- **Every persisted store needs an explicit `name`** (there is no effector babel
  plugin in the Vite build). See `withPersist` in `src/utils/withPersist.ts`.
- **Prefer local processing over API calls on the hover path** (offline
  dictionary first, `himotoki.my.id/api/search` only as a fallback).
- **Gate before you ship:** `pnpm build` (runs `tsc --noEmit` first) must pass,
  and run the relevant e2e recipe from `SKILLS.md` / `scripts/e2e/`.

## Current state (context for planning)

Shipped on `master`: local ONNX word split, offline Jitendex (SQLite WASM),
hover/click configurable actions, dictionary popup, whole-line translation,
dual subtitles, furigana ruby + reading-line control, settings/options pages.

Also shipped in PRs #2–#8: popup entry switcher + line-audio replay,
deconjugation chain + conjugation table, pitch/frequency/JLPT badges,
local sentence breakdown, known-word tracking + dimming, replay/loop hotkeys,
and per-video coverage & i+1 stats. Check open PRs before starting new work.

---

## P0 — Bugs (fix first)

### 2. Always-on furigana hammers the API before the dictionary is installed
`DEFAULT_FURIGANA` is `"always"` (`src/shared/furiganaSettings.ts`), so on a
fresh install every kanji token in every cue triggers a lookup that falls back to
`GET himotoki.my.id/api/search`. **Fix:** either default furigana to `"hover"`,
or gate `always` on the offline dictionary being installed (fall back to `hover`
until then). Prefer gating so the feature stays discoverable without spamming the
API.

### 3. Reading-line detection is heuristic and can mis-fire
`splitReadingLine` in `src/utils/convertRawSubs.ts` treats a two-line cue whose
second line is all-kana and `>= 50%` the length of the first as a reading line.
Short dialogue where the second line is genuine (kana-only) content can be
swallowed. **Fix:** tighten the heuristic (require the second line's kana to be a
plausible reading of the first line's kanji, reusing `surfaceReading`) and add
unit tests for both the intended reading-line case and false-positive dialogue.

## P1 — Correctness & robustness

### 4. Expand logic tests and add CI
`pnpm test` now runs deterministic Chromium regressions for startup, coverage,
replay, popup interaction and local sentence breakdown. Add unit tests for the pure logic that is easy to
regress: `src/utils/furigana.ts` (`surfaceReading`, okurigana alignment, 来る),
`src/dict/conj_rules.ts` / deinflection, `src/utils/convertRawSubs.ts`
(`splitReadingLine`, `chunkCue`), and `src/utils/himotokiTypes.ts` mapping. Wire
`pnpm test` into a minimal CI check.

### 5. Harden the dictionary download/verify flow
Streaming import + incremental SHA-256 is in place, but there is no visible
recovery when a download is interrupted or a manifest revision changes mid-import.
Add resumable/abortable download, clear error surfacing in `DictionaryPanel`, and
a "repair / re-download" action. Verify OPFS quota handling.

### 6. Firefox parity pass
`chrome.offscreen` is unavailable on Firefox, so the ONNX splitter falls back to
`Intl.Segmenter`. Audit every `chrome.*` call for MV3-Firefox behavior, confirm
the SQLite worker path works without the offscreen document, and document the
degraded-mode expectations. Ship `pnpm build:firefox` as a tested target.

### 7. Streaming-service coverage audit
Each `src/streamings/*.ts` implements `Service`. Verify caption fetching still
works on YouTube, Netflix, and at least two others; delete or clearly mark any
service that no longer works. Add a short per-service status table to `SKILLS.md`.

## P2 — Features

### 8. Anki export via AnkiConnect (backlog idea 15)
`src/learning-service/anki.ts` exists but needs a real AnkiConnect integration:
deck/model selection in settings, field mapping (word, reading, meaning,
sentence, audio), duplicate handling, and a graceful message when AnkiConnect is
not running. Respect the Japanese-only product rule.

### 9. Per-cue i+1 highlight
Building on known-word tracking, visually highlight cues that contain exactly one
unknown word (i+1), so learners can target comprehensible input. Add a toggle in
settings. Use the known-word keys and coverage model merged in PRs #5 and #8.

### 10. Save-context: store the sentence with the word
The popup already passes the subtitle line, source URL and video timestamp to
the learning service. Verify both Himotoki and Anki preserve that context and
render timestamped video links during review; fix any missing mapping.

### 11. Keyboard-first navigation
Expand hotkeys (replay/loop line already shipped) with: focus next/previous
word, open popup for the focused word, save focused word, toggle furigana. Show a
discoverable hotkey cheatsheet from the in-player panel.

### 12. Better secondary-subtitle sourcing
`Service.getSecondarySubs` relies on YouTube PO-token params or `tlang`
auto-translation. Add explicit track selection (let the user pick from available
caption tracks) and cache the chosen track per video.

## P3 — Tech debt & polish

### 13. Finish stripping EasySubs leftovers
Continue removing inherited multi-language code paths, unused locales strings,
dead components, and English-only assumptions. Each removal is a small PR. Keep
`store/` listing text in sync.

### 14. Consolidate settings surfaces
There are three settings surfaces (options page, in-player panel, welcome page)
that partially overlap. Define which setting lives where, share row components,
and make the options page the canonical full settings (see the settings-redesign
PR that matches himotoki.my.id).

### 15. Popup layout robustness
`fitPopup` keeps the card inside the player, but verify behavior across aspect
ratios, fullscreen, theater mode, and small windows. Add e2e assertions that the
popup is never clipped off-screen.

### 16. Bundle-size & model-load audit
Measure the content-script bundle and the ONNX/wasm load cost. Lazy-load the
dictionary worker and onnxruntime-web only when needed; report before/after
numbers in the PR.

## P4 — Testing & infra

### 17. CI pipeline
Add GitHub Actions: `tsc --noEmit`, `pnpm build`, `pnpm test`, and a headless
Playwright smoke run against the built `dist/`. Cache `pnpm` and Playwright
browsers.

### 18. e2e harness improvements
Real Chrome ignores `--load-extension`; tests run through headed Playwright
Chromium. Stabilize `scripts/e2e/*.mjs` (pin a known test video, seed
`persist:*` settings deterministically, wait on explicit selectors), and add
recipes for the popup, furigana, dual subs, and dictionary flows.

---

## Done

- Local ONNX word split + `Intl.Segmenter` fallback.
- Offline Jitendex dictionary (SQLite WASM, OPFS) with streaming SHA-256 verify.
- Configurable hover/click token actions; dictionary popup; whole-line translation.
- Dual subtitles; furigana ruby + reading-line control.
- Settings/options/welcome pages; Himotoki + Anki learning-service scaffolding.
- Popup entry switching, cue replay, conjugation chain/table, and pitch/frequency/JLPT badges (PRs #2–#6).
- Known-word tracking, local sentence breakdown, replay/loop hotkeys, and coverage/i+1 counts (PRs #4–#8).
- Popup controls preserve the pinned entry; regression checks cover entry switching and mark-known.
- Audit fixes for old dictionary compatibility, circular model startup, replay media timing, and stale coverage results.
