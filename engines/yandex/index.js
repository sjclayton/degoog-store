import * as cheerio from "cheerio";

export const type = "web";
export const description = "Yandex web search.";
export const site = "https://yandex.com/";

const NAME = "Yandex";
const DOMAINS = ["yandex.com", "ya.ru"];
const SAFE_SEARCH_MODES = ["off", "moderate", "strict"];
const LANGUAGES = [
  "auto",
  "en",
  "ru",
  "be",
  "fr",
  "de",
  "id",
  "kk",
  "tt",
  "tr",
  "uk",
];
const REGIONS = ["101", "177", "84", "102", "111", "225", "auto"];
const REGION_LABELS = [
  "Germany (Stuttgart) - least Russian in testing",
  "Germany (Berlin)",
  "USA",
  "United Kingdom",
  "Europe",
  "Russia",
  "Auto / no region",
];
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
      "Off removes filtering, Moderate is Yandex's default, Strict enables family mode.",
  },
  {
    key: "language",
    label: "Result language",
    type: "select",
    options: LANGUAGES,
    default: "en",
    description:
      "Forces Yandex to bias results towards this language. Defaults to English, which is the strongest way to reduce Russian results on ya.ru.",
  },
  {
    key: "region",
    label: "Result region",
    type: "select",
    options: REGIONS,
    optionLabels: REGION_LABELS,
    default: "101",
    description:
      "Yandex 'lr' region. A non-Russian region further reduces Russian results. Germany (Stuttgart) scored best in testing.",
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
    label: "Retry after a captcha",
    type: "toggle",
    default: "true",
    description:
      "On a captcha, try the legacy endpoint and then the other Yandex domain before giving up.",
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

export default class YandexEngine {
  isClientExposed = false;
  name = NAME;
  bangShortcut = "y";
  domain = DOMAINS[0];
  safeSearch = "moderate";
  language = "en";
  region = "101";
  cookies = "";
  fallbackOnCaptcha = true;
  settingsSchema = SETTINGS_SCHEMA;

  configure(settings) {
    if (DOMAINS.includes(settings?.domain)) this.domain = settings.domain;
    if (SAFE_SEARCH_MODES.includes(settings?.safeSearch)) {
      this.safeSearch = settings.safeSearch;
    }
    if (LANGUAGES.includes(settings?.language)) this.language = settings.language;
    if (REGIONS.includes(settings?.region)) this.region = settings.region;
    if (typeof settings?.cookies === "string" && settings.cookies !== "__SET__") {
      this.cookies = settings.cookies.trim();
    }
    this.fallbackOnCaptcha = settings?.fallbackOnCaptcha !== "false";
  }

  buildUrl(query, page, timeFilter, context, domain = this.domain, legacy = false) {
    const params = new URLSearchParams({
      text: query,
      p: String(Math.max(0, (page || 1) - 1)),
    });

    const lang =
      this.language === "auto"
        ? context?.lang?.split("-")[0]
        : this.language;
    if (lang) params.set("lang", lang);
    if (this.region !== "auto") params.set("lr", this.region);
    if (timeFilter && WITHIN[timeFilter]) params.set("within", WITHIN[timeFilter]);

    if (this.safeSearch === "strict") params.set("family", "yes");
    if (this.safeSearch === "off") params.set("adult", "1");

    if (legacy) {
      params.set("tmpl_version", "releases");
      params.set("web", "1");
      params.set("frame", "1");
      params.set("searchid", "3131712");
    }
    const path = legacy ? "/search/site/" : "/search/";
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
    const alternate = DOMAINS.find((candidate) => candidate !== this.domain);
    const attempts = [
      { domain: this.domain, legacy: false },
      { domain: this.domain, legacy: true },
    ];
    if (this.fallbackOnCaptcha && alternate) {
      attempts.push({ domain: alternate, legacy: false });
      attempts.push({ domain: alternate, legacy: true });
    }

    for (const attempt of attempts) {
      try {
        return await this._run(
          query,
          page,
          timeFilter,
          context,
          attempt.domain,
          attempt.legacy,
        );
      } catch (error) {
        if (!error?.__yandexCaptcha) throw error;
      }
    }
    throw this._blocked(context, `on ${this.domain}`);
  }

  async _run(query, page, timeFilter, context, domain, legacy) {
    const doFetch = context?.fetch ?? fetch;
    const response = await doFetch(
      this.buildUrl(query, page, timeFilter, context, domain, legacy),
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
    return legacy ? parseLegacyWeb($, domain, this.name) : parseWeb($, domain, this.name);
  }
}
