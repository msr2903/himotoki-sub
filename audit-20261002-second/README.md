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
