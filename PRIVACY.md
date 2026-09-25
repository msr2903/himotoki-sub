# Privacy policy — Himotoki Sub

_Last updated: 2026-09-14_

Himotoki Sub is a browser extension that overlays Japanese subtitles on video sites, splits them into words and shows dictionary entries. It is designed so that the core features work without sending anything off your device.

## What stays on your device

- **Subtitle text, word splitting and dictionary lookups.** Word segmentation runs in a local model inside the extension. Dictionary lookups use a Jitendex database that you download once and that is then stored in your browser's private storage. Neither the subtitles you watch nor the words you look up are sent anywhere for these features.
- **Settings** (hover/click behaviour, sizes, service choices) are stored in your browser's extension storage.
- **Known-word or favorite data** is only stored remotely if you sign in (see below).

## What leaves your device, and when

| Feature | Data sent | Where | When |
|---|---|---|---|
| Dictionary download | A plain HTTP request for the dictionary file (no personal data) | GitHub release assets on `github.com` / `githubusercontent.com` (or the URL you configure) | Only when you click "Download dictionary" or "Update dictionary" |
| Whole-line translation | The subtitle line you clicked | Google Translate, or DeepL's official API with your own API key if you selected DeepL | Only when you click a subtitle line |
| Save to Himotoki | The word, its reading and gloss, the sentence it appeared in, the video URL, video title and timestamp | Himotoki's backend (Convex) | Only when you are signed in and press Save |
| Sign in with Google | Google's standard OAuth sign-in; the extension receives an ID token and exchanges it for a Himotoki session | Google, then Himotoki's backend | Only when you press "Sign in with Google" |
| Save to Anki | The word and gloss | Your own AnkiConnect at `http://localhost:8765` | Only when Anki is selected and you press Save |

The extension has no analytics, no advertising, and no telemetry. It does not read pages other than the supported video sites listed in its manifest.

## Permissions explained

- **storage / unlimitedStorage**: settings and the offline dictionary (about 185 MB).
- **offscreen**: runs the segmentation model and the dictionary database in a background document.
- **identity**: only used for the optional Google sign-in.
- **scripting / activeTab / host permissions for video sites**: injecting the subtitle overlay into supported players.
- **host permissions for translation and Himotoki domains**: the requests listed in the table above.

## Data retention and deletion

Everything stored locally can be removed by uninstalling the extension or by using "Remove dictionary" in the settings page. Signing out clears the Himotoki session token. Data saved to your Himotoki account can be managed and deleted on himotoki.my.id.

## Third-party data

Dictionary content is Jitendex (© Stephen Kraus, CC BY-SA 4.0), built from JMdict (Electronic Dictionary Research and Development Group) and Tatoeba example sentences (CC BY 2.0 FR).

## Contact

Open an issue on the project repository or contact the maintainer through himotoki.my.id.
