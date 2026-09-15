# SKILLS.md — working on Himotoki Sub

Practical guide for building, testing, and shipping this extension. For code architecture see `CLAUDE.md`; for the privacy stance see `PRIVACY.md`.

## What we are building

Himotoki Sub aims to be the best open-source way to **learn Japanese from the subtitles of videos you already watch** (YouTube first, then Netflix and other players). The guiding ideas:

- **Everything that can be local, is local.** Word segmentation runs in a bundled ONNX model; dictionary lookup runs against a Jitendex database downloaded once into the browser and queried with SQLite (WebAssembly). Neither the subtitles you watch nor the words you look up are sent anywhere for the core features. The Himotoki HTTP API is only a fallback until the offline dictionary is installed.
- **Reading, not just translating.** Split each line into words, show readings (furigana), pitch accent, frequency and JLPT level, deconjugation and conjugation tables, and a local word-by-word sentence breakdown — so the learner understands the sentence, not just its gloss.
- **Turn watching into acquisition.** Mark words known, dim what you know, see per-video coverage and i+1 lines, and save words (with sentence, video link, timestamp) to Himotoki or Anki.
- **Japanese-only and Himotoki-centred.** This is a focused fork of EasySubs. Do not re-add generic multi-language features (Google word translation, phrasal verbs, English dictionaries, other learning services). Prefer deleting inherited code over extending it.

## Product rules (do / don't)

- Do keep hover and click on a word independently configurable (furigana / meaning / both / pop-up / none).
- Do prefer local processing on the hover path; never add a per-word network call when the offline dictionary can answer.
- Don't ship UI for data we don't have (e.g. pitch was held back until the pitch dictionary was folded in).
- Don't push to `upstream` (the original EasySubs repo); ship to the fork (see Git workflow).

## Build and run

```bash
pnpm install
pnpm build            # tsc --noEmit + vite build → dist/
pnpm dev              # watch build with hot reload
```

Load `dist/` as an unpacked extension at `chrome://extensions` (developer mode → Load unpacked). Reload once after first install so the `https://himotoki.my.id/*` host permission is granted.

`npx tsc --noEmit` and `pnpm build` are the reliable gates on every change (there is an ESLint config target but no committed config yet). If a `pnpm` script aborts with `ERR_PNPM_IGNORED_BUILDS`, check `allowBuilds` in `pnpm-workspace.yaml`.

Firefox note: `chrome.offscreen` does not exist there, so the ONNX splitter and the offline dictionary do not work; it falls back to `Intl.Segmenter` and the HTTP API.

## Building the offline dictionary

The extension downloads `jitendex-lite.sqlite.gz` (+ a `.json` manifest) from `HIMOTOKI_DICT_URL` in `src/shared/himotokiConfig.ts`. Build it from a Jitendex SQLite produced by the sibling repo `himotoki-web-ts` (`packages/builders`):

```bash
# basic
python3 scripts/build-dict.py /path/to/himotoki-web-ts/data/dicts/jitendex.sqlite dist-dict

# with pitch accent, frequency and JLPT folded in (recommended; PR #6)
python3 scripts/build-dict.py /path/to/jitendex.sqlite dist-dict \
  --pitch /path/to/pitch-kanjium.sqlite \
  --freq  /path/to/freq-jpdb-v2.sqlite \
  --jlpt  /path/to/jlpt.sqlite
```

Outputs `jitendex-lite.sqlite`, `.sqlite.gz` (~38 MB), and `.json` (revision, sizes, sha256, coverage counts). The manifest revision is suffixed `+pf` when extras are folded in, so installed clients on a plain build are offered the update exactly once. The worker verifies the sha256 while importing.

A prebuilt copy is kept at `/tmp/himotoki-dict/` (basic) and `/tmp/himotoki-dict-pf/` (with pitch/freq) for local e2e; rebuild if the sources change.

## Testing

`pnpm test` runs deterministic Chromium regression checks against a built `dist/`: model startup, coverage races, replay timing, loop/auto-pause interaction, popup entry switching, known words, offline-only sentence breakdown, and options-page persistence, synchronization, navigation and responsive layout. Verification is: **type-check + build + the Playwright e2e scripts + a manual pass in real Chrome.**

### End-to-end: YouTube (the main check)

```bash
npx playwright install chromium         # once
pnpm build                              # e2e loads dist/
pnpm test                               # deterministic regression checks
pnpm test:e2e                           # = node scripts/e2e/youtube.mjs [videoUrl]
```

It launches Playwright's Chromium (real Google Chrome ≥153 ignores `--load-extension`, so Chromium is required), loads `dist/`, opens a Japanese-caption video, and checks the whole content-script flow: split rendering, furigana, the dictionary pop-up (entry switcher, pitch/freq/JLPT, conjugation), dual subtitles, known-words, sentence breakdown, and the hotkeys. It writes screenshots to `/tmp/himotoki-e2e-*.png` and prints `page errors: 0` when clean.

Environment variables:

| Var | Purpose |
|-----|---------|
| `HIMOTOKI_DICT_DIR` | Serve a locally built dictionary over CORS and install it before the run (use `/tmp/himotoki-dict-pf` to exercise pitch/freq). Without it, lookups hit the HTTP API. |
| `HIMOTOKI_E2E_WORD` | Target a specific word to hover/pin, e.g. `食べる` (verb, conjugation table) or `顔` (multi-entry). |
| `HIMOTOKI_E2E_TIME` | Seconds to seek to before finding the word (default 2). |

Example exercising the rich pop-up on a verb:

```bash
HIMOTOKI_DICT_DIR=/tmp/himotoki-dict-pf HIMOTOKI_E2E_WORD=起きたら HIMOTOKI_E2E_TIME=9 \
  node scripts/e2e/youtube.mjs 'https://www.youtube.com/watch?v=Jh2C7JlWGKU'
```

Known flakiness: **YouTube rate-limits caption fetches to automated browsers.** After many runs in a day you will see `FAIL: no subtitles rendered`; that is the player getting no caption data, not a code bug. Wait, rerun, or try the alternate video `4tKK4rP1XrQ`. The script prints a diagnostic (tracks, player state) on failure.

### End-to-end: offline dictionary

```bash
node scripts/e2e/dict.mjs /tmp/himotoki-dict-pf
```

Serves the built dictionary locally, installs it through the extension, then checks lookups, deinflection, segment repair, and that the database survives a browser relaunch (OPFS persistence).

### Manual QA (do once per release, in real Chrome)

1. Load `dist/` unpacked; reload once; open a video with Japanese captions.
2. Hover adjacent words: labels follow the pointer without flicker.
3. Click a word: the pop-up pins, stays while the pointer leaves, closes on Escape / outside click; inner buttons (Save, entry arrows, conjugation toggle) do **not** close it.
4. Download the dictionary in Settings; confirm the "Online lookup" footer disappears and lookups are instant.
5. Try the hotkeys (see below).
6. With Yomitan enabled, confirm only one pop-up appears (exclude video sites in Yomitan, or set this extension's hover to "No action").
7. Sign in, save a word, confirm it on himotoki.my.id.

### Hotkeys to exercise

`←` / `→` previous / next line (with `alt` to force), `↓` repeat line, `D` cycle the second subtitle line, `R` replay the current line, `L` loop the current line, `B` open the local sentence breakdown, `T` open the searchable transcript. All are ignored while typing in an input.

## Showing UI changes to the user (required)

For **any UI/UX refinement or visual bug fix**, the reply to the user must include **a screenshot of the result** and **a short list of what changed** — the user wants visual proof the change was actually applied, not just a description. Capture the screenshot before treating the task as done; show before/after when it clarifies the fix.

- **Extension pages** (options/settings, popup, welcome): `pnpm build`, serve `dist/` (`python3 -m http.server 8971 --directory dist`), then open the page in headed Playwright Chromium (`chromium.launch({ headless: false })`) with a `window.chrome` shim — `runtime.getManifest`, `storage.local.get/set` returning promises, `runtime.sendMessage` returning a resolved promise — and seed the relevant `persist:<name>` keys; screenshot full page. Playwright is installed in `/tmp/ext-test`.
- **In-player UI** (subtitles, furigana, token labels, dictionary pop-up, in-player panel): run `scripts/e2e/youtube.mjs` with `HIMOTOKI_DICT_DIR` and the relevant `persist:*` settings; screenshots are written to `/tmp/himotoki-e2e-*.png` and `/tmp/hf-*.png`.

## Feature status

Shipped as a stacked set of PRs on the fork (`msr2903/himotoki-sub`, PRs #1–#8): furigana + reading-line handling; multi-entry pop-up with replay-from-video; deconjugation chain + conjugation table; replay/loop hotkeys; known-word tracking with dimming; pitch accent + frequency + JLPT badges; local sentence breakdown; per-video coverage stats. Merge in number order (each PR names its base).

Deferred / follow-ups:

- **Anki done properly (idea 15):** configurable field mapping, video-frame screenshot, clipped audio. Needs a running AnkiConnect to build and verify, so it hasn't been done autonomously.
- **Per-cue i+1 highlight:** the count exists (coverage stats); the in-line visual marker does not.
- **Store readiness:** privacy policy and store assets exist in `store/`; the OAuth client must list the extension ID as `chrome-extension://<id>` (a stable `key` is in the manifest).

## Git / PR workflow

- `origin` → **your fork** `github.com/msr2903/himotoki-sub` (push and PR here). `upstream` → `Nitrino/easysubs` (read-only; never push).
- Features share `src/models/settings/index.ts`, the options page, the in-player panel, and the pop-up/subs components, so independent branches off `master` conflict. **Stack** dependent feature branches on top of each other and state the merge order.
- Every persisted store must be created with an explicit `name` (chrome.storage key `persist:<name>`); without the effector babel plugin `shortName` is a creation-order counter that would remap saved settings.
- Verify with `npx tsc --noEmit`, `pnpm build`, and the e2e scripts before opening a PR. Register each PR with the thread's pull-request linking tool.

## Deployment checklist

1. Rebuild `jitendex-lite` with `--pitch/--freq/--jlpt` and host `.sqlite.gz` + `.json` at `HIMOTOKI_DICT_URL` (long `Cache-Control`).
2. `pnpm build`, zip `dist/`, upload to the Chrome Web Store (listing text and screenshots in `store/`).
3. Add the store and unpacked extension IDs to the Google OAuth client's authorized origins.
