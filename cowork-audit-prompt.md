# Task: Test the Himotoki-sub Chrome extension with computer use and report what is broken or missing

You have computer-use access to my Mac. Use Google Chrome and my mouse/keyboard to load and exercise a browser extension, then write a detailed findings report that another engineer (Claude Code, working in the repo) will use to fix problems. Do not modify any files in the project. Your job is to observe and report.

## What the extension is

Repo: `/Users/LENOVO/Projects/himotoki-sub`
It is a fork of EasySubs, a Chrome extension for learning languages from subtitles on YouTube and other streaming sites. This fork adds a "Himotoki" integration for Japanese:

- Japanese subtitle lines are segmented into words locally with an ONNX model that runs in an offscreen document (onnxruntime-web).
- Hovering a word shows Himotoki dictionary glosses and readings, fetched from `https://himotoki.my.id/api/search` and `/api/entry`.
- On YouTube it prefers Japanese caption tracks when they exist.
- The popup (toolbar icon) has Google sign-in to a Himotoki account (chrome.identity + a Convex backend at `resolute-parakeet-238.convex.cloud`).
- A "Himotoki" learning service lets you save a hovered word to your Himotoki favorites.
- Other learning services (Anki, LinguaLeo, Puzzle English) and translators (Google, DeepL, Bing, Yandex, OpenAI) come from upstream EasySubs.

The built extension is already in `/Users/LENOVO/Projects/himotoki-sub/dist`. If that folder is missing or stale, open Terminal in the repo and run `./node_modules/.bin/vite build`.

## Setup

1. Open Google Chrome. Go to `chrome://extensions`, turn on Developer mode (top right), click "Load unpacked", and select `/Users/LENOVO/Projects/himotoki-sub/dist`.
2. If it fails to load, screenshot the error text exactly and stop the setup section, but still report.
3. Click the extension's "Errors" button if one appears and copy every error.
4. Click "Reload" on the extension card once (the README says this is needed for the `himotoki.my.id` host permission).
5. Open the service worker link on the card ("service worker" / "Inspect views") so a DevTools window is available for the background script. Keep it open and check its Console at the end.

## Tests to run

For each test, note PASS / FAIL / PARTIAL, what you saw, and take a screenshot when something looks wrong.

### A. Popup
1. Click the extension icon in the toolbar. Describe everything shown: any layout problems, unstyled text, missing icons, broken fonts, text overflowing.
2. Click "Sign in with Google" (or equivalent). Complete the Google sign-in with my account if a Google account picker appears. Report whether it succeeds, the exact error text if not, and whether the popup shows my name/email/avatar afterward.
3. Sign out and confirm the popup returns to the signed-out state.

### B. YouTube, Japanese video with captions
Use this video, which has Japanese captions: `https://www.youtube.com/watch?v=Fjxgk_Ee_9M` (if it has no Japanese captions, find any Japanese-language video with a "Japanese" entry in YouTube's CC menu and say which one you used).
1. Does an EasySubs/Himotoki settings button appear in the YouTube player controls? Screenshot the control bar.
2. Do subtitles from the extension render over the video (they are separate from YouTube's own CC)? Are they Japanese? Are they in sync with the audio?
3. Are Japanese lines visibly split into individual words (each word separately hoverable)? Or is the whole line one block?
4. Hover a word. Does the video pause? Does a translation popup appear? Does it show a Himotoki dictionary gloss in English and a reading (kana)? How long does it take? Screenshot the popup.
5. Move the mouse off the subtitle. Does the video resume?
6. Click a whole subtitle line. Does a full-line translation appear?
7. In the hover popup, look for a "+" or save button. Click it. Does it say "Saved to Himotoki" / "Already in Himotoki favorites" / an error? Test this both signed in and signed out.
8. Open the extension's settings panel from the player button. List every setting shown. Try changing: subtitle language, translation language, learning service (pick Himotoki), font size, toggling auto-pause. Report anything that does not visibly take effect.
9. Change the YouTube CC track to English via YouTube's own gear menu. Do the extension subtitles switch or stay Japanese?
10. Navigate to a second video without reloading the page (click a related video). Do subtitles load for the new video?
11. Reload the page. Do subtitles come back?

### C. YouTube, English video
Open `https://www.youtube.com/watch?v=jNQXAC9IVRw` or any English video with captions. Do subtitles render, and does hovering an English word still give a translation? Note whether behavior for non-Japanese content regressed.

### D. Console and network
1. On the YouTube tab, open DevTools (View > Developer > JavaScript Console). Filter for `himotoki`, then clear the filter and copy every red error and yellow warning, verbatim, with the source file names.
2. In the Network tab, filter `himotoki.my.id` and `convex.cloud`. List each request: URL path, status code, and approximate response time. Note any 4xx/5xx, CORS errors, or requests that never complete.
3. Check the service worker DevTools console from setup step 5 and copy any errors there too.
4. Check `chrome://extensions` again for new errors on the card.

### E. Other sites (quick)
Open a Netflix page if I am logged in, otherwise skip. Report only whether the extension button appears and whether any console errors mention the extension.

## Report format

Write the report as a markdown file at `/Users/LENOVO/Projects/himotoki-sub/cowork-audit-report.md` and also paste it in chat. Structure:

1. **Environment**: Chrome version (from `chrome://version`), macOS version, whether the extension loaded, extension ID shown on the card.
2. **Results table**: one row per test above with PASS/FAIL/PARTIAL and a one-line note.
3. **Defects**: for each failure, a numbered entry with: steps to reproduce, expected vs actual, exact error text, and the screenshot path. Be literal. Quote error messages exactly, do not paraphrase.
4. **Missing features**: anything the description above promises that you could not find in the UI at all.
5. **UI/visual issues**: layout, styling, fonts, dark/light theme problems, anything misaligned or clipped.
6. **Raw logs**: the console errors and the network request list from section D, pasted in code blocks.

Save screenshots to `/Users/LENOVO/Projects/himotoki-sub/screenshots/audit/` with descriptive names.

## Rules

- Do not edit source files, do not run git commands, do not commit.
- Do not enter passwords or payment details yourself; if a sign-in form needs my password, stop and ask me to type it.
- If a step is impossible, say so and why, then continue with the rest. A partial report is far better than none.
- Precision over polish: the reader needs exact error strings, URLs, and status codes.
