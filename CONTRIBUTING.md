# Contributing to Himotoki Sub

Thanks for helping. Himotoki Sub is a Japanese-learning extension: it splits Japanese subtitles into words
with a local model and shows an offline dictionary pop-up. Features that only make sense for other
languages are out of scope; removing leftover multi-language EasySubs code is welcome.

## Setup

1. Node 22.13+ and pnpm 11 (`corepack enable` picks up the pinned version).
2. `pnpm install`
3. `pnpm build` (or `pnpm dev` for a watch build), then load `dist/` in `chrome://extensions` → Load unpacked.
4. Install the offline dictionary from the toolbar popup. Lookups run locally once it is installed.

Architecture notes live in [CLAUDE.md](./CLAUDE.md): the subtitle pipeline, the Effector models, how
settings are persisted, and where each feature lives.

## Before opening a pull request

```bash
pnpm exec tsc --noEmit   # types
pnpm lint                # must report 0 errors
pnpm test:unit           # Vitest, pure logic
pnpm build && pnpm test  # Chromium regression checks against the built extension
```

CI runs all four. For changes to the YouTube flow or the dictionary, also run the end-to-end scripts
described under "Testing" in the README (they need `npx playwright install chromium`).

## Conventions

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:` …).
- **Settings:** every persisted store needs an explicit `name` (it is the `chrome.storage` key); the
  options page reads the same keys through `src/shared/persistedSettings.ts`.
- **Hover path:** keep lookups local; no network calls while the user hovers.
- **UI changes:** include a screenshot (before/after when it helps) in the pull request.
- **Data and assets:** anything you bundle or fold into the dictionary needs a compatible licence and an
  entry in [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

## Reporting bugs

Use the bug report template. The site, the video URL, the browser and extension version, and whether the
offline dictionary is installed usually decide whether a bug can be reproduced.
