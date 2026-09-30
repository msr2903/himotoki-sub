# Deep audit evidence — 30 September 2026

Repository: msr2903/himotoki-sub. Baseline: `0b58e73`. Tests assert the observed defects; passing them confirms the current bad behavior rather than fixing it. No product source is changed.

Copy account/captions/firefox.test.ts into src/utils/ as audit-*.test.ts, and config/stub into .audit/. Run pnpm exec vitest run src/utils/audit-account.test.ts src/utils/audit-captions.test.ts, then pnpm exec vitest run --config .audit/vitest.config.ts src/utils/audit-firefox.test.ts.

Account tests exercise the actual client against controlled deferred HTTP/session stores, without real credentials or live cloud writes. UI controller tests use DOM/browser API stubs and the actual controller. Native/browser availability tests model missing APIs and do not claim a physical-device end-to-end result.
