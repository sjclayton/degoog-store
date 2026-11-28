# Mojeek

Mojeek web search. Solves the ALTCHA challenge automatically, supports safe-search, time filters and optional cookies.

## What it does

Loads the `www.mojeek.com` search page and parses the HTML. Mojeek protects searches with an ALTCHA proof-of-work; the engine solves the challenge, stores its `chllg` cookie, and retries the search.

Setting safe-search `off` sends `safe=0`, while `moderate` and `strict` send `safe=1`, Mojeek's own filter. Time filters map to Mojeek's `since` parameter; there is no hourly filter, so `hour` is treated as a day.

Mojeek throttles automated traffic with a `403` "automated queries" page, which the engine reports as a block.

## Install

Add this repository in degoog's store settings: `https://github.com/sjclayton/degoog-store.git`. Install the engine from the repo, then enable and configure it under Settings > Engines.

## Transport and timeout

This engine does not need a browser. It defaults to `curl-fallback`, which tries Bun's `fetch` first and retries with curl on 403, 429, 502 and 503. `fetch` and `curl` also let the engine solve the challenge automatically. Camoufox gets past the automated-query rate limit more often, but needs a `chllg` cookie set because it cannot submit the challenge POST. Leave the timeout empty to use the ten second default. Raise it to `20000` if you see timeouts. Plain `curl` also works if `curl-fallback` gives you trouble.

## Cookies

Cookies are optional for Mojeek. Paste the `chllg` cookie from a browser that has passed the Mojeek challenge; it lasts about 30 days and skips the challenge, which the Camoufox transport needs. The steps are the same in any modern browser (Chrome, Edge, Firefox, Safari, and others); only the menu labels differ slightly:

1. Open mojeek.com in your browser and run a search to pass the challenge.
2. Open the browser's developer tools (usually `F12`, or "Inspect" from the right-click menu).
3. Switch to the Network tab and reload the page.
4. Select the first document request for the site (the page itself, not an image or script).
5. In that request's headers, find the `Cookie` request header and copy its whole value.
6. Paste the value into the engine's Cookies field and save.

The header is stored in `plugin-settings.json` on the degoog host in plain text. Treat it like a password.

## Privacy

The engine sends the query text, your cookies (if set) and the ALTCHA solution to Mojeek.

## Troubleshooting

### Mojeek reports a block

Slow down, or use Camoufox with a `chllg` cookie (see Transport and timeout).

### The engine says it changed its results page

The site changed its markup or JSON shape. Ensure the extension is up-to-date.
