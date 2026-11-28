# Yandex Images

Yandex image search with size, type and layout filters. Yandex answers searches that other engines refuse: Google, Bing, DuckDuckGo and Brave drop many NSFW or niche queries, while Yandex returns images for the same words. Treat this engine as a second opinion, not a replacement for your main engines.

## What it does

Loads Yandex image search and parses the results. The engine applies no query-level keyword blocks. When the modern results page returns nothing, the engine falls back to Yandex's legacy page.

## Install

Add this repository in degoog's store settings: `https://github.com/sjclayton/degoog-store.git`. Install the engine from the repo, then enable and configure it under Settings > Engines.

## Transport and timeout

This engine does not need a browser. It defaults to `curl-fallback`, which tries Bun's `fetch` first and retries with curl on 403, 429, 502 and 503. Leave it alone unless you have a reason to change it. Leave the timeout empty to use the ten second default. Raise it to `20000` if you see timeouts. Plain `curl` also works if `curl-fallback` gives you trouble.

## Safe search

`off` sends Yandex the adult flag and serves unblurred thumbnails. `moderate` keeps Yandex's defaults. `strict` uses Yandex family mode. For images, the safe-search setting a visitor picks in degoog wins over the engine default: if a visitor asks for `off`, the engine sends the adult flag even when its own setting says `moderate`.

## Cookies

Cookies are optional for Yandex, and a real browser session lowers the captcha rate. You do not need to sign in. The steps are the same in any modern browser (Chrome, Edge, Firefox, Safari, and others); only the menu labels differ slightly:

1. Open yandex.com in your browser.
2. Open the browser's developer tools (usually `F12`, or "Inspect" from the right-click menu).
3. Switch to the Network tab and reload the page.
4. Select the first document request for the site (the page itself, not an image or script).
5. In that request's headers, find the `Cookie` request header and copy its whole value.
6. Paste the value into the engine's Cookies field and save.

The header is stored in `plugin-settings.json` on the degoog host in plain text. Treat it like a password.

## Privacy

The engine sends only the query text and your cookies (if set) to Yandex.

## Troubleshooting

### Yandex asked for a captcha

Yandex blocked the IP or the session, not the engine. Add cookies, wait a little, or switch the engine transport to Camoufox (if not already set). Lowering the crawl rate also helps.

### The engine says it changed its results page

The site changed its markup or JSON shape. Ensure the extension is up-to-date.
