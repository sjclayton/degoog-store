# sjclayton's degoog extensions

Four Yandex engines, a Reddit engine, a Reddit Communities slot plugin and a Mojeek engine for degoog.

The Yandex engines exist because Yandex answers searches that other engines refuse.
Google, Bing, DuckDuckGo and Brave drop many NSFW or niche queries and return an empty page.
Yandex returns images, videos or pages for the same words. Treat these engines as a second opinion,
not a replacement for your main engines.

## What's in the repo

| Extension            | Kind   | Version | Search type | What it does                                                                                                                                           |
| -------------------- | ------ | ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mojeek               | Engine | 1.0.1   | web         | Mojeek web search. Solves Mojeek's ALTCHA challenge automatically and supports safe-search, time filters and optional cookies.                         |
| Reddit               | Engine | 1.2.6   | web         | Reddit post and community search through the old.reddit.com HTML results page. Requires a signed-in Reddit cookie.                                     |
| Yandex               | Engine | 1.5.4   | web         | Web search on yandex.com. Understands the `site:` token and retries through Yandex's own `site` parameter when the plain query comes back empty.       |
| Yandex Images        | Engine | 1.2.4   | images      | Image search with size, type and layout filters.                                                                                                       |
| Yandex Videos        | Engine | 1.2.4   | videos      | Video search. Reads Yandex's JSON endpoint instead of parsing HTML.                                                                                    |
| Yandex Visual Search | Engine | 1.2.5   | images      | Reverse image search. Upload an image, or use the image tab, to find pages that contain it and images that look like it.                               |
| Reddit Communities   | Plugin | 1.2.1   | —           | Shows the top Reddit communities by member count, age and description above results. Works with the Reddit engine, or standalone with a Reddit cookie. |

The Yandex web engine falls back to Yandex's legacy results page when the modern page
returns nothing, Images and Videos do the same.

## Mojeek

Loads the `www.mojeek.com` search page and parses the HTML. Mojeek protects searches with an ALTCHA proof-of-work; the engine solves the challenge, keeps the `chllg` cookie for about 30 days, and retries the search.

Setting safe-search `off` sends `safe=0`, while `moderate` and `strict` send `safe=1`, Mojeek's own filter.

Time filters map to Mojeek's `since` parameter; there is no hourly filter, so `hour` is treated as a day.

Mojeek throttles automated traffic with a `403` "automated queries" page, which the engine reports as a block. Slow down or use Camoufox with a `chllg` cookie.

## Reddit

Loads the server-rendered `old.reddit.com` search page and parses the HTML. Results include posts and communities: posts open their discussion thread on `www.reddit.com` (link posts show the external domain in the snippet), and communities show their member count, age and description.

Community member counts come from Reddit's `about.json` endpoint and are cached briefly. Turn off `Community member counts` in the engine settings to skip the extra lookups.

Include `r/name` to search inside one community, for example `r/selfhosted degoog`. A `site:reddit.com` token is dropped because every result is already from Reddit.

Reddit only has on/off safe-search: `off` includes NSFW posts, while `moderate` and `strict` hide them. The engine pages forward only, so page 3 loads pages 1 and 2 first, and pages stop being returned at 5.

### Reddit Communities plugin

A slot plugin that shows the top communities from Reddit results, sorted by member count. Each card shows the community icon (or a generic Snoo icon), `r/name`, member count, age and description. `Top communities count` sets the limit between 1 and 10.

When the Reddit engine is installed, the plugin uses the counts that engine attaches to its community results. It can also work on its own: paste a signed-in Reddit cookie into the plugin's `Reddit cookies` setting and it reads the count, age, icon and description from `about.json` for any `reddit.com/r/<name>` link in the results, including links returned by other engines. Without a cookie, only results that already carry a count can produce cards.

`Source` chooses where candidates come from. `Results` (the default) uses community links in the results. `Direct` ignores the results and passes the whole query to Reddit's community search, which matches community names and descriptions. The lookup includes NSFW communities so relevant matches are not hidden by Reddit; the plugin then applies the safe-search rules below. `Direct` needs a Reddit cookie to be set. The number of lookups is capped by `Top communities count`.

Communities Reddit marks NSFW are hidden when safe search is `moderate` or `strict`, and shown when it is `off`. Web searches in degoog use the engine's setting, so when the Reddit engine is installed its saved `Safe Search` setting controls this. The plugin's own `Safe search` setting applies only when the Reddit engine is not installed.

## Install

1. Add this repository in degoog's store settings:
   `https://github.com/sjclayton/degoog-store.git`
2. Open the repo in the store and install the engines and plugins you want.
3. Enable / configure the engines under Settings > Engines, and enable / configure the plugin under Settings > Plugins if you installed it.

## Transports

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
| Cookies            | `Cookie` header from yandex.com or a signed-in old.reddit.com |

The timeout matters for Yandex. On a normal query the engine tries the modern
page twice, waiting 1.5 seconds between captcha retries. A query with `site:`
gets one more attempt through the `site` parameter, and a final attempt against
the legacy page. That can run past ten seconds even when everything works. The
stock ten second timeout cuts it off, 45 seconds leaves room for the browser and
the retries. Reddit needs the same headroom because each page load fetches the
earlier pages first.

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

1. Open yandex.com (or old.reddit.com for the Reddit engine) and sign in for
   Reddit. You do not need to sign in for Yandex.
2. Open the browser's developer tools (usually `F12`, or "Inspect" from the
   right-click menu).
3. Switch to the Network tab and reload the page.
4. Select the first document request for the site (the page itself, not an
   image or script).
5. In that request's headers, find the `Cookie` request header and copy its
   whole value.
6. Paste the value into the engine's Cookies field and save.

For Reddit, `reddit_session` is the cookie that carries the login; `token_v2`
and the rest are optional but fine to include. Some browsers group request
headers under a "Request Headers" heading.

The header is stored in `plugin-settings.json` on the degoog host in plain
text, and Camoufox passes it to the browser context. Treat it like a password.

## Settings that help

The short version: web engines on Camoufox with a 45 second timeout and cookies
(required for Reddit, recommended for Yandex); media engines on curl-fallback
with cookies.

Safe-search is a per-engine choice. `off` sends Yandex the `adult` flag, so
unfiltered results come back unblurred. `moderate` keeps Yandex's default blur
on NSFW results. `strict` turns on family mode.

For images, videos and visual search, the safe-search setting a visitor picks in degoog
wins over the engine default. If a visitor asks for `off`, the engine sends the
adult flag even when its own setting says `moderate`.

A `site:` query works on the Yandex web engine when it has one site token and at
least one other word:

```
site:example.com keyword
```

The engine strips the token, searches the remaining words, and uses Yandex's
`site` parameter when the first attempt returns nothing. Multiple `site:`
tokens are left alone and sent to Yandex as typed, which usually returns
nothing.

## Privacy

Visual Search uploads every image to Yandex, a third party, along with any
words typed next to it. Yandex sees the degoog server IP address, not the visitor's,
and keeps the image under its own terms. The engine shows this warning in its
settings. Do not enable it if that trade is not acceptable.

The other three Yandex engines send only the query text and your cookies (if set) to Yandex. The Reddit engine sends the query text and your Reddit cookies to Reddit, and the slot plugin sends `about.json` requests with its own cookie when it needs counts for community links without them. The Mojeek engine sends the query text, your cookies (if set) and the ALTCHA solution to Mojeek.

## Troubleshooting

### Yandex asked for a captcha

Yandex blocked the IP or the session, not the engine. Add cookies, wait a
little, or switch the Yandex web engine to Camoufox. Lowering the crawl rate also
helps.

### Engine timeout

Raise the engine timeout. The web engines running behind Camoufox need 45000 ms.
The others usually fit within ten seconds.

### The engine says it changed its results page

The site changed its markup or JSON shape. Ensure the extension is up-to-date.

### A `site:` query returns off-site hits

Yandex occasionally ignores the operator, and degoog's built-in indexer can
replay those rows on later searches for the same query. Clear the indexer and
turn off the Degoog engine (if enabled), then run the search again. A less thin query helps
too.

### Reddit queries return a login page

Reddit only serves `old.reddit.com` to logged-in accounts. Add cookies from a
signed-in browser: `reddit_session` is the one that matters. The account must
have used Old Reddit in the last six months unless it moderates a subreddit. The
engine reports this as a block.

## License

MIT. See [LICENSE](LICENSE).
