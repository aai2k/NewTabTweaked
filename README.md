# New Tab Tweaked

A clean Chrome new tab page that mirrors the default one — minus the doodle — with extra tweaks.

## Features

- **Default-style search bar** with live Google suggestions and keyboard navigation.
- **AI Mode** — the bar transforms in place with an animated rainbow border, takes your prompt, and hands it off to Google AI Mode.
- **Voice search** (Web Speech API) and **search by image** via an in-page Google Lens dialog (drop a file, choose one, or paste an image URL).
- **+ menu** to add open tabs as shortcuts.
- **Weather widget** (Open-Meteo) with automatic or manual city location.
- **Custom shortcuts** — add, remove, hide top sites, and drag to reorder (with smooth animations).
- **Custom background** — image URL or uploaded file, applied before first paint (no flash).

## Install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this folder.

## Permissions

- `topSites`, `tabs` — to show and add shortcuts.
- Host access to Open-Meteo, Nominatim, and Google (suggestions / image search).

## Notes

Chrome's native new-tab search box (omnibox autocomplete, the in-browser Lens
camera, AI Mode) is wired into the browser internals and can't be accessed by an
extension that overrides the new tab page. The features here are the closest
equivalents built on public Google endpoints and web APIs.
