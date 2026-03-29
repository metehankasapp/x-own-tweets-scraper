# Own Tweets CSV

Own Tweets CSV is a minimal Chrome extension for collecting your own X posts into local browser storage and exporting them as a CSV file.

## Features

- Runs only on `x.com`
- Stores everything in `chrome.storage.local`
- Filters captured tweets by the detected signed-in account
- Exports a CSV directly from the popup
- Makes no external network requests

## Install

1. Open `chrome://extensions`
2. Turn on `Developer mode`
3. Click `Load unpacked`
4. Select this folder

## Usage

1. Open your X profile
2. Scroll to load more tweets
3. Open the extension popup
4. Click `Export My Tweets`

## Project files

- `manifest.json`
- `background.js`
- `content.js`
- `popup.html`
- `popup.css`
- `popup.js`

## Privacy

This project is local-only by default. It does not ship with remote sync, analytics, auth flows, or cookie-based login logic.
