# Deep audit evidence — 30 September 2026

Repository: msr2903/himotoki-sub. Baseline: `0b58e73`. Tests assert the observed defects; passing them confirms the current bad behavior rather than fixing it. No product source is changed.

Copy account/captions/firefox.test.ts into src/utils/ as audit-*.test.ts, and config/stub into .audit/. Run pnpm exec vitest run src/utils/audit-account.test.ts src/utils/audit-captions.test.ts, then pnpm exec vitest run --config .audit/vitest.config.ts src/utils/audit-firefox.test.ts.

Account tests exercise the actual client against controlled deferred HTTP/session stores, without real credentials or live cloud writes. UI controller tests use DOM/browser API stubs and the actual controller. Native/browser availability tests model missing APIs and do not claim a physical-device end-to-end result.

Dictionary replacement: copy dictionary-update.test.ts into src/utils/audit-dictionary-update.test.ts and run pnpm exec vitest run src/utils/audit-dictionary-update.test.ts under Node 26.9.0. This runs the actual worker with a memory-backed OPFS adapter and real SQLite files/queries; the downloaded incompatible SQLite file passes its real SHA-256 check. It is not a real browser OPFS crash test.

Additional reproductions: copy slow-replay.test.ts and settings-hydration.test.ts into src/utils/ as audit-*.test.ts. For hook tests install the isolated test renderer with `npm install --prefix .audit/deps --ignore-scripts --no-audit --no-fund react-test-renderer@18.2.0`, copy vitest-hooks.config.ts into .audit/, and run `pnpm exec vitest run --config .audit/vitest-hooks.config.ts src/utils/audit-settings-hydration.test.ts`. The React/renderer alias intentionally resolves both to one React instance. Run slow replay with the normal Vitest config.

Long-running tab tests: copy multitab-status.test.ts and dictionary-cache.test.ts into src/utils/ as audit-*.test.ts and run the normal Vitest config. The multi-tab test loads two actual settings/store graphs with the real persistence wrapper, deferring storage-change notifications. The cache test uses the actual Effector lookup graph with controlled dictionary replies.

Disabled-input/remove-install tests: copy each to src/utils/audit-*.test.ts and run normal Vitest. The first uses the actual input handlers/settings with DOM/player stubs; the second uses the actual worker with controlled HTTP/OPFS and real SQLite under Node 26.9.
