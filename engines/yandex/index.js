import * as cheerio from "cheerio";

export const type = ["web", "images", "videos"];
export const description = "Yandex web, image and video search.";

const NAME = "Yandex";
const DOMAINS = ["yandex.com", "ya.ru"];
const SAFE_SEARCH_MODES = ["off", "moderate", "strict"];
const PATHS = {
  web: "/search/",
  images: "/images/search",
  videos: "/video/search",
};
const WITHIN = {
  hour: "77",
  day: "77",
  week: "9",
  month: "2",
  year: "5",
};
const CAPTCHA_RE = /showcaptcha|[?&]captcha=/i;
const CAPTCHA_MARKERS = [
  "SmartCaptcha",
  "captcha__image",
  "captcha-required",
  "Подтвердите, что запросы отправляли вы",
  "я не робот",
];
const isCaptcha = (response, html) => {
  if (response?.headers?.get?.("x-yandex-captcha") === "captcha") return true;
  if (CAPTCHA_RE.test(response?.url ?? "")) return true;
  const lower = html.toLowerCase();
  return CAPTCHA_MARKERS.some((marker) => lower.includes(marker.toLowerCase()));
};
const FALLBACK_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const SETTINGS_SCHEMA = [
  {
    key: "domain",
    label: "Yandex domain",
    type: "select",
    options: DOMAINS,
    default: "yandex.com",
    description: "Which Yandex site to search: yandex.com or ya.ru.",
  },
  {
    key: "safeSearch",
    label: "Safe Search",
    type: "select",
    options: SAFE_SEARCH_MODES,
    default: "moderate",
    description:
      "Off removes filtering, Moderate is Yandex's default, Strict enables family mode for web, images and videos.",
  },
  {
    key: "cookies",
    label: "Yandex cookies (optional)",
    type: "textarea",
    secret: true,
    description:
      "Paste the full Cookie header from yandex.com or ya.ru in your browser (signed in or not). A real browser session lowers the captcha rate. Keep it private.",
  },
  {
    key: "fallbackOnCaptcha",
    label: "Retry on the other domain after a captcha",
    type: "toggle",
    default: "true",
    description:
      "If the selected domain serves a captcha, try the same search once on the other domain before giving up.",
  },
];

const absolute = (raw, domain) => {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `https://${domain}${value}`;
  if (/^https?:\/\//i.test(value)) return value;
  return undefined;
};

const cleanText = (value) =>
  typeof value === "string" ? cheerio.load(`<span>${value}</span>`).text().trim() : "";

const isYandexUrl = (url) => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "yandex.com" || host === "ya.ru" || host === "yandex.ru";
  } catch {
    return true;
  }
};

const readState = (html, pick) => {
  const $ = cheerio.load(html);
  let found;
  $("[data-state]").each((_, el) => {
    if (found) return;
    const raw = $(el).attr("data-state") ?? "";
    if (!raw.startsWith("{")) return;
    try {
      found = pick(JSON.parse(raw));
    } catch {}
  });
  return found;
};

const parseWeb = ($, domain, name) => {
  const results = [];
  $("li.serp-item[data-cid]").each((_, el) => {
    const item = $(el);
    if (item.find(".Label_theme_direct, [data-fast-name='adv']").length > 0) return;

    const link = item.find("a.OrganicTitle-Link, h2 a").first();
    const title = link.text().trim();
    let url = absolute(link.attr("href"), domain);
    if ((!url || isYandexUrl(url)) && !title) return;

    if (!url || isYandexUrl(url)) {
      url = absolute(item.find("a.OrganicHost-Link").first().attr("href"), domain);
    }
    if (!url || isYandexUrl(url) || !title) return;

    const snippet =
      cleanText(
        item
          .find(".OrganicTextContent, .OrganicText, [class*='OrganicTextContent']")
          .first()
          .html() ?? "",
      ) || undefined;

    results.push({
      title,
      url,
      snippet,
      source: name,
      displayUrl: item.find(".Path-Item").first().text().trim() || undefined,
    });
  });
  return results;
};

const parseLegacyWeb = ($, domain, name) => {
  const results = [];
  $("li.b-serp-item").each((_, el) => {
    const item = $(el);
    if (item.find(".b-direct, .ad").length > 0) return;
    const link = item.find("a.b-serp-item__title-link").first();
    const title = cleanText(link.text());
    const url = absolute(link.attr("href"), domain);
    if (!title || !url || isYandexUrl(url)) return;
    const snippet =
      cleanText(item.find(".b-serp-item__text").first().html() ?? "") || undefined;
    results.push({
      title,
      url,
      snippet,
      source: name,
      displayUrl: item.find(".b-serp-url").first().text().trim() || undefined,
    });
  });
  return results;
};

const parseImages = (html, domain, name) => {
  const entities = readState(
    html,
    (state) => state?.initialState?.serpList?.items?.entities,
  );
  const results = [];

  if (entities && typeof entities === "object") {
    for (const item of Object.values(entities)) {
      const viewer = item?.viewerData ?? {};
      const imageUrl = absolute(
        item?.origUrl || viewer.img_href || viewer.preview?.[0]?.url || item?.image,
        domain,
      );
      const thumbnail = absolute(viewer.thumb?.url || item?.image, domain);
      const url = absolute(item?.snippet?.url || viewer.snippet?.url, domain);
      const title =
        cleanText(item?.snippet?.title || item?.alt || viewer.snippet?.title);
      if (!imageUrl || !thumbnail || !url || isYandexUrl(url) || !title) continue;
      results.push({
        title,
        url,
        snippet: cleanText(viewer.snippet?.text) || "",
        source: name,
        thumbnail,
        imageUrl,
        displayUrl: item?.snippet?.domain || viewer.snippet?.domain,
      });
    }
  }

  if (results.length === 0) {
    const $ = cheerio.load(html);
    $(".SerpItem, .serp-item").each((_, el) => {
      const item = $(el);
      const img = item.find("img").first();
      const thumbnail = absolute(img.attr("src") || img.attr("data-src"), domain);
      const link = item.find("a").first();
      const url = absolute(link.attr("href"), domain);
      if (!thumbnail || !url || isYandexUrl(url)) return;
      results.push({
        title: cleanText(img.attr("alt") || link.attr("aria-label")) || name,
        url,
        snippet: "",
        source: name,
        thumbnail,
        imageUrl: thumbnail,
      });
    });
  }

  return results;
};

const parseVideos = ($, domain, name) => {
  const results = [];
  $(".VideoSnippet").each((_, el) => {
    const item = $(el).closest("li");
    const titleLink = item.find("a.VideoSnippet-Title").first();
    const title = cleanText(titleLink.attr("title") || titleLink.text());
    const hostLink = item.find("a.VideoHostExtended-Host").first();
    const url = absolute(hostLink.attr("href") || titleLink.attr("href"), domain);
    if (!title || !url || isYandexUrl(url)) return;

    const poster = item.find("video").first().attr("poster");
    const style = item.find(".VideoThumb3").first().attr("style") ?? "";
    const background = /background-image:\s*url\(["']?([^"')]+)["']?\)/.exec(style)?.[1];
    const thumbnail = absolute(poster || background, domain);
    const duration = item.find(".VideoThumb3Meta-Duration").first().text().trim();
    const published = item
      .find(".VideoSnippet-MetaPoint_kind_date")
      .first()
      .contents()
      .filter((_, node) => node.type === "text")
      .text()
      .trim();
    let iso;
    if (/^\d{1,2}\s+\w+\s+\d{4}$/.test(published)) {
      const parsed = new Date(published);
      if (!Number.isNaN(parsed.getTime())) iso = parsed.toISOString().slice(0, 10);
    }

    results.push({
      title,
      url,
      snippet: hostLink.text().trim() || undefined,
      source: name,
      thumbnail,
      duration: duration || undefined,
      publishedAt: iso,
    });
  });
  return results;
};

export default class YandexEngine {
  isClientExposed = false;
  name = NAME;
  bangShortcut = "y";
  domain = DOMAINS[0];
  safeSearch = "moderate";
  cookies = "";
  fallbackOnCaptcha = true;
  settingsSchema = SETTINGS_SCHEMA;

  configure(settings) {
    if (DOMAINS.includes(settings?.domain)) this.domain = settings.domain;
    if (SAFE_SEARCH_MODES.includes(settings?.safeSearch)) {
      this.safeSearch = settings.safeSearch;
    }
    if (typeof settings?.cookies === "string" && settings.cookies !== "__SET__") {
      this.cookies = settings.cookies.trim();
    }
    this.fallbackOnCaptcha = settings?.fallbackOnCaptcha !== "false";
  }

  buildUrl(query, page, timeFilter, context, searchType, domain = this.domain, legacy = false) {
    const params = new URLSearchParams({
      text: query,
      p: String(Math.max(0, (page || 1) - 1)),
    });

    if (context?.lang) params.set("lang", context.lang.split("-")[0]);
    if (timeFilter && WITHIN[timeFilter]) params.set("within", WITHIN[timeFilter]);

    if (this.safeSearch === "strict") params.set("family", "yes");
    if (this.safeSearch === "off") params.set("adult", "1");

    if (legacy) {
      params.set("tmpl_version", "releases");
      params.set("web", "1");
      params.set("frame", "1");
      params.set("searchid", "3131712");
    }
    const path = legacy && searchType === "web" ? "/search/site/" : PATHS[searchType];
    return `https://${domain}${path}?${params.toString()}`;
  }

  _blocked(context, where) {
    const message = `${NAME} asked for a captcha ${where}`;
    const error =
      context?.engineError?.("captcha", message, { engine: NAME }) ??
      new Error(message);
    return Object.assign(error, { __yandexCaptcha: true });
  }

  async executeSearch(query, page = 1, timeFilter, context) {
    const requested = context?.searchType;
    const searchType = Object.hasOwn(PATHS, requested) ? requested : "web";
    const alternate = DOMAINS.find((candidate) => candidate !== this.domain);
    const attempts = [{ domain: this.domain, legacy: false }];
    if (searchType === "web") attempts.push({ domain: this.domain, legacy: true });
    if (this.fallbackOnCaptcha && alternate) {
      attempts.push({ domain: alternate, legacy: false });
      if (searchType === "web") {
        attempts.push({ domain: alternate, legacy: true });
      }
    }

    for (const attempt of attempts) {
      try {
        return await this._run(
          query,
          page,
          timeFilter,
          context,
          searchType,
          attempt.domain,
          attempt.legacy,
        );
      } catch (error) {
        if (!error?.__yandexCaptcha) throw error;
      }
    }
    throw this._blocked(context, `on ${this.domain}`);
  }

  async _run(query, page, timeFilter, context, searchType, domain, legacy) {
    const doFetch = context?.fetch ?? fetch;
    const response = await doFetch(
      this.buildUrl(query, page, timeFilter, context, searchType, domain, legacy),
      {
        headers: {
          "User-Agent": context?.userAgent?.() ?? FALLBACK_UA,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language":
            context?.buildAcceptLanguage?.() ?? "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
          "sec-ch-ua":
            '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Linux"',
          ...(this.cookies ? { Cookie: this.cookies } : {}),
        },
        redirect: "follow",
      },
    );
    context?.sentinel?.(response, this.name);

    const html = await response.text();
    if (isCaptcha(response, html)) {
      throw this._blocked(context, `on ${domain}`);
    }

    const $ = cheerio.load(html);
    if (searchType === "images") return parseImages(html, domain, this.name);
    if (searchType === "videos") return parseVideos($, domain, this.name);
    if (legacy) return parseLegacyWeb($, domain, this.name);
    return parseWeb($, domain, this.name);
  }
}
