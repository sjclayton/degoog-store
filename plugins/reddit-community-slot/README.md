# Reddit Communities

A slot plugin that shows communities from Reddit results above the search results. Each card shows the community icon (or a generic Snoo icon), `r/name`, member count, age and description.

## What it shows

`Max communities count` sets the limit between 1 and 10. `Sort` picks the card order: `Members` (the default) sorts by member count, highest first, while `Relevance` keeps the order of the results, or Reddit's community search order in Direct mode.

When the Reddit engine is installed, the plugin uses the counts that engine attaches to its community results. It can also work on its own: paste a signed-in Reddit cookie into the plugin's `Reddit cookies` setting and it reads the count, age, icon and description from `about.json` for any `reddit.com/r/<name>` link in the results, including links returned by other engines. Without a cookie, only results that already carry a count can produce cards.

## Source modes

`Source` chooses where candidates come from. `Results` (the default) uses community links in the results. `Direct` ignores the results and passes the whole query to Reddit's community search, which matches community names and descriptions. The lookup includes NSFW communities so relevant matches are not hidden by Reddit; the plugin then applies the safe-search rules below. `Direct` needs a Reddit cookie to be set. The number of lookups is capped by `Max communities count`, so `Members` ranks the communities that come back first in Reddit's relevance search.

## Safe search and NSFW

Communities Reddit marks NSFW are hidden when safe search is `moderate` or `strict`, and shown when it is `off`. Web searches in degoog use the engine's setting, so when the Reddit engine is installed its saved `Safe Search` setting controls this. The plugin's own `Safe search` setting applies only when the Reddit engine is not installed.

## Install

Add this repository in degoog's store settings: `https://github.com/sjclayton/degoog-store.git`. Install the plugin from the repo, then enable and configure it under Settings > Plugins.

## Privacy

The slot plugin sends `about.json` requests with its own cookie when it needs counts for community links without them.

## Troubleshooting

### No cards appear

The plugin needs community links in the results, or `Direct` mode with a Reddit cookie (see What it shows). Without either, there is nothing to show.
