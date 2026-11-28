# Reddit

Reddit post and community search through Reddit's search JSON. This engine needs cookies from a signed-in Reddit account and does best behind Camoufox.

## What it does

Results include posts and communities. Posts open their discussion thread on <www.reddit.com>; link posts show the external domain in the snippet. Communities show their member count, age and description. The `Sort By` setting controls how Reddit orders the results.

Include `r/name` to search inside one community, for example `r/selfhosted degoog`. A `site:reddit.com` token is dropped because every result is already from Reddit.

Community member counts come from Reddit's `about.json` endpoint and are cached briefly. Turn off `Community member counts` in the engine settings to skip the extra lookups. The Reddit Communities slot plugin can use those counts to show a panel of communities above the results.

Pages use Reddit's `after` cursors, so a later page continues from the one before it. Pages stop being returned at 5.

## Install

Add this repository in degoog's store settings: `https://github.com/sjclayton/degoog-store.git`. Install the engine from the repo, then enable and configure it under Settings > Engines.

## Transport and timeout

Use Camoufox with this engine. Reddit blocks most server IPs and plain HTTP clients; a real Firefox session gets through far more often.

| Setting            | Value                                             | Why                                                     |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------- |
| Outgoing transport | Camoufox                                          | Reddit blocks most server IPs and plain HTTP clients.   |
| Timeout            | `45000` ms                                        | A search loads post and community listings in parallel. |
| Cookies            | `Cookie` header from any signed-in Reddit session | Reddit blocks unauthenticated search requests.          |

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

The stock ten second timeout cuts off the two parallel listing requests; `45000` leaves room.

## Safe search

Reddit only has on/off safe-search. `off` includes NSFW posts and sends the `over18` cookie. `moderate` and `strict` hide NSFW posts and communities, which is what Reddit does by default.

## Cookies

Cookies are required, and any signed-in Reddit cookie works. The steps are the same in any modern browser (Chrome, Edge, Firefox, Safari, and others); only the menu labels differ slightly:

1. Open reddit.com in your browser and sign in.
2. Open the browser's developer tools (usually `F12`, or "Inspect" from the right-click menu).
3. Switch to the Network tab and reload the page.
4. Select the first document request for the site (the page itself, not an image or script).
5. In that request's headers, find the `Cookie` request header and copy its whole value.
6. Paste the value into the engine's Cookies field and save.

`reddit_session` is the cookie that carries the login; `token_v2` and the rest are optional but fine to include. Some browsers group request headers under a "Request Headers" heading.

The header is stored in `plugin-settings.json` on the degoog host in plain text, and Camoufox passes it to the browser context. Treat it like a password.

## Privacy

The engine sends the query text and your Reddit cookies to Reddit.

## Troubleshooting

### Reddit queries return a block page

Reddit refuses unauthenticated search requests. The engine reports this as a block; add cookies from a signed-in browser, as described in Cookies above.

### Engine timeout

Raise the engine timeout to `45000` ms.

### The engine says it changed its results page

The site changed its markup or JSON shape. Ensure the extension is up-to-date.
