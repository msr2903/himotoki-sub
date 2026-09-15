<p align="center">
  <img height="80" src="./logo.png">
</p>
<p align="center">
  <h2 align="center">Himotoki Sub – learn Japanese from subtitles</h2>
</p>

Browser extension that turns the subtitles of YouTube, Netflix and other streaming sites into a Japanese study tool. Every subtitle line is split into words with a local model, and hovering or clicking a word opens a [Himotoki](https://himotoki.my.id) dictionary popup. Words can be saved to your Himotoki account or to Anki.

Forked from [EasySubs](https://github.com/Nitrino/easysubs). The multi-language features of EasySubs (Google word translation, phrasal verbs, English dictionaries, LinguaLeo, Puzzle English) have been removed; this project is Japanese-only.

## How it works

1. **Word splitting runs locally.** A character-level BiLSTM + CRF model (`public/models/default.onnx`, trained in [himotoki-split](https://github.com/msr2903/himotoki-split)) runs inside the extension through `onnxruntime-web` in an offscreen document. No text leaves the browser for segmentation. Until the model has run, cues are painted with `Intl.Segmenter` so subtitles appear instantly.
2. **Dictionary lookup is local.** On first use the extension popup offers to download a trimmed Jitendex database (about 38 MB compressed, 185 MB unpacked) into the browser's origin-private file system. Lookups then run in an extension worker with SQLite compiled to WebAssembly, including deinflection (the same rules engine as the Himotoki server), and answer in a few milliseconds. Until the dictionary is installed, words are looked up through `GET https://himotoki.my.id/api/search` and the popup says so.
3. **Whole-line translation** is optional: clicking a subtitle line outside a word shows a machine translation of the full line via Google Translate or DeepL, in the language chosen in settings.
4. **Saving words.** Sign in with Google from the extension popup to save words (with the sentence, video URL and timestamp) to Himotoki favorites, or choose Anki in settings to send them to a local AnkiConnect (`http://localhost:8765`).

## Supported sites

YouTube, Netflix, KinoPub, Coursera, Plex, Udemy, Kinopoisk, Amazon Prime Video, inoriginal.online. On YouTube a Japanese caption track is preferred automatically when the video has one.

## Build

1. Install Node 20+ and pnpm.
2. `pnpm i`
3. `pnpm build` (Chrome) or `pnpm build:firefox`
4. Load the `dist/` folder as an unpacked extension (`chrome://extensions`, developer mode, "Load unpacked"). Reload the extension once after the first install so the `https://himotoki.my.id/*` host permission is granted.

`pnpm dev` starts a watch build with hot reload.

### Offline dictionary file

The extension downloads `jitendex-lite.sqlite.gz` from the URL in `src/shared/himotokiConfig.ts` (`HIMOTOKI_DICT_URL`, default `https://himotoki.my.id/dicts/jitendex-lite.sqlite.gz`). Build that file from a Jitendex SQLite produced by himotoki-web-ts and upload it there:

```bash
python3 scripts/build-dict.py /path/to/himotoki-web-ts/data/dicts/jitendex.sqlite dist-dict
# → dist-dict/jitendex-lite.sqlite.gz (+ .json manifest with revision and sha256)
```

For local testing you can point the extension at any URL by setting `himotokiDictUrl` in `chrome.storage.local` (the end-to-end scripts do this).

### End-to-end checks

```bash
npx playwright install chromium
pnpm test:e2e                                   # YouTube: split, popup, settings, hotkeys
node scripts/e2e/dict.mjs /tmp/himotoki-dict    # offline dictionary: install, lookups, repair, persistence
HIMOTOKI_DICT_DIR=/tmp/himotoki-dict pnpm test:e2e   # YouTube with the offline dictionary installed
```

> Firefox note: the local word splitter relies on `chrome.offscreen`, which Firefox does not implement. On Firefox the extension currently falls back to `Intl.Segmenter`.

## Features

- Subtitles overlaid on the player, draggable, with adjustable size, background and delay.
- Hover and click on a word are configured separately in the extension settings page (toolbar popup → Settings, or `chrome://extensions` → Details → Extension options). Each can be **Furigana**, **Meaning**, **Furigana + meaning**, **Pop-up dictionary** or **No action**. Hover results vanish when the pointer leaves; click results stay pinned until Escape, a click elsewhere, or the next subtitle. Defaults: hover shows furigana + meaning, click pins the pop-up dictionary.
- Whole-line machine translation on click (Google Translate or DeepL, with optional DeepL API key).
- Furigana: inline readings over kanji words, always or on hover, from the local dictionary. Channels that print a kana reading line under the kanji line are detected; hide that line (furigana replaces it) or keep it as text.
- Dual subtitles: a second line under the Japanese one, either the video's own subtitle track in your "Translate to" language (on YouTube, its auto-translation when no such track exists) or a machine translation of the current line. Off by default; switch in the settings or press `d` in the player.
- Save words to Himotoki favorites or Anki.
- Mark words as known from the pop-up (saving marks them automatically) and optionally dim known words so unknown ones stand out.
- Subtitle progress bar; rewind to previous/next/current subtitle with the arrow keys (`alt` + arrow forces the jump).
- Pause while hovering a word, or pause after every subtitle.
- Upload your own `.srt` / `.vtt` subtitles when a site has none.

## Using alongside Yomitan

Yomitan scans any text on the page, including this extension's subtitle overlay, so with both enabled you may see two pop-ups. Either add `youtube.com` (and the other video sites) to Yomitan's excluded sites, or set this extension's hover action to "No action" and keep click for the Himotoki pop-up.

## Manual QA before a release

Automated checks cover Playwright's Chromium; do this once in your real Chrome profile:

1. Load `dist/` unpacked, reload once (host permission), open a video with Japanese captions.
2. Hover several adjacent words: labels must follow the pointer without flicker.
3. Click a word: pop-up pins, stays while the pointer leaves, closes on Escape.
4. Settings page: download the dictionary, then confirm the "Online lookup" footer disappears.
5. With Yomitan enabled, confirm only one pop-up appears (see above).
6. Sign in, save a word, check it on himotoki.my.id.

## Contributing

Issues and pull requests are welcome. Please open an issue to discuss larger features before implementing them.
