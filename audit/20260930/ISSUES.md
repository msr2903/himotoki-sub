# Confirmed audit reports — 2026-09-30

16 new reports. Source remains unchanged; evidence tests deliberately assert incorrect behavior and are not fixes. Scope and duplicate checks appear in each issue.

- [[P1] In-flight account operations survive sign-out and can save into a different account](https://github.com/msr2903/himotoki-sub/issues/102)
- [[P2] Temporary token-refresh rate limiting deletes the sign-in session](https://github.com/msr2903/himotoki-sub/issues/103)
- [[P2] Firefox dictionary paths require the unavailable chrome.offscreen API](https://github.com/msr2903/himotoki-sub/issues/104)
- [[P2] Late caption fetches overwrite a newer video or restore subtitles after reset](https://github.com/msr2903/himotoki-sub/issues/105)
- [[P1] Failed dictionary update destroys the working database and falsely reports Ready](https://github.com/msr2903/himotoki-sub/issues/106)
- [[P2] Late settings hydration shows an old choice while storage contains the new one](https://github.com/msr2903/himotoki-sub/issues/107)
- [[P2] Old slow-replay timers override newer speed choices and cut subsequent replay short](https://github.com/msr2903/himotoki-sub/issues/108)
- [[P2] Valid dictionary downloads fail when the header is split across stream chunks](https://github.com/msr2903/himotoki-sub/issues/109)
- [[P2] Concurrent word-status edits in two tabs silently lose one word](https://github.com/msr2903/himotoki-sub/issues/110)
- [[P2] Disabled extension still intercepts keyboard and mouse playback controls](https://github.com/msr2903/himotoki-sub/issues/111)
- [[P2] In-flight dictionary install silently undoes a successful Remove](https://github.com/msr2903/himotoki-sub/issues/112)
- [[P2] Cache inherited properties suppress lookups and translation for constructor and toString](https://github.com/msr2903/himotoki-sub/issues/113)
- [[P2] Caption observers survive video replacement and publish old-video subtitles](https://github.com/msr2903/himotoki-sub/issues/114)
- [[P2] Anki audio capture overwrites newer playback actions and overlapping captures restore temporary state](https://github.com/msr2903/himotoki-sub/issues/115)
- [[P2] Online popup and mining discard usually-kana headwords such as コーヒー and どこ](https://github.com/msr2903/himotoki-sub/issues/116)
- [[P2] Saved-word CSV and JSON exports omit headwords for normal dictionary entries](https://github.com/msr2903/himotoki-sub/issues/117)

Existing report strengthened instead of duplicating: [#71 — ready-to-ready revision cache invalidation](https://github.com/msr2903/himotoki-sub/issues/71#issuecomment-5904162643).
