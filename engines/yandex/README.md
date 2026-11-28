# Yandex

Yandex web search on yandex.com. This engine exists because Yandex answers searches that other engines refuse. Google, Bing, DuckDuckGo and Brave drop many NSFW or niche queries and return an empty page. Yandex returns pages for the same words. Treat this engine as a second opinion, not a replacement for your main engines.

## What it does

Loads the Yandex results page and parses it. The engine applies no query-level keyword blocks. When the modern page returns nothing, the engine falls back to Yandex's legacy results page. It understands a single `site:` token and retries through Yandex's own `site` parameter when the plain query comes back empty, so `site:example.com keyword` searches example.com for `keyword`. Multiple `site:` tokens are passed to Yandex as typed and usually return nothing.

## Install

Add this repository in degoog's store settings: `https://github.com/sjclayton/degoog-store.git`. Install the engine from the repo, then enable and configure it under Settings > Engines.

## Transport and timeout

Use Camoufox with this engine. A real Firefox session gets through more often than a plain HTTP client.

| Setting            | Value                           | Why                                          |
| ------------------ | ------------------------------- | -------------------------------------------- |
| Outgoing transport | Camoufox                        | Yandex guards its web results hardest.       |
| Timeout            | `45000` ms                      | Leaves room for the browser and the retries. |
| Cookies            | `Cookie` header from yandex.com | See Cookies below.                           |

Settings for the Camoufox transport itself:

| Setting                            | Value                          | Why                                                                     |
| ---------------------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| Camoufox URL                       | `http://<camoufox-host>:53323` | Where your service listens.                                             |
| Warm up before request             | on                             | Visits the target site before the real page. Cold sessions get flagged. |
| Warmup dwell                       | `2500` ms                      | Short enough to stay quick, long enough for the session to register.    |
| Timeout                            | `30000` ms                     | Time for the page itself, separate from the engine timeout.             |
| Wait until                         | `load`                         | The result page is usable before the network goes idle.                 |
| Bypass proxy for Camoufox endpoint | on                             | Talk to the service directly, not through degoog's proxy.               |

If the Camoufox service runs on the same machine as degoog, use `http://127.0.0.1:53323` instead.

The timeout matters. A normal query can try the modern page twice with a 1.5 second pause between captcha retries, and a `site:` query makes further attempts. That can run past ten seconds even when everything works; the stock ten second timeout cuts it off, so `45000` leaves room.

## Safe search

Safe-search is a per-engine choice. `off` sends Yandex the `adult` flag, so unfiltered results come back unblurred. `moderate` keeps Yandex's default blur on NSFW results. `strict` turns on family mode.

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

Yandex blocked the IP or the session, not the engine. Add cookies, wait a little, or switch the engine to Camoufox (if not already set). Lowering the crawl rate also helps.

### Engine timeout

Raise the engine timeout to `45000` ms.

### The engine says it changed its results page

The site changed its markup or JSON shape. Ensure the extension is up-to-date.

### A `site:` query returns off-site hits

Yandex occasionally ignores the operator, and degoog's built-in indexer can replay those rows on later searches for the same query. Clear the indexer and turn off the Degoog engine (if enabled), then run the search again. A less thin query helps too.
