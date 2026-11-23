import * as cheerio from "cheerio";

export type SearchType = "web" | "images" | "videos";

export interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
  displayUrl?: string;
  thumbnail?: string;
  image?: string;
}

export interface SearchContext {
  fetch: typeof fetch;
  type?: SearchType;
  page?: number;
  language?: string;
  timeRange?: string;
  safeSearch?: number | string | boolean;
  settings?: Record<string, any>;
}

function normalizeUrl(raw: string | undefined, baseDomain: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("/")) return `https://${baseDomain}${trimmed}`;
  return trimmed;
}

function isStrictSafeSearch(val: SearchContext["safeSearch"]): boolean {
  if (val === 2 || val === true) return true;
  if (typeof val === "string") {
    const normalized = val.trim().toLowerCase();
    return normalized === "2" || normalized === "strict" || normalized === "high" || normalized === "family";
  }
  return false;
}

function buildSearchUrl(query: string, ctx: SearchContext): string {
  const domain = ctx.settings?.domain || "yandex.com";
  const searchType: SearchType = ctx.type || "web";
  const pageIndex = Math.max(0, (ctx.page || 1) - 1);

  const pathByType: Record<SearchType, string> = {
    web: "/search/",
    images: "/images/search",
    videos: "/video/search",
  };

  const params = new URLSearchParams({
    text: query,
    p: String(pageIndex),
  });

  if (ctx.language) {
    params.set("lang", ctx.language.split("-")[0]);
  }

  const timeMap: Record<string, string> = {
    day: "77",
    week: "1",
    month: "2",
  };
  if (ctx.timeRange && timeMap[ctx.timeRange]) {
    params.set("within", timeMap[ctx.timeRange]);
  }

  // Forward Degoog's SafeSearch setting to Yandex's family filter flag
  if (isStrictSafeSearch(ctx.safeSearch)) {
    params.set("fy", "1");
  }

  return `https://${domain}${pathByType[searchType]}?${params.toString()}`;
}

export async function search(
  query: string,
  context: SearchContext
): Promise<{ results: SearchResult[]; error?: string }> {
  const domain = context.settings?.domain || "yandex.com";
  const searchType: SearchType = context.type || "web";
  const targetUrl = buildSearchUrl(query, context);

  const res = await context.fetch(targetUrl, {
    headers: {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": context.language || "en-US,en;q=0.9",
    },
  });

  if (!res.ok) {
    return { results: [], error: `HTTP ${res.status}` };
  }

  const html = await res.text();

  if (html.includes("SmartCaptcha") || html.includes("showcaptcha") || res.url.includes("showcaptcha")) {
    return { results: [], error: "CAPTCHA challenge" };
  }

  const $ = cheerio.load(html);
  const results: SearchResult[] = [];

  if (searchType === "images") {
    // Parse embedded JSON state when present, falling back to DOM image cards
    $("[data-state]").each((_, el) => {
      const rawState = $(el).attr("data-state");
      if (!rawState || !rawState.includes("http")) return;
      try {
        const parsed = JSON.parse(rawState);
        const items = Array.isArray(parsed?.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
        for (const item of items) {
          const imgUrl = normalizeUrl(item?.url || item?.origUrl || item?.img_href, domain);
          const thumbUrl = normalizeUrl(item?.thumb?.url || item?.thumbnail || item?.preview?.[0]?.url, domain);
          const pageUrl = normalizeUrl(item?.snippet?.url || item?.referer || item?.url, domain);
          const title = (item?.snippet?.title || item?.title || query).trim();
          if (imgUrl && pageUrl) {
            results.push({
              title,
              url: pageUrl,
              image: imgUrl,
              thumbnail: thumbUrl || imgUrl,
              displayUrl: item?.snippet?.domain,
            });
          }
        }
      } catch {
        // Non-JSON data-state block; ignore
      }
    });

    if (results.length === 0) {
      $(".SerpItem, .serp-item").each((_, el) => {
        const item = $(el);
        const imgEl = item.find("img").first();
        const thumbUrl = normalizeUrl(imgEl.attr("src") || imgEl.attr("data-src"), domain);
        const linkEl = item.find("a").first();
        const href = normalizeUrl(linkEl.attr("href"), domain);
        const title = (imgEl.attr("alt") || linkEl.attr("aria-label") || query).trim();
        if (href && thumbUrl) {
          results.push({
            title,
            url: href,
            thumbnail: thumbUrl,
            image: thumbUrl,
          });
        }
      });
    }

    return { results };
  }

  if (searchType === "videos") {
    $(".serp-item, [data-fast-name='video']").each((_, el) => {
      const item = $(el);
      const linkEl = item.find("a").filter((_, a) => Boolean($(a).attr("href"))).first();
      const url = normalizeUrl(linkEl.attr("href"), domain);
      const title =
        item.find("[class*='Title'], h2, h3").first().text().trim() ||
        linkEl.attr("aria-label")?.trim() ||
        linkEl.text().trim();
      const thumbUrl = normalizeUrl(
        item.find("img").first().attr("src") || item.find("img").first().attr("data-src"),
        domain
      );
      const snippet = item.find("[class*='Duration'], [class*='Channel'], [class*='Snippet']").first().text().trim() || undefined;

      if (url && title && !url.includes("/video/search")) {
        results.push({
          title,
          url,
          snippet,
          thumbnail: thumbUrl,
        });
      }
    });

    return { results };
  }

  // Default: web search
  $("li.serp-item[data-cid]").each((_, el) => {
    const item = $(el);

    if (item.find(".Label_theme_direct, [data-fast-name='adv']").length > 0) {
      return;
    }

    const linkEl = item.find("a.OrganicTitle-Link, h2 a").first();
    let url = linkEl.attr("href") || "";
    const title = linkEl.text().trim();

    if (!url || !title || url.startsWith("/") || url.includes("yandex.ru/clck")) {
      const cleanHref = item.find("a.Path-Item").first().attr("href");
      if (cleanHref && cleanHref.startsWith("http")) {
        url = cleanHref;
      } else {
        return;
      }
    }

    const snippet =
      item.find(".OrganicTextContentSpan, .Organic-Text, .text-container").first().text().trim() ||
      undefined;

    const displayUrl = item.find(".Path-Item").first().text().trim() || undefined;

    results.push({
      title,
      url,
      snippet,
      displayUrl,
    });
  });

  return { results };
}
