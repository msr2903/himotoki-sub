# Himotoki-sub Chrome extension — Cowork audit report

Date: 2026-09-13 (JST, ~21:30–21:55)
Auditor: Claude (Cowork session, driving Chrome via the Claude in Chrome extension; chrome:// pages observed via read-only screen capture)
Repo: `/Users/LENOVO/Projects/himotoki-sub` — **no source files were modified; no git commands were run to change state** (one read-only `git log` was executed early on while orienting).

Screenshots: `screenshots/audit/` (paths below are relative to the repo).

> How this audit was run, and what that means for coverage
> - Chrome could only be driven through the Claude in Chrome extension (CDP-style input). It cannot open `chrome://` pages, toolbar popups, or `chrome-extension://` pages that are not web-accessible. The popup page (`src/pages/popup/index.html`) is **not** in `web_accessible_resources`, so **section A (popup / Google sign-in / sign-out) could not be executed** — the user chose to stop before the manual-assist step. Items are marked NOT RUN.
> - The background service worker's own DevTools console could not be opened for the same reason (setup step 5) — NOT RUN. The extension card on `chrome://extensions` showed **no "Errors" button** before and after testing.
> - The requested test video `https://www.youtube.com/watch?v=Fjxgk_Ee_9M` shows **"This video isn't available anymore"**. Substitute used: **`https://www.youtube.com/watch?v=Jh2C7JlWGKU`** ("Comprehensible Japanese Beginner - My Morning Routine", Nihongo-Learning; caption tracks: `en`, `ja` — verified via `ytInitialPlayerResponse.captions`). Second video for SPA navigation: `J62Y_9kuP_k` (same channel, tracks `en`, `ja`). English video: `jNQXAC9IVRw` ("Me at the zoo", tracks `en`, `de`).
> - Another extension, **Yomitan Popup Dictionary 26.7.29.0**, is installed and enabled in the same profile. I did not see it interfere, but it is a potential confound for hover tests.

---

## 1. Environment

| Item | Value |
|---|---|
| Chrome | Google Chrome **153.0.8010.36** (from `navigator.userAgentData.getHighEntropyValues`; UA string `Chrome/153.0.0.0`). `chrome://version` could not be opened by automation. |
| OS | macOS, `platformVersion` **26.6.2**, arch **arm** (Apple Silicon). Chrome reports "Your browser is managed by your organization". |
| Extension loaded | **Yes** — card shows "Himotoki Sub – Learn Japanese from su…" **3.1.3**, enabled, Developer mode on. Card description: "Japanese subtitle segmentation and Himotoki dictionary lookup while watching YouTube and other streaming sites. Save words to your…". |
| Extension ID | **`mafghgemjgpllpkacicalehbmdkacbhk`** |
| Errors button on card | **None shown** (before tests at 21:33 and at end of session). |
| Service worker | Link on card read "service worker (Inactive)"; could not be opened by automation. |
| `dist/` freshness | `dist/manifest.json` built 2026-09-13 12:14; no `src/` file newer than it. Manifest: MV3, `background.type: module`, permissions `scripting, storage, activeTab, offscreen, identity`; host permissions include `https://himotoki.my.id/*`, `https://*.convex.cloud/*`, `https://accounts.google.com/*`; `oauth2.client_id = 584773048392-114lmg42epe0gig6a9edmhshs20kkmti.apps.googleusercontent.com`. |
| Install side-effect | On load, the background `onInstalled` handler opened a tab to `https://himotoki.my.id` (tab "Himotoki — Japanese Diction…" was visible in the window). |
| Other extensions in profile | Claude 1.0.93, Google Translate 2.0.17, Yomitan Popup Dictionary 26.7.29.0 |

---

## 2. Results table

| # | Test | Result | Note |
|---|---|---|---|
| S1 | Load unpacked from `dist` | PASS | Loaded, ID `mafghgemjgpllpkacicalehbmdkacbhk`, v3.1.3 |
| S2 | Load error text | PASS | No load error |
| S3 | "Errors" button on card | PASS | No Errors button present |
| S4 | Reload once (host permission) | PASS (by user) | User reloaded before handing over |
| S5 | Service worker DevTools console | NOT RUN | Cannot open chrome:// / DevTools via automation |
| A1 | Popup layout | NOT RUN | Popup page not web-accessible; needs manual click on toolbar icon |
| A2 | Sign in with Google | NOT RUN | Same |
| A3 | Sign out | NOT RUN | Same |
| B1 | Settings button in YouTube controls | PASS | "H" button in `.ytp-right-controls-right`, between gear and miniplayer. `B1_player_controls_H_button.jpg`, `B1_player_control_bar_zoom.png` |
| B2 | Extension subtitles render, Japanese, in sync | **FAIL** (initial) / PASS (after YouTube CC = Japanese) | On fresh load with YouTube CC set to English, extension overlay shows **English** even though a `ja` track exists. Root cause identified (Defect 1). Once YouTube's own player had fetched the `ja` track, overlay became Japanese and stayed in sync. |
| B3 | Japanese lines split into hoverable words | PASS (with quality defects) | Each token is a separate `<pre class="es-sub-item">`. Segmentation quality issues: Defects 2 and 3. |
| B4 | Hover → pause, popup, gloss + reading, timing | PASS | Video pauses; popup shows headword, reading (kana), English glosses with POS tag, "Himotoki" footer. Measured **~0.72 s** from hover to gloss render (`め`). `B4_jp_hover_popup_zoom.png` |
| B5 | Mouse off → resume | PASS | Resumes within ~1 s (with default settings) |
| B6 | Click whole line → full-line translation | **FAIL** (Japanese) | Nothing happens on Japanese lines. Code intentionally skips (`if (!japanese) setShowTranslation(true)`). Works on English lines (see C). |
| B7 | "+" save button, signed out | PASS (message) | Two "+" buttons rendered (header + per-gloss). Click → red toast **"Sign in via the extension popup first."** `B7_save_signed_out_toast.jpg`. Signed-in case NOT RUN. |
| B8 | Settings panel; change settings | PARTIAL | All settings listed in §5. Translate-to, learning service, font size take effect. **No subtitle-language setting exists.** "Auto pause" label is misleading (Defect 6). First-hover language prompt appears (Defect 7). |
| B9 | Change YouTube CC to English | PASS | Extension overlay **stays Japanese** (by design: prefers JP). `B9_yt_cc_english_extension_stays_japanese.jpg` |
| B10 | SPA navigate to related video | PARTIAL | Overlay + H button load for the new video, but overlay is **English** again (Defect 1). `B10_spa_nav_second_video_english_subs.jpg` |
| B11 | Reload page | PASS | Overlay returns (English, Defect 1) |
| C | English video, hover translation | PASS | Subs render, hover → "Looking up…" then Google translation (`trunks → batang`, Indonesian) + Cambridge/Forvo/Urban/YouGlish icons; full-line click → "batangnya sangat panjang". No regression. Defect 5: "+" shown for English words errors. |
| D1 | YouTube tab console errors/warnings | PASS | **Zero** extension errors or warnings captured on either YouTube video (only YouTube's own `LegacyDataMixin` info line). |
| D2 | Network himotoki.my.id / convex.cloud | PARTIAL | Extension makes these calls from the **service worker**, so they don't appear in the tab's network log. Probed endpoints directly from the page instead: all 200, 81–117 ms (§6). No convex.cloud traffic observed (sign-in not exercised). |
| D3 | Service worker console | NOT RUN | See S5 |
| D4 | chrome://extensions errors after tests | PASS | Card still shows no Errors button (screen capture at end) |
| E | Netflix | PARTIAL | Not logged in → login page only. Extension's injected `netflix.js` throws an exception on the login page (Defect 8). No H button (no player). |

---

## 3. Defects

### Defect 1 — Japanese track is not used on load: extension's `timedtext` fetches return an empty body (no `pot` token), so the overlay falls back to YouTube's active English track

**Severity: High (core promise "prefers Japanese caption tracks" fails on every fresh load / SPA navigation)**

Steps to reproduce
1. YouTube CC language = English (the default on this account). Open `https://www.youtube.com/watch?v=Jh2C7JlWGKU` (tracks `en`, `ja`).
2. Wait ~10 s.

Expected: overlay shows the `ja` track.
Actual: overlay shows English: `.es-sub` text = `"What do you do when you wake up in the morning ?"`, items `["What","do","you","do","when","you","wake","up","in","the","morning","?"]`. Same on SPA navigation to `J62Y_9kuP_k` (`"What kind of weather do you like?"`) and after reload.

Evidence (tab network log, filtered `timedtext`, after one page load):
```
GET https://www.youtube.com/api/timedtext?v=Jh2C7JlWGKU&...&key=yt8&lang=ja&fmt=json3            200   (x5, no pot=)   ← extension
GET https://www.youtube.com/api/timedtext?v=Jh2C7JlWGKU&...&key=yt8&lang=en&potc=1&pot=MlOf...&fmt=json3&xorb=2&...&cbrver=153.0.0.0&c=WEB&cver=2.20260911.01.00...   200   (x2)   ← YouTube player
```
Direct check from the page: fetching `captionTracks.find(t=>t.languageCode==='ja').baseUrl + '&fmt=json3'` (no `pot`) → **HTTP 200, `Content-Length` 0, body `""`** (`Unexpected end of JSON input` when parsed). The same URL with the player's `pot=…` parameter returns the full track.

Why the overlay ends up English: `src/streamings/youtube.ts#getSubs` tries `ja`/`ja-JP` URLs (empty → `subs.length === 0`), then falls through to `cachedLangs` from `handleCaptionsData`, which contains the **English** URL captured from the player's own fetch (which has `pot`). Result: English subs, and `hasJapaneseTrack()` still returns true so `esSubsChanged("ja")` keeps being emitted with English data.

Confirmation: as soon as YouTube's own player requested the `ja` track (network entries 20–21: `lang=ja&potc=1&pot=…`), the overlay switched to Japanese (at ~1:33 of the video) and everything Japanese-specific worked. Setting YouTube CC back to English afterwards did **not** revert the overlay (B9), because the pot-bearing `ja` URL was now cached.

Fix hints for the engineer: reuse the `pot`/`potc` (and `xorb/xobt/xovt/c/cver/…`) query params from any player timedtext URL seen in `handleCaptionsData` when building the `ja` URL; or treat a 200-with-empty-body as failure and drive the player to select the `ja` track (`player.setOption('captions','track',{languageCode:'ja'})`) so the player fetches it and `handleCaptionsData` caches a working URL; or use the youtube-caption-extractor path if it handles `pot`.

Screenshots: `screenshots/audit/B2_jp_video_initial_load_english_subs.jpg`, `B10_spa_nav_second_video_english_subs.jpg`

---

### Defect 2 — Segmenter splits kanji verb stems from their okurigana (開|け|ます, 閉|め|ます, 起|き|たら, 言|われ|てい|ます, の|う)

**Severity: High (wrong dictionary entry on hover; e.g. `め` → "sprout; shoot; bud")**

Steps
1. With Japanese overlay active on `Jh2C7JlWGKU`, observe the token list at ~1:33 and ~1:42.

Actual token lists (from `.es-sub-item` textContent):
- `そして | 次に | カーテン | を | 開 | け | ます | そして | つぎ | に | カーテン | を | あけ | ます`
- `夜 | は | カーテン | を | 閉 | め | ます | …` — hovering `め` shows **"め / sprout; shoot; bud (noun); germinal disk (in an egg) (noun)"** instead of 閉める.
- `太陽 | の | 光 | は | 脳 | を | 起こす | の | に | 、 | とても | 良い | と | 言 | われ | てい | ます | たいよう | の | ひかり | は | の | う | を | おこす | …` — `脳`'s kana reading `のう` becomes `の | う`; `言われています` becomes `言 | われ | てい | ます`.
- `だから | 起 | き | たら …`

Expected: `開け|ます` (or `開けます`), `閉め|ます`, `起き|たら`, `言われ|てい|ます`, `のう`.

Note that `起こす` and `良い` were segmented correctly, so this looks like a model/post-processing issue specifically at kanji→hiragana boundaries inside a word (CRF/ONNX label post-processing in `src/split/postprocess.ts` is the first place to look).

Screenshot: `screenshots/audit/B4_jp_hover_popup_me_sprout_bad_segmentation.jpg`, `B4_jp_hover_popup_zoom.png`

---

### Defect 3 — Multi-line YouTube caption events are concatenated without a separator, so the kanji line and its furigana/kana line are merged into one sentence for segmentation

**Severity: Medium-High**

YouTube's `ja` track for this channel has two lines per cue (kanji line + all-kana line). YouTube's native caption shows them separated: `そして次にカーテンを開けます | そして　つぎに　カーテンを　あけます` (two `.ytp-caption-segment`s). The extension renders one string: **`そして次にカーテンを開けますそしてつぎにカーテンをあけます`**, and later **`太陽の光は脳を起こすのに、とても良いと言われていますたいようのひかりはのうをおこすのに、とてもよいといわれています`** (4 wrapped lines on screen). The segmenter then runs over the joined text (contributing to Defect 2 on the kana half), the overlay is twice as long as it should be, and the `contextSentence` sent to Himotoki favorites will contain the duplicated kana.

Expected: keep line breaks (`\n`) between cue lines, or at least insert a space; ideally offer a setting to hide the kana duplicate line.

Screenshot: `screenshots/audit/B7_jp_hover_popup_taiyou_with_plus.jpg`

---

### Defect 4 — No full-line translation for Japanese lines (click does nothing)

**Severity: Medium (feature promised in README "Click the subtitles to translate the entire phrase")**

Steps: with Japanese overlay, click the subtitle background (left padding of `.es-sub`, not a word).
Expected: full-line translation bubble (as it does for English: `C_english_full_line_translation_zoom.png`).
Actual: nothing renders; `.es-sub` children remain only `es-sub-item` elements. Code: `Subs.tsx` `handleOnClick` → `if (!japanese) setShowTranslation(true)`; `{showTranslation && !japanese && <SubFullTranslation …/>}`. Either wire full-line translation for Japanese (Google translate of `sub.cleanedText`) or document it as intentionally disabled.

---

### Defect 5 — Himotoki "+" (save) button is rendered for non-Japanese words and fails with a misleading message

**Severity: Low-Medium**

Steps: Learning service = Himotoki. Open `jNQXAC9IVRw`, hover `trunks`, click the "+" next to the translation `batang`.
Expected: no "+" for non-Japanese words when the Himotoki service is selected (or a clear "Himotoki only saves Japanese words" message).
Actual: red toast **"No dictionary entry to save. Hover the word again and retry."** — the advice is wrong (re-hovering never helps for English).
Screenshots: `screenshots/audit/C_plus_on_english_word_error_toast.jpg`, `C_plus_on_english_word_error_toast_zoom.png`

---

### Defect 6 — Two similarly named pause settings; "Auto pause" (General) does not do what the label implies and leaves the video paused

**Severity: Low (UX/labeling)**

- General → **"Auto pause"** (default OFF) is actually "pause at the end of every subtitle" (`$autoPause` → `autoPauseFx` in `src/models/subs/init.ts`). With it ON, the video stops at each cue end and does not resume when the mouse leaves the subtitle (observed: `pausedAfterLeave: true` twice; the user has to press play each time).
- Experiments → **"Enable auto stop"** (default ON) is the hover-to-pause behaviour (`$autoStopEnabled` in `Subs.tsx`). With it OFF, hovering a word no longer pauses (verified).
Recommendation: rename to "Pause after each subtitle" / "Pause while hovering a word" and move hover-pause out of "Experiments".

---

### Defect 7 — First-ever hover shows "Select the translation language:" inside the word popup instead of a gloss; typing into that react-select drops keystrokes

**Severity: Low-Medium (first-run UX)**

Steps: fresh install, hover an English word.
Actual: popup shows **"Select the translation language:"** with a react-select defaulting to "English" (`.es-word-translation-languages`). Until a language is chosen, no translation is shown for any word. Typing `Indonesian` into the search produced `Indonesin` ("No options") — one keystroke was swallowed, presumably by YouTube's keyboard shortcuts. Selecting an option then closed the popup and the paused video resumed by itself.
Note: for Japanese words the Himotoki gloss language is hard-coded to `eng` (`HIMOTOKI_GLOSS_LANG`), so this prompt is irrelevant to the Japanese flow but still blocks it visually if the first hover is on an English cue.
Screenshots: `screenshots/audit/B4_first_hover_asks_translation_language.jpg`, `B4_first_hover_asks_translation_language_zoom.png`

---

### Defect 8 — Injected `netflix.js` throws on the Netflix login page

**Severity: Low (upstream code; noisy console error on non-player pages)**

Console (netflix.com/jp-en/login, not logged in):
```
[EXCEPTION] (chrome-extension://mafghgemjgpllpkacicalehbmdkacbhk/assets/js/netflix.js:36:64)
TypeError: Cannot read properties of undefined (reading 'getAPI')
    at getPlayer (chrome-extension://mafghgemjgpllpkacicalehbmdkacbhk/assets/js/netflix.js:37:65)
    at chrome-extension://mafghgemjgpllpkacicalehbmdkacbhk/assets/js/netflix.js:56:20
```

---

### Defect 9 — README describes a different segmentation architecture than the build

**Severity: Low (docs)**

`README.md` says "Japanese subtitle lines are segmented via `POST https://himotoki.my.id/api/analyze`", but the extension segments locally in the offscreen document (`src/pages/background/index.ts` → `offscreen-split`, `dist/models/`, `dist/ort/`). `/api/analyze` does still respond (200, ~113 ms) but is not called. Update the README.

---

## 4. Missing features (promised in the task description, not found in the UI)

1. **Subtitle-language selector** — there is no setting to choose the subtitle track; the overlay follows "prefer `ja` else YouTube's active track" only. B8 "change subtitle language" could not be performed.
2. **Full-line translation for Japanese** (Defect 4).
3. **Himotoki-specific settings** — no way to set gloss language (hard-coded `eng`), dictionaries (`jitendex,jmdict`), or to toggle the furigana/kana duplicate line.
4. **Signed-in save flow** ("Saved to Himotoki" / "Already in Himotoki favorites") — not verifiable in this session (sign-in requires the popup; NOT RUN), so no evidence either way.
5. Popup items could not be inspected; note from source (`Popup.tsx`) that the menu still contains a leftover **"Enable on Kinopub"** entry (`chrome.permissions.request` for the current tab) which is unrelated to the Himotoki product surface.

---

## 5. UI / visual issues

- **Serif font on popup headline and translation headline.** In the word popup the top line ("Sun", "sprout", "batang") renders in a serif face (Times-like) while the rest of the popup is sans-serif — looks unintentional (probably a `font-family` fallback for the `.es-word-translation` header). `screenshots/audit/B7_popup_zoom_serif_header_font.png`, `C_english_hover_translation_popup_zoom.png`.
- **Overlay line length.** Because kanji+kana cue lines are joined (Defect 3), Japanese cues wrap to 3–4 lines and cover a large part of the video (`B7_jp_hover_popup_taiyou_with_plus.jpg`).
- **"+" button has class `es-settings-button`** — cosmetic/naming, but suggests copy-pasted styling.
- **Hover highlight vs. active state.** Hovering colours the token teal via CSS `:hover` immediately, but the popup can take up to ~0.7 s (Japanese) / several seconds (English, "Looking up…") — fine, but there is no spinner for Japanese lookups.
- Settings panel itself (General / Subtitles / Experiments) renders cleanly, dark theme, no clipping. Fonts: subtitles use `"Zen Maru Gothic", "Hiragino Sans", "Noto Sans JP", system-ui` at ~30 px (100 %) → ~33 px (110 %).
- Toasts (top-centre, white with red ✕ icon) are readable; text: "Sign in via the extension popup first." and "No dictionary entry to save. Hover the word again and retry."
- No layout problems observed with the H button or the subtitle progress bar under the player.

Settings inventory (B8):
- General: Enabled (on), Auto pause (off), Progress bar (on), Move by subs (on), Translate to (react-select; was "English", changed to "Indonesian" — persisted and reflected in the panel), Translation service ("Google Translate"), Learning service (options: **Himotoki, Anki, LinguaLeo, Puzzle English, Disabled**; default Himotoki; switching to Disabled removes the "+" buttons immediately, switching back restores them).
- Subtitles: Subtitles size (−/+, 100 % → 110 % applied immediately: `#es-subs` font-size 29.98 px → 32.97 px), Show background (on), Background opacity 50 %, Subtitles delay 0 s (≪ ‹ › ≫), Custom subtitles "Select file".
- Experiments: Enable auto stop (on).

---

## 6. Raw logs

### YouTube tab console (both Japanese videos and the English video; filter `.`; then `onlyErrors`)
```
[9:35:19 PM] [INFO] (https://www.youtube.com/s/_/ytmainappweb/_/js/k=ytmainappweb.kevlar_base.en_US.wDCKWufap4w.es5.O/.../kevlar_base_sync_mod_chunk:13004:8)
LegacyDataMixin will be applied to all legacy elements.
Set `_legacyUndefinedCheck: true` on element class to enable.
   (same line repeated 4x across page loads)

Filter "himotoki|Himotoki|es-|easysubs|split|onnx|ONNX": No console messages found for this tab.
onlyErrors: No console errors or exceptions found for this tab.
```

### Netflix tab console (login page, not logged in)
```
[9:49:10 PM] [EXCEPTION] (chrome-extension://mafghgemjgpllpkacicalehbmdkacbhk/assets/js/netflix.js:36:64)
TypeError: Cannot read properties of undefined (reading 'getAPI')
    at getPlayer (chrome-extension://mafghgemjgpllpkacicalehbmdkacbhk/assets/js/netflix.js:37:65)
    at chrome-extension://mafghgemjgpllpkacicalehbmdkacbhk/assets/js/netflix.js:56:20
```

### Service worker console
```
NOT CAPTURED — DevTools for the service worker cannot be opened by the automation available in this session.
```

### Network — `timedtext` requests on Jh2C7JlWGKU (tab log; 21 entries total, deduplicated here)
```
# extension (content script) — no PO token → 200 with EMPTY body
GET /api/timedtext?v=Jh2C7JlWGKU&ei=h5imauCFN-jt2roP8KzJ6QE&caps=asr&opi=112496729&exp=xpe&xoaf=5&xowf=1&hl=en&ip=0.0.0.0&ipbits=0&expire=1789328119&sparams=ip%2Cipbits%2Cexpire%2Cv%2Cei%2Ccaps%2Copi%2Cexp%2Cxoaf&signature=0E9C2B54...&key=yt8&lang=ja&fmt=json3     200  (14 times over the session; one variant with sparams unencoded "ip,ipbits,expire,...")
# YouTube player — with PO token → real data
GET /api/timedtext?v=Jh2C7JlWGKU&...&key=yt8&lang=en&potc=1&pot=MlOfDs3cC2c0K58ym20q92FvGxViQkukEk7MMJbFPyTIaHsabtTTsW2x7Kqjkv_Tr-AC2mMaiaue_Pab477Dk5mm30MYAhQJxY4Da7lTeYc823leBw%3D%3D&fmt=json3&xorb=2&xobt=3&xovt=3&cbrand=apple&cbr=Chrome&cbrver=153.0.0.0&c=WEB&cver=2.20260911.01.00&cplayer=UNIPLAYER&cos=Macintosh&cosver=10_15_7&cplatform=DESKTOP     200  (4 times)
GET /api/timedtext?v=Jh2C7JlWGKU&...&key=yt8&lang=ja&potc=1&pot=MlOf...&fmt=json3&xorb=2&...&cplatform=DESKTOP     200  (2 times, from ~1:33 onward — this is when the overlay became Japanese)
```
`performance.getEntriesByType('resource')` on J62Y_9kuP_k after reload: only the player's `lang=en&pot=…` entry (13,432 B decoded, 348 ms) — the extension's `ja` requests were not present in the page's resource timing buffer.

### Network — himotoki.my.id / convex.cloud
```
Tab network log filtered "himotoki":  No requests   (calls are made by the service worker via chrome.runtime messages, invisible to the tab)
Tab network log filtered "convex":    No requests   (sign-in/favorite flows not exercised)

Direct probes from the YouTube page context (fetch, GET unless noted):
  GET  https://himotoki.my.id/api/search?q=太陽&page=1&limit=5&lang=eng&dicts=jitendex,jmdict   -> 200, 117 ms, 3,934 B, contains "results"
  GET  https://himotoki.my.id/api/entry/jitendex/1408340?lang=eng                                 -> 200,  81 ms,   291 B
  POST https://himotoki.my.id/api/analyze  {"text":"太陽の光"}                                     -> 200, 113 ms, 8,942 B, contains "tokens"
  (no Access-Control-Allow-Origin header was exposed to the page, but responses were readable in this context)
End-to-end hover→gloss latency observed in the UI: ~723 ms (め), ~2 s (太陽, includes hover debounce) — no 4xx/5xx, no CORS errors, no hanging requests observed.
```

### chrome://extensions
```
Himotoki Sub – Learn Japanese from su…  3.1.3   ID: mafghgemjgpllpkacicalehbmdkacbhk   Inspect views: service worker (Inactive)   [Details] [Remove] [↻] [enabled]
No "Errors" button before or after testing.
```

---

## Appendix — screenshot index (`screenshots/audit/`)

| File | What it shows |
|---|---|
| B2_jp_video_initial_load_english_subs.jpg | Fresh load of Jh2C7JlWGKU: overlay in English despite `ja` track (Defect 1) |
| B1_player_controls_H_button.jpg / B1_player_control_bar_zoom.png | YouTube control bar with the extension's "H" button |
| B4_hover_english_word_no_popup_after_3s.jpg | Hover highlight on "morning" with no popup yet |
| B4_first_hover_asks_translation_language.jpg / _zoom.png | First-run "Select the translation language:" prompt in the popup (Defect 7) |
| B4_jp_hover_popup_me_sprout_bad_segmentation.jpg / B4_jp_hover_popup_zoom.png | Japanese popup for `め` (閉めます mis-split) — Defect 2 |
| B7_jp_hover_popup_taiyou_with_plus.jpg / B7_popup_zoom_serif_header_font.png | Japanese popup for 太陽 with "+" buttons; serif headline |
| B7_save_signed_out_toast.jpg | "Sign in via the extension popup first." toast |
| B8_settings_general_tab.jpg / _subtitles_tab.jpg / _experiments_tab.jpg / B8_learning_service_options.jpg / B8_font_size_110pct.jpg | Settings panel |
| B9_yt_cc_english_extension_stays_japanese.jpg | YouTube CC = English, overlay still Japanese |
| B10_spa_nav_second_video_english_subs.jpg | After clicking a related video: overlay English (Defect 1) |
| C_english_video_subs.jpg / C_english_hover_looking_up.jpg / C_english_hover_translation_popup_zoom.png / C_english_full_line_translation_zoom.png | English video flow |
| C_plus_on_english_word_error_toast.jpg / _zoom.png | "+" on an English word → error toast (Defect 5) |
