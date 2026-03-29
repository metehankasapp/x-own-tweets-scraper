# X Own Tweets Scraper

Simple Chrome extension for collecting your own X posts into local browser storage and exporting them as CSV.

## What it does

- Runs only on `x.com`
- Watches loaded tweet cards while you browse
- Stores captured data in `chrome.storage.local`
- Filters export by the currently detected account handle
- Exports a CSV file directly from the popup

## What it does not do

- No remote sync
- No Google auth
- No cookies
- No external API calls

## Install

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this project folder

## Usage

1. Open your own profile on X
2. Scroll to load more posts
3. Open the extension popup
4. Click `Export My Tweets`

If the popup says `Refresh the tab`, reload the current X page once.

## Exported fields

- `tweetId`
- `handle`
- `content`
- `tweetCreatedAt`
- `likes`
- `retweets`
- `replies`
- `views`
- `bookmarks`
- `mediaType`
- `imageMediaUrls`
- `videoMediaUrls`
- `scrapedFromUrl`
- `profileUrl`
- `language`
- `tweetType`
- `conversationId`
- `inReplyToTweetId`
- `inReplyToUserHandle`
- `retweetOriginalAuthor`
- `isAd`
- `hasShowMore`
- `quotedTweet`

## Project structure

- [`manifest.json`](./manifest.json)
- [`popup.html`](./popup.html)
- [`assets/content.ts-BRNxQfj7.js`](./assets/content.ts-BRNxQfj7.js)
- [`assets/background.ts-U05pi8S_.js`](./assets/background.ts-U05pi8S_.js)
- [`assets/popup.html-BXzlj2Tp.js`](./assets/popup.html-BXzlj2Tp.js)

## Privacy

Everything stays local in the browser unless you change the code yourself.
