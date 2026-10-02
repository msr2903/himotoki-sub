# Second Himotoki audit: Sub reproductions

Audited Sub commit: `0b58e739ed8e3e6c84a9ee5ff453f75429885392`. These probes assert the observed defects, so a passing assertion confirms the bad behavior.

Run from an isolated Sub checkout with its lockfile dependencies installed:

```sh
node /path/to/sub-progress-probe.mjs
node /path/to/sub-adapter-detection-probe.mjs
```

The progress probe bundles the actual React component and controls hooks, layout geometry and animation callbacks. It counts work and records handler output; it is not a browser timing benchmark. The adapter probe bundles the actual selector/getter code, with mock adapter instances for selection and controlled DOM elements for KinoPub getters. It does not claim a live authenticated streaming-site test. No accounts or cloud writes are involved.

## Lifecycle and Anki probes

Run `node sub-lifecycle-probe.mjs` and `node sub-anki-highlight-probe.mjs` from the same pinned Sub checkout. They bundle the actual content entry point, CustomSubs handler, Anki service and note builder with controlled React/model/DOM/file and AnkiConnect boundaries. They are not browser screenshots or measurements. All assertions check the observed defect; the unconjugated Anki case is a working control. No actual video, account or Anki collection is changed.

## Phrase snapshot reproduction

Run `AUDIT_APP_DIR=/path/to/installed/app node /path/to/sub-phrase-snapshot-probe.mjs` from the pinned Sub checkout. It uses Sub's actual React 18 and a jsdom dependency from App. The private PhraseBar is exposed by adding an export to the bundled source; its behavior is unchanged. Controlled translation/service boundaries isolate pending-save ownership. One Save click for an old phrase is followed by changing the selection and a cached translation for the new phrase. The real hook/effect rerender submits the new phrase without another Save click. No account/Anki collection is touched. This is a DOM/component test, not a real streaming-page screenshot.

## Adapter title precedence and caption markup (2026-10-02)
Run `node /path/sub-title-detection-probe.mjs` from the pinned Sub checkout. Actual detector, adapter constructor doubles; title/host DOM fixture. Public Coursera course: https://www.coursera.org/learn/twitter-linkedin-youtube-marketing . No live authenticated course playback tested.

Run `node /path/sub-caption-markup-build.mjs` from that checkout, then `python3 -m http.server 8899 --bind 127.0.0.1 --directory /tmp/himotoki-audit200-caption-markup`. Open loopback page in Chromium. Actual full converter, no implementation patch; wrapper exposes its exported fallback. A data-URL invalid image sets only a harmless boolean. Screenshot was inspected and shows that flag. No extension, real player, credentials or external network; fixture has no CSP. This proves unsafe markup evaluation in that environment, not a bypass of provider CSP or extension privileges.

## Coverage lifecycle probe
Copy `sub-coverage-refresh.test.ts` to `src/audit200-coverage-refresh.test.ts` in the pinned Sub checkout; run `pnpm exec vitest run audit200-coverage-refresh`. The real coverage effect, subtitle initialization graph, readiness graph and statistics store run in a scoped Effector test. Caption segmentation, settings, notifications and extension worker replies are controlled. No dictionary files, user storage, media or accounts are modified. The explicit coverage rerun is a recovery control, not an automatic production event.

## Anki transport deadline probe (2026-10-03)
Copy sub-anki-deadline.test.ts to src/audit200-anki-deadline.test.ts in pinned Sub 0b58e73; pnpm exec vitest run audit200-anki-deadline. TypeScript AST removes only background imports and runs the unchanged module statements in a VM with inert external dependency doubles. The actual onMessage/fetch chain and actual Anki.addWord run with fake Chrome messaging, controlled fetch and fake time. Both header and body stalls remain pending after 60 seconds with no timers/abort signal; releasing the response completes correctly. No live browser/service-worker lifetime, Anki collection, or real network is tested. Passing assertions confirm the application lacks its own deadline; they do not assert modern Chrome keeps a stalled worker alive forever.
