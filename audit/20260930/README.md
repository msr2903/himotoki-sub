# Deep audit evidence — 30 September 2026

Repository: msr2903/himotoki-sub. Baseline: `0b58e73`. Tests assert the observed defects; passing them confirms the current bad behavior rather than fixing it. No product source is changed.

Copy account/captions/firefox.test.ts into src/utils/ as audit-*.test.ts, and config/stub into .audit/. Run pnpm exec vitest run src/utils/audit-account.test.ts src/utils/audit-captions.test.ts, then pnpm exec vitest run --config .audit/vitest.config.ts src/utils/audit-firefox.test.ts.

Account tests exercise the actual client against controlled deferred HTTP/session stores, without real credentials or live cloud writes. UI controller tests use DOM/browser API stubs and the actual controller. Native/browser availability tests model missing APIs and do not claim a physical-device end-to-end result.

Dictionary replacement: copy dictionary-update.test.ts into src/utils/audit-dictionary-update.test.ts and run pnpm exec vitest run src/utils/audit-dictionary-update.test.ts under Node 26.9.0. This runs the actual worker with a memory-backed OPFS adapter and real SQLite files/queries; the downloaded incompatible SQLite file passes its real SHA-256 check. It is not a real browser OPFS crash test.

Additional reproductions: copy slow-replay.test.ts and settings-hydration.test.ts into src/utils/ as audit-*.test.ts. For hook tests install the isolated test renderer with `npm install --prefix .audit/deps --ignore-scripts --no-audit --no-fund react-test-renderer@18.2.0`, copy vitest-hooks.config.ts into .audit/, and run `pnpm exec vitest run --config .audit/vitest-hooks.config.ts src/utils/audit-settings-hydration.test.ts`. The React/renderer alias intentionally resolves both to one React instance. Run slow replay with the normal Vitest config.

Long-running tab tests: copy multitab-status.test.ts and dictionary-cache.test.ts into src/utils/ as audit-*.test.ts and run the normal Vitest config. The multi-tab test loads two actual settings/store graphs with the real persistence wrapper, deferring storage-change notifications. The cache test uses the actual Effector lookup graph with controlled dictionary replies.

Disabled-input/remove-install tests: copy each to src/utils/audit-*.test.ts and run normal Vitest. The first uses the actual input handlers/settings with DOM/player stubs; the second uses the actual worker with controlled HTTP/OPFS and real SQLite under Node 26.9.

Prototype cache key test: copy cache-prototype.test.ts into src/utils/audit-cache-prototype.test.ts and run normal Vitest. The actual cache/event graph is used; dictionary/translation effects are controlled and never invoked for the failing keys.

## Caption-observer and capture ownership

Copy `amazon-observer.test.ts` and `media-ownership.test.ts` into `src/utils/` with an `audit-` prefix, then run `pnpm exec vitest run src/utils/audit-amazon-observer.test.ts src/utils/audit-media-ownership.test.ts`. These tests use real adapter/capture implementations with controlled store/DOM/recorder doubles and fake clocks; they do not validate a signed-in streaming site or real recorded audio. Assertions describe defects, not fixes.

## Online headwords and known-word export

Copy both `*-headwords.test.ts` files to `src/utils/` as `audit-*.test.ts`, and `kana-api-fixtures.json` to `.audit/`. Run `pnpm exec vitest run src/utils/audit-online-headwords.test.ts src/utils/audit-export-headwords.test.ts`. The six API fixtures were generated read-only from the full app API at a9de05ff using English senses; the online mapping test makes no live network requests. Export uses actual mapper/key/serializer functions and synthetic cat data.

Dictionary-panel teardown: copy dictionary-panel.test.ts into src/utils/audit-dictionary-panel.test.ts and vitest-panels.config.ts into .audit/. Use the same isolated renderer dependency as above, then run `pnpm exec vitest run --config .audit/vitest-panels.config.ts src/utils/audit-dictionary-panel.test.ts`. Actual React component with controlled Chrome messaging/fake timers; no browser timing claim.
