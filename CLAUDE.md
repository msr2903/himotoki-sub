# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Himotoki Sub is a Japanese-only browser extension forked from EasySubs. It overlays subtitles on streaming sites (YouTube, Netflix, KinoPub, Coursera, Plex, Udemy, Kinopoisk, Amazon, inoriginal), splits each Japanese line into words with a local ONNX model, and shows a Himotoki dictionary popup when a word is hovered or clicked. Words can be saved to Himotoki favorites (Convex backend, Google sign-in) or to Anki.

Product rule: the extension is focused on Japanese learning with Himotoki. Do not add or revive features that only make sense for other languages (Google word translation, phrasal verbs, English dictionaries, other learning services). Prefer deleting inherited EasySubs code over extending it.

## Development Commands

- `pnpm build` - Build extension for Chrome (runs `tsc --noEmit` first)
- `pnpm build:firefox` - Build for Firefox (note: `chrome.offscreen` is unavailable there, so the ONNX splitter falls back to `Intl.Segmenter`)
- `pnpm dev` - Watch build with hot reload
- `pnpm lint` - ESLint (no config file is committed yet; `npx tsc --noEmit` is the reliable check)
- `pnpm test` - Vitest (no tests exist yet)
- `pnpm test:e2e` - Playwright smoke test on YouTube (`scripts/e2e/youtube.mjs`); `node scripts/e2e/dict.mjs <dictDir>` tests the offline dictionary. Both need `npx playwright install chromium` and a built `dist/`.

If `pnpm` scripts abort with `ERR_PNPM_IGNORED_BUILDS`, check `pnpm-workspace.yaml` `allowBuilds`.

## Architecture

### Pipeline
1. A streaming service (`src/streamings/*.ts`, implementing `Service` from `src/streamings/service.ts`) fetches raw captions and emits `esSubsChanged`.
2. `src/models/subs` converts captions to `TSub[]`: an immediate `Intl.Segmenter` paint (`convertJapaneseSubsFallback`), then an upgrade pass through the local ONNX split (`convertJapaneseSubsWithLocalSplit`), both in `src/utils/convertRawSubs.ts`.
3. The ONNX model lives in `public/models/default.onnx` (+ CRF params in `default.onnx.crf.npz`) and runs in the offscreen document `src/pages/offscreen/index.ts` via `src/split/`. The background service worker (`src/pages/background/index.ts`) creates the offscreen document and relays `himotokiSplit`/`himotokiSplitBatch` messages.
4. Hovering or clicking a token (`src/pages/content/components/Subs/Subs.tsx`) opens `SubItemTranslation`, which triggers `fetchWordTranslationFx` in `src/models/translations`. It first asks the offline dictionary (`himotokiLookup` → background → offscreen → `src/pages/offscreen/dict.worker.ts`, SQLite WebAssembly over an OPFS-hosted Jitendex file; lookup and deinflection logic in `src/dict/lookup.ts`, rules in `src/dict/conj_rules.ts`, ported from himotoki-web-ts). If the dictionary is not installed it falls back to `GET https://himotoki.my.id/api/search`. Response mapping is in `src/utils/himotokiTypes.ts`.
   - The dictionary file is built by `scripts/build-dict.py` and downloaded from `HIMOTOKI_DICT_URL` (`src/shared/himotokiConfig.ts`) via the popup or settings page. A JSON manifest next to it (`jitendex-lite.json`) carries the revision and sha256; the worker verifies the sha256 while importing and the panel offers an update when the manifest revision differs. After the ONNX split, `himotokiRepairSegments` merges adjacent segments that form a dictionary headword.
   - Prefer local processing over API calls for anything on the hover path.
5. Clicking a line outside a word shows a whole-line machine translation (Google or DeepL) via `translateFullText`; results are cached per line in `$lineTranslations` (`useLineTranslation`).
6. Dual subtitles (`$secondarySubs`: off / track / translate, options in `src/shared/secondarySubs.ts`, hotkey `d`). "track" fetches a second caption track through `Service.getSecondarySubs` (YouTube: a real track with the player's PO-token params, else `tlang` auto-translation of the Japanese track) into `$secondaryRawSubs`; "translate" renders `SecondaryTranslation` under each current cue from the line-translation cache.

### Token interaction
Hover and click are independent, user-configurable actions (`TTokenAction`: furigana, meaning, both, popup, none; options in `src/shared/tokenActions.ts`). `Subs.tsx` resolves the action per token: a pinned click result (`$pinnedWord`) wins over the transient hover (`$activeHoverWord`). Labels are rendered by `TokenLabel.tsx` (reading derived by `src/utils/furigana.ts`), the full entry by `SubItemTranslation.tsx`; both read the shared lookup cache through `useLookup`.

### Settings persistence
`withPersist` stores each setting in `chrome.storage.local` as `persist:<name>` (JSON) and syncs live across extension pages. Every persisted store must be created with an explicit `name`; without the effector babel plugin, `shortName` is a creation-order counter. The options page (`src/pages/options/`) reads and writes the same keys through `src/shared/persistedSettings.ts`, so it never imports the content-script models.

### State Management (Effector)
- `src/models/streamings/` - current streaming service
- `src/models/settings/` - persisted settings (`withPersist`)
- `src/models/subs/` - raw captions, processed subs, current cue, delay
- `src/models/translations/` - word lookup cache, hover state, line translation
- `src/models/videos/` - video element and time tracking

### Extension Structure
- `src/pages/content/` - content script UI (subtitles, settings panel, progress bar)
- `src/pages/background/` - MV3 service worker (API calls, offscreen relay, Google sign-in)
- `src/pages/offscreen/` - ONNX runtime host
- `src/pages/popup/` - toolbar popup (dictionary status, sign-in/out, link to settings)
- `src/pages/options/` - settings page (hover/click actions, offline dictionary, account); shared panels in `src/pages/shared/`
- `src/pages/welcome/` - first-run page opened on install (dictionary download, actions, sign-in, test video)
- `store/` - Chrome Web Store listing text, screenshots, promo tile; `PRIVACY.md` is the privacy policy
- `manifest.js` embeds a public `key` so the unpacked extension ID is stable; the private key is outside the repo (`~/.himotoki-sub/extension-key.pem`)
- `public/` - manifest assets, locales (en, ja, id), model, `onnxruntime-web` wasm files
- `manifest.js` - manifest generation for Chrome/Firefox

### Learning services
`src/learning-service/`: `himotoki.ts` (Convex `saved:addFavorite` via background) and `anki.ts` (AnkiConnect). Selected in settings via `getLearningService`.

## Key Files
- `src/pages/content/main.tsx` - content script entry: service detection, mounting settings and subs UI
- `src/models/init.ts` - initializes all Effector models
- `src/split/model.ts` - ONNX inference + Viterbi decoding
- `src/split/postprocess.ts` - segment fix-ups (known compounds, pronoun+particle peeling)
- `src/shared/himotokiConfig.ts` - API base URL, dictionaries, Convex URL, OAuth client ID
