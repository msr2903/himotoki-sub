# Code audit — 2026-09-27

Reviewed against `origin/master` at `efd4698` (including the Firebase account migration).
The original checkout had uncommitted UI/Netflix changes; they were left untouched.
This is a targeted source and regression audit, not a complete security review or a
claim that every streaming integration works.

## Implemented in this PR

| Finding | User impact | Change and evidence |
| --- | --- | --- |
| Every `useLookup` subscriber observes the entire dictionary result/pending maps, including disabled hooks. `useLineTranslation` has the same pattern. | Each lookup completion schedules unrelated token renders while watching a video. | Select only the current cache key with `useStoreMap`. Chromium probes record **0 additional renders** for both enabled and disabled word probes across 10 separately completed unrelated lookups, and 0 for a line probe when another line translates. |
| The ONNX upgrade sends duplicate text runs to both inference and dictionary repair. | Repeated captions and repeated phrases do unnecessary work in the serialized model queue. | Deduplicate exact text runs within a conversion, then map results back to each cue. The browser fixture has 100 cues / 300 text runs and now sends **2 unique inputs** to each stage. Timing, spaces, newlines and fallback text are preserved. |
| A mounted line requests translation only when its text changes. Pending requests survive settings changes; completion clears pending flags without checking which request owns them. Language/service equality also accepts obsolete A → B → A responses. | Changing language, provider or DeepL credentials can leave the visible line blank, show an obsolete answer, or allow duplicate requests. | Introduce a settings generation, clear caches/pending flags on change, refresh mounted lines, and accept completion only for the current generation. Six unit tests cover setting changes, old failures, A → B → A, deduplication and retry; a browser check covers the mounted hook. |

These are reductions in operation counts and renders, **not a measured end-to-end speedup**.
A transcript with entirely unique text gets no inference-count reduction. Deduplication
is per conversion, so dictionary installation/updates still trigger fresh repair on a
subsequent conversion; this does not introduce a persistent model/dictionary cache.
Already-started translation network requests are discarded when obsolete, not cancelled.

## Remaining findings, in priority order

### 1. High: token refresh can undo sign-out

Location: `src/utils/himotokiAccount.ts`, `refresh`, `activeSession`, `signOut`.

A refresh begun by `addFavorite` writes its session to storage after the network
response, even if `signOut` removed the session while the request was in flight.
An old refresh failure can similarly remove a more recently established session.

**Reproduced locally with injected fake fetch/storage:** start a save with an expired
token, defer the refresh response, sign out, then resolve the refresh. Storage goes
from absent after sign-out to present again; the old save continues. No real account
or server was used.

Recommended follow-up: associate auth operations with a session generation, reject
stale refresh success/failure, and bind the whole save transaction to one account.
`readSaved` and `writeSaved` currently acquire their sessions separately; account
changes during a save should cancel it rather than retarget its write. Test logout,
account switching, concurrent refresh and revoked-token responses with deferred fakes.
This auth change is separate from the subtitle-focused implementation in this PR.

### 2. High: dictionary replacement is not a recoverable commit

Location: `src/pages/offscreen/dict.worker.ts`, `install` (replacement and catch paths), `remove`.

The updater checks the downloaded bytes, then deletes the old database before
importing/opening its replacement. It validates the application's schema only in
`openDb` after replacement. A valid SQLite file with the wrong schema, or an interrupted
copy leaving a partial `DB_FILE`, can lose the previous usable dictionary. Recovery
only promotes the temporary file if `DB_FILE` is absent; it can delete the temporary
copy when a partial destination exists. `remove` is also not serialized with install.

This finding is from source review; interruption/quota failures were not injected
into a real OPFS installation in this audit.

Recommended follow-up: validate the staged schema first; retain an independently
recoverable previous version through commit; recover staged/partial installs on boot;
serialize removal with installation. Add failure-injection tests at each swap boundary.
The current `exportFile` also materializes the entire unpacked database during updates,
so a versioned-file design should be evaluated for peak memory as well as recovery.

### 3. Medium: caption fetches can restore an obsolete track

Location: `src/models/subs/init.ts`, `$rawSubs.on(fetchSubsFx.doneData)` and
`$secondaryRawSubs.on(fetchSecondarySubsFx.doneData)`.

The later segmentation and coverage effects check input identity, but the fetch
results that establish those inputs have no navigation/track generation guard.
A slow previous fetch can replace newer captions or restore captions after reset;
a late secondary fetch can repopulate the store after the user turns track mode off.
This is a source-level finding, not a reproduced live-site failure in this audit.

Recommended follow-up: add generations at the fetch boundary, invalidated by video,
track, mode and language changes and reset. Use out-of-order deferred fetches to test
both tracks, then check SPA navigation on YouTube and Netflix.

### 4. Medium: long-session and long-transcript work remains unbounded

Locations: `src/models/translations/index.ts`, `src/models/subs/index.ts`,
`src/utils/getCurrentSubs.ts`, `src/pages/content/components/Subs/Transcript.tsx`.

Word and line caches grow across SPA video navigation, and each entry insertion copies
the result object. Incremental captions rerun processing and coverage over accumulated
cues; obsolete jobs continue consuming the shared worker even when their results are
ignored. Playback filters the whole cue array on each update, serializes current cues
for equality, and the open transcript renders every row.

Recommended follow-up: profile a multi-hour playlist and a 10,000-cue fixture; bound
caches, cancel obsolete work between batches, process only new cues, and virtualize
the transcript. An interval-aware cue index must preserve overlapping subtitles and
backward seeks; a naive single-cue binary search would change behavior.

### 5. Medium/low: production dependency advisories

`pnpm audit --prod --json` reports 2 moderate and 1 low advisory, with no high or
critical findings. This is a dependency inventory result, not proof that vulnerable
code is reachable from this extension:

- `@babel/runtime` 7.24.8: [RegExp complexity advisory](https://github.com/advisories/GHSA-968p-4wvh-cqc8); patched in 7.26.10.
- `yaml` 1.10.2 (under react-select/Emotion tooling): [nested collection stack overflow](https://github.com/advisories/GHSA-48c2-rrv3-qjmp); patched in 1.10.3.
- `min-document` 2.19.0 (under m3u8-parser): [prototype pollution advisory](https://github.com/advisories/GHSA-rx8g-88g5-qh64); patched in 2.19.1.

Refresh these transitive dependencies in a focused lockfile PR and rerun the build,
unit and browser checks. Inspect the emitted bundles to establish runtime reachability.

## Product improvements

1. **A clear readiness panel.** Show caption-track availability, local splitter state,
   dictionary readiness and account state separately, with one relevant recovery action
   for each. This makes an empty overlay diagnosable without opening DevTools.
2. **A capability matrix in the app.** Match the README's distinction between active
   integrations and experimental/disabled ones. `getCurrentService` currently disables
   Plex, Udemy, Kinopoisk and Amazon; Firefox also lacks the offscreen host used by the
   model and dictionary. Explain supported features before users attempt setup.
3. **An i+1 transcript filter.** Reuse existing coverage and known-word data to show lines
   containing exactly one unknown word, with replay, loop and save beside each result.
4. **A short review session after watching.** Turn lookup history into a selectable list
   of words and original video timestamps; let the learner preview and save a small
   batch to Himotoki or Anki with per-item retry.
5. **Discoverable controls.** Offer a compact shortcut/mouse-control guide from the
   player and show which actions are active. Existing replay, loop and listening tools
   are useful but difficult to discover from the subtitle overlay alone.

## Validation

- `pnpm exec tsc --noEmit`: passed.
- `pnpm lint`: 0 errors, 27 existing warnings; changed TypeScript files lint cleanly.
- `pnpm test:unit`: 212 tests passed across 21 files.
- `pnpm build`: Chrome production build passed.
- `pnpm test`: full deterministic Chromium suite passed, including the new performance
  and translation checks; 0 browser runtime errors.
- `pnpm test:e2e`: completed with exit 0 and 0 page errors; real ONNX messaging,
  captions, popup, secondary lines and settings were exercised. This run had no offline
  dictionary. The script logs several diagnostics without asserting them (including
  segmentation comparison and replay); its successful exit is not full feature coverage.
- `pnpm audit --prod --json`: completed with exit 1 for the 3 advisories listed above.
- Dictionary install/update fault injection and authenticated account flows were not
  run against production services. No account credentials or saved words were changed.
