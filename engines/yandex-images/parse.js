import * as cheerio from "cheerio";

export const initialState = (html) => {
  const $ = cheerio.load(html);
  let found = null;
  $("[data-state]").each((_, el) => {
    if (found) return;
    const raw = $(el).attr("data-state") ?? "";
    if (!raw.includes("serpList")) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.initialState?.serpList) found = parsed.initialState;
    } catch {}
  });
  return found;
};

const _abs = (url) =>
  typeof url === "string" && url.startsWith("//") ? `https:${url}` : url;

const _pageUrl = (entity) => {
  const snippet = entity?.snippet;
  if (typeof snippet?.url === "string" && snippet.url.startsWith("http")) {
    return snippet.url;
  }
  const raw = entity?.url;
  if (typeof raw !== "string" || !raw) return "";
  try {
    const img = new URL(raw, "https://yandex.com").searchParams.get("img_url");
    if (img) return img;
  } catch {}
  return "";
};

export const parseResults = (state, name, options = {}) => {
  const { unblur = false, strict = false } = options;
  const items = state?.serpList?.items;
  const entities = items?.entities ?? {};
  const keys =
    Array.isArray(items?.keys) && items.keys.length > 0
      ? items.keys
      : Object.keys(entities);

  const results = [];
  const seen = new Set();
  for (const key of keys) {
    const entity = entities[key];
    if (!entity || typeof entity !== "object") continue;

    const censored = entity.censored === true;
    if (strict && censored) continue;

    const imageUrl = typeof entity.origUrl === "string" ? entity.origUrl : "";
    if (!imageUrl || seen.has(imageUrl)) continue;
    seen.add(imageUrl);

    const blurred = typeof entity.image === "string" ? entity.image : "";
    const clean = typeof entity.imageUnblurred === "string" ? entity.imageUnblurred : "";
    const thumbnail = _abs((censored && unblur && clean ? clean : blurred) || clean || blurred);
    if (!thumbnail) continue;

    const title =
      (typeof entity.snippet?.title === "string" && entity.snippet.title) ||
      (typeof entity.alt === "string" && entity.alt) ||
      "";

    results.push({
      title,
      url: _pageUrl(entity) || imageUrl,
      snippet: "",
      source: name,
      thumbnail,
      imageUrl,
      ...(entity.gifLabel === true ? { isGif: true } : {}),
    });
  }
  return results;
};
