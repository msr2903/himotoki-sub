# Himotoki Sub — source and licence

SPDX-License-Identifier: AGPL-3.0-or-later

Source repository: https://github.com/msr2903/himotoki-sub

Build instructions are in README.md and CONTRIBUTING.md in that repository. Use Node 22.13+ and pnpm
11, install the lockfile dependencies, and run `pnpm build` (Chromium) or `pnpm build:firefox` (Firefox).

When distributing an extension build, make the complete corresponding source for that exact build
available with it or through an equivalent source download, including build scripts and local patches,
as required by AGPL section 6. Publish/tag the matching source commit alongside release artifacts.
A repository URL alone does not replace those obligations if the matching source is unavailable.
If a modified version is offered for remote interaction, follow the source-offer requirements of
AGPL section 13 as applicable.

The full project licence is in LICENSE. Third-party notices are in THIRD_PARTY_NOTICES.md, with the
inherited MIT notice in LICENSES/MIT-upstream.txt. Dictionary data, models, fonts and independently
licensed dependencies retain their own terms. No user data or private credentials are part of the
corresponding program source. Earlier MIT releases retain their original permissions.
