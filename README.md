# sjclayton's degoog extensions

Four Yandex engines for degoog. They exist because Yandex answers searches the
other engines refuse. Bing, DuckDuckGo and Brave drop many NSFW or niche
queries and return an empty page. Yandex returns images, videos or pages for
the same words. Treat these engines as a second opinion, not a replacement for
your main engines.

## What's in the repo

| Engine               | Version | Type   | What it does                                                                                                                                          |
| -------------------- | ------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Yandex               | 1.5.2   | web    | Web search on yandex.com. Understands a single `site:` token and retries through Yandex's own `site` parameter when the plain query comes back empty. |
| Yandex Images        | 1.2.1   | images | Image search with size, type and layout filters.                                                                                                      |
| Yandex Videos        | 1.2.1   | videos | Video search. Reads Yandex's JSON endpoint instead of parsing HTML.                                                                                   |
| Yandex Visual Search | 1.2.1   | images | Reverse image search. Upload an image, or use the image tab, to find pages that contain it and images that look like it.                              |

The web engine falls back to Yandex's legacy results page when the modern page
returns nothing, Images and Videos do the same.

## Install

1. Add this repository in degoog's store settings:
   `https://github.com/sjclayton/degoog-store.git`
2. Open the repo in the store and install the engines you want.
3. Enable them under Settings, then Engines.

## Transports

### Camoufox for web search

Yandex guards its web results hardest. A real Firefox session gets through more
often than curl, so the web engine does best behind
[Camoufox](https://github.com/degoog-org/official-extensions/tree/main/transports/camoufox),
the official transport that drives a stealth Firefox build.

Install the Camoufox transport from the official extensions repo, run its
service, and point the transport at it. The transport's README has the Docker
compose file, the Dockerfile and the small Python server.

Settings for the Yandex web engine:

| Setting            | Value                                |
| ------------------ | ------------------------------------ |
| Outgoing transport | Camoufox                             |
| Timeout            | `45000` ms                           |
| Cookies            | your `Cookie` header from yandex.com |

The timeout matters. On a normal query the engine tries the modern page twice,
waiting 1.5 seconds between captcha retries. A query with `site:` gets one more
attempt through the `site` parameter, and a final attempt against the legacy
page. That can run past ten seconds even when everything works. The stock ten
second timeout cuts it off, 45 seconds leaves room for the browser and the
retries.

Settings for the Camoufox transport:

| Setting                            | Value                          | Why                                                                  |
| ---------------------------------- | ------------------------------ | -------------------------------------------------------------------- |
| Camoufox URL                       | `http://<camoufox-host>:53323` | Where your service listens.                                          |
| Warm up before request             | on                             | Visits yandex.com before the real page. Yandex flags cold sessions.  |
| Warmup dwell                       | `2500` ms                      | Short enough to stay quick, long enough for the session to register. |
| Timeout                            | `30000` ms                     | Time for the page itself, separate from the engine timeout.          |
| Wait until                         | `load`                         | Yandex's result page is usable before the network goes idle.         |
| Bypass proxy for Camoufox endpoint | on                             | Talk to the service directly, not through degoog's proxy.            |

If the Camoufox service runs on the same machine as degoog, use
`http://127.0.0.1:53323` instead.

### curl-fallback for the other three

Images, Videos and Visual Search do not need a browser. They default to
`curl-fallback`, which tries Bun's `fetch` first and retries with curl on 403,
429, 502 and 503. Leave it alone unless you have a reason to change it. Leave
the timeout empty to use the ten second default. Raise it to `20000` if you see
timeouts. Plain `curl` also works if `curl-fallback` gives you trouble.

### Cookies

Cookies are optional and worth setting. Yandex raises the captcha rate for
anonymous sessions, and a real browser session lowers it.

Open yandex.com in your browser, open the developer tools, find the document
request in the Network tab, and copy the whole `Cookie` request header. Paste
it into the engine's Cookies field. You do not need to be signed in to Yandex for this.

The header is stored in `plugin-settings.json` on the degoog host in plain
text, and Camoufox passes it to the browser context. Treat it like a password.

## Settings that help

The short version: web on Camoufox with cookies and a 45 second timeout, media
engines on curl-fallback with cookies.

Safe search is a per-engine choice. `off` sends Yandex the `adult` flag, so
unfiltered results come back unblurred. `moderate` keeps Yandex's default blur
on NSFW results. `strict` turns on family mode.

For images, videos and visual search, the safe-search setting a visitor picks in degoog
wins over the engine default. If a visitor asks for `off`, the engine sends the
adult flag even when its own setting says `moderate`.

A `site:` query works on the web engine when it has one site token and at
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
words typed next to it. Yandex sees this server's IP address, not the visitor's,
and keeps the image under its own terms. The engine shows this warning in its
settings. Do not enable it if that trade is not acceptable.

The other three engines send only the query text and your cookies (if set) to Yandex.

## Troubleshooting

### Yandex asked for a captcha

Yandex blocked the IP or the session, not the engine. Add cookies, wait a
little, or switch the web engine to Camoufox. Lowering the crawl rate also
helps.

### Engine timeout

Raise the engine timeout. The web engine behind Camoufox needs 45000 ms. The
others usually fit within ten seconds.

### The engine says it changed its results page

Yandex changed its markup or JSON shape. Ensure the extension is up-to-date.

### A `site:` query returns off-site hits

Yandex occasionally ignores the operator, and degoog's built-in indexer can
replay those rows on later searches for the same query. Clear the indexer or
turn off the Degoog engine (if enabled), then run the search again. A less thin query helps
too.

## License

MIT. See [LICENSE](LICENSE).
