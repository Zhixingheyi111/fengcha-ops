# Feng Cha Ops

## Project overview

This repository is a static Feng Cha operations PWA deployed on Vercel.

- `index.html` contains the app UI, styles, and browser-side JavaScript.
- `sw.js` is the service worker. It uses a network-first strategy for app shell files.
- `manifest.json` contains PWA metadata and icon references.
- `vercel.json` configures clean URLs and no-cache headers for `index.html` and `sw.js`.
- `google-sheet-biweekly-sync.gs` is a Google Apps Script web app used by the bi-weekly inventory sync.

There is no package manager or build step in this repo.

## How to validate changes

Run these checks before finishing changes:

```bash
git status --short
python3 -m http.server 4181
curl -sS http://127.0.0.1:4181/
curl -sS http://127.0.0.1:4181/sw.js
```

If a local server is already running on port `4181`, use another free port and update the curl URLs.

For UI changes, open the local page in a browser and check both mobile-width and desktop-width layouts. This app is used heavily from phones, so preserve portrait/mobile ergonomics.

## Coding guidelines

- Keep the app dependency-free unless the user explicitly asks to add tooling.
- Prefer small, direct edits that match the existing plain HTML/CSS/JavaScript style.
- Preserve compatibility with older mobile browsers where practical.
- Do not introduce secrets. Supabase publishable keys may appear in client code, but service-role keys, private API keys, and webhook secrets must not.
- Keep `sw.js` network-first behavior for app shell files so deployed updates reach phones quickly.
- When changing cached assets or service worker behavior, bump the `CACHE` value in `sw.js`.
- Keep `vercel.json` no-cache headers for `index.html` and `sw.js`.
- Do not change Google Apps Script deployment instructions unless the sync behavior itself changes.

## Review guidelines

- Watch for changes that could break inventory submission, checklist completion, deep clean tracking, or store switching.
- Watch for regressions in phone PWA behavior, especially stale service-worker caching.
- Treat accidental exposure of private credentials or store/customer data as a high-priority issue.
- Treat destructive data writes to Supabase or Google Sheets as high-priority unless explicitly requested.
