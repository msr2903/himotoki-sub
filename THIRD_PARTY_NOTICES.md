# Third-party notices

Himotoki Sub is MIT-licensed (see [LICENSE](./LICENSE)). It builds on other projects and ships or downloads
data under their own licences, listed here.

## Code this project is derived from

| Project | Licence | Notes |
| --- | --- | --- |
| [EasySubs](https://github.com/Nitrino/easysubs) by Petr Stepchenko (Nitrino) | MIT | Upstream of this fork. |
| [chrome-extension-boilerplate-react-vite](https://github.com/Jonghakseo/chrome-extension-boilerplate-react-vite) by Seo Jong Hak | MIT | Build setup inherited through EasySubs. |

## Bundled with the extension

| Component | Licence | Where |
| --- | --- | --- |
| Word-splitting model (`public/models/default.onnx`), trained in [himotoki-split](https://github.com/msr2903/himotoki-split) | MIT | `public/models/` |
| [ONNX Runtime Web](https://github.com/microsoft/onnxruntime) | MIT | `public/ort/`, bundled JS |
| [SQLite WASM](https://sqlite.org/wasm) (`@sqlite.org/sqlite-wasm`) | Apache-2.0 (SQLite itself is public domain) | bundled JS/WASM |
| [Newsreader](https://github.com/productiontype/Newsreader) font | SIL Open Font License 1.1 | `public/fonts/`, licence in `public/fonts/OFL-Newsreader.txt` |
| [Zen Maru Gothic](https://github.com/googlefonts/zen-marugothic) font | SIL Open Font License 1.1 | `public/fonts/`, licence in `public/fonts/OFL-ZenMaruGothic.txt` |

Other npm dependencies (React, Effector, Convex client, fflate, …) keep their own licences; see `pnpm licenses list`.

## Offline dictionary (downloaded on first run)

The dictionary file (`jitendex-lite.sqlite.gz`, published as a release of this repository and built by
`scripts/build-dict.py`) combines:

| Data | Source | Licence |
| --- | --- | --- |
| Entries, readings, meanings | [Jitendex](https://jitendex.org/) by Stephen Kraus, built from [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html) (EDRDG) | CC BY-SA 4.0; JMdict under the [EDRDG licence](https://www.edrdg.org/edrdg/licence.html) |
| Example sentences | [Tatoeba](https://tatoeba.org/) (via Jitendex) | CC BY 2.0 FR |
| Pitch accent | [Kanjium](https://github.com/mifunetoshiro/kanjium) by mifunetoshiro | CC BY-SA 4.0 |
| JLPT levels | [jlpt-word-list](https://github.com/elzup/jlpt-word-list) by elzup, based on Jonathan Waller's [tanos.co.uk](http://www.tanos.co.uk/jlpt/) lists | MIT (list); tanos.co.uk lists CC BY |
| Frequency ranks | "JPDB v2.2 Frequency Kana" (jpdb, Kuuube, Gecko), as distributed for Yomitan | **Not confirmed.** No licence was found for this list; confirm redistribution terms before publishing a new dictionary release. |

Because Jitendex and Kanjium are CC BY-SA 4.0, the combined dictionary file is shared under CC BY-SA 4.0.
