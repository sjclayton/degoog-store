# sjclayton's degoog extensions

Four Yandex engines, a Reddit engine, a Reddit Communities slot plugin and a Mojeek engine for degoog.

The Yandex engines exist because Yandex answers searches that other engines refuse.
Google, Bing, DuckDuckGo and Brave drop many NSFW or niche queries and return an empty page.
Yandex returns images, videos or pages for the same words. Treat these engines as a second opinion,
not a replacement for your main engines.

## What's in the repo

| Extension                                                     | Kind   | Version | Search type | What it does                                                   |
| ------------------------------------------------------------- | ------ | ------- | ----------- | -------------------------------------------------------------- |
| [Mojeek](engines/mojeek/README.md)                            | Engine | 1.0.2   | web         | Mojeek web search with automatic ALTCHA solving.               |
| [Reddit](engines/reddit/README.md)                            | Engine | 1.2.9   | web         | Reddit post and community search through old.reddit.com.       |
| [Yandex](engines/yandex/README.md)                            | Engine | 1.5.5   | web         | Web search on yandex.com, including `site:` queries.           |
| [Yandex Images](engines/yandex-images/README.md)              | Engine | 1.2.5   | images      | Image search with size, type and layout filters.               |
| [Yandex Videos](engines/yandex-videos/README.md)              | Engine | 1.2.5   | videos      | Video search through Yandex's JSON endpoint.                   |
| [Yandex Visual Search](engines/yandex-visual/README.md)       | Engine | 1.2.6   | images      | Reverse image search for matching pages and images.            |
| [Reddit Communities](plugins/reddit-community-slot/README.md) | Plugin | 1.2.4   | —           | Community cards above results, sorted by members or relevance. |

Each extension has its own README with its settings, transport, cookies, privacy notes and troubleshooting.

## Install

1. Add this repository in degoog's store settings:
   `https://github.com/sjclayton/degoog-store.git`
2. Open the repo in the store and install the engines and plugins you want.
3. Enable / configure the engines under Settings > Engines, and enable / configure the plugin under Settings > Plugins if you installed it.

## Transports

The short version: web engines on Camoufox with a 45 second timeout and cookies
(required for Reddit, recommended for Yandex); the media engines and Mojeek on
curl-fallback with cookies.

### Camoufox for web search

Yandex and Reddit guard their web results hardest. A real Firefox session gets
through more often than curl, so both web engines do best behind
[Camoufox](https://github.com/degoog-org/official-extensions/tree/main/transports/camoufox),
the official transport that drives a stealth Firefox build.

Install the Camoufox transport from the official extensions repo, run its
service, and point the transport at it.

Settings for the Yandex and Reddit web engines:

| Setting            | Value                                                         |
| ------------------ | ------------------------------------------------------------- |
| Outgoing transport | Camoufox                                                      |
| Timeout            | `45000` ms                                                    |
| Cookies            | `Cookie` header from yandex.com or a signed-in Reddit session |

The timeout matters. On a normal query the Yandex web engine tries the modern
page twice, waiting 1.5 seconds between captcha retries. A query with `site:`
gets one more attempt through the `site` parameter, and a final attempt against
the legacy page. Reddit needs the same headroom because each page load fetches
the earlier pages first. The stock ten second timeout cuts both off.

Settings for the Camoufox transport:

| Setting                            | Value                          | Why                                                                     |
| ---------------------------------- | ------------------------------ | ----------------------------------------------------------------------- |
| Camoufox URL                       | `http://<camoufox-host>:53323` | Where your service listens.                                             |
| Warm up before request             | on                             | Visits the target site before the real page. Cold sessions get flagged. |
| Warmup dwell                       | `2500` ms                      | Short enough to stay quick, long enough for the session to register.    |
| Timeout                            | `30000` ms                     | Time for the page itself, separate from the engine timeout.             |
| Wait until                         | `load`                         | The result page is usable before the network goes idle.                 |
| Bypass proxy for Camoufox endpoint | on                             | Talk to the service directly, not through degoog's proxy.               |

If the Camoufox service runs on the same machine as degoog, use
`http://127.0.0.1:53323` instead.

### curl-fallback for the Yandex media engines and Mojeek

Yandex Images, Videos and Visual Search and the Mojeek engine do not need a browser.
They default to `curl-fallback`, which tries Bun's `fetch` first and retries with curl on 403,
429, 502 and 503. Leave it alone unless you have a reason to change it. Leave
the timeout empty to use the ten second default. Raise it to `20000` if you see
timeouts. Plain `curl` also works if `curl-fallback` gives you trouble.

### Cookies

Cookies are optional for Yandex and Mojeek, and required for Reddit. Yandex raises the
captcha rate for anonymous sessions, and a real browser session lowers it.
Reddit no longer serves `old.reddit.com` to logged-out visitors, so the Reddit
engine needs cookies from a signed-in browser. For Mojeek, the engine solves the
challenge and stores `chllg` itself; paste that cookie only if using the Camoufox
transport, as it cannot submit the challenge.

The steps are the same in any modern browser (Chrome, Edge, Firefox, Safari,
and others); only the menu labels differ slightly:

1. Open yandex.com, mojeek.com or reddit.com in your browser, and sign in only
   for Reddit.
2. Open the browser's developer tools (usually `F12`, or "Inspect" from the
   right-click menu).
3. Switch to the Network tab and reload the page.
4. Select the first document request for the site (the page itself, not an
   image or script).
5. In that request's headers, find the `Cookie` request header and copy its
   whole value.
6. Paste the value into the engine's Cookies field and save.

For Reddit, any signed-in cookie works. `reddit_session` is the cookie that
carries the login; `token_v2` and the rest are optional but fine to include. Some
browsers group request headers under a "Request Headers" heading.

The header is stored in `plugin-settings.json` on the degoog host in plain
text, and Camoufox passes it to the browser context. Treat it like a password.

## Safe search

Safe-search is a per-engine choice. `off` removes filtering for Yandex, sends
the adult flag to the Yandex media engines, includes NSFW on Reddit and sends
`safe=0` to Mojeek. `moderate` keeps each provider's defaults, and `strict` turns
on family mode or the provider's own filter. For images, videos and visual
search, the safe-search setting a visitor picks in degoog wins over the engine
default. See each extension's README for the exact behaviour.

## Privacy

Extensions send the query text and your cookies (if set) to their search
provider. Visual Search uploads every image to Yandex, a third party, along with
any words typed next to it. Yandex sees the degoog server IP address, not the
visitor's, and keeps the image under its own terms. Do not enable it if that
trade is not acceptable.

The Reddit engine sends the query text and your Reddit cookies to Reddit, the
slot plugin sends `about.json` requests with its own cookie when it needs counts
for community links without them, and Mojeek also receives the ALTCHA solution.
Each extension's README has full notes.

## Troubleshooting

### A captcha or a block

The site blocked the IP or the session, not the engine. Add cookies, wait a
little, switch the engine to Camoufox where supported, or lower the crawl rate.
See the extension's README for the exact message and fix.

### Engine timeout

Raise the engine timeout. The web engines running behind Camoufox need 45000 ms.
The others usually fit within ten seconds, or 20000 ms for slow responses.

### The engine says it changed its results page

The site changed its markup or JSON shape. Ensure the extension is up-to-date.

For provider-specific problems, such as a Reddit login page or a `site:` query
returning off-site hits, see that extension's README.

## License

MIT. See [LICENSE](LICENSE).
