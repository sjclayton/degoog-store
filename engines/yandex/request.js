export const FALLBACK_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export const DOMAINS = ["yandex.com", "ya.ru"];
export const SAFE_SEARCH_MODES = ["off", "moderate", "strict"];
export const LANGUAGES = [
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
export const REGIONS = ["101", "177", "84", "102", "111", "225", "auto"];
export const REGION_LABELS = [
  "Germany (Stuttgart) - least Russian in testing",
  "Germany (Berlin)",
  "USA",
  "United Kingdom",
  "Europe",
  "Russia",
  "Auto / no region",
];
export const WITHIN = {
  hour: "77",
  day: "77",
  week: "9",
  month: "2",
  year: "5",
};

export const CAPTCHA_RE = /showcaptcha|[?&]captcha=/i;
export const CAPTCHA_MARKERS = [
  "SmartCaptcha",
  "captcha__image",
  "captcha-required",
  "Подтвердите, что запросы отправляли вы",
  "я не робот",
];

export const isCaptcha = (response, html) => {
  if (response?.headers?.get?.("x-yandex-captcha") === "captcha") return true;
  if (CAPTCHA_RE.test(response?.url ?? "")) return true;
  const lower = html.toLowerCase();
  return CAPTCHA_MARKERS.some((marker) => lower.includes(marker.toLowerCase()));
};

export const buildHeaders = (context, cookies = "") => ({
  "User-Agent": context?.userAgent?.() ?? FALLBACK_UA,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": context?.buildAcceptLanguage?.() ?? "en-US,en;q=0.9",
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
  ...(cookies ? { Cookie: cookies } : {}),
});

export const buildUrl = (query, page, timeFilter, opts) => {
  const {
    domain,
    legacy = false,
    language = "en",
    region = "101",
    safeSearch = "moderate",
    contextLang,
  } = opts;

  const params = new URLSearchParams({
    text: query,
    p: String(Math.max(0, (page || 1) - 1)),
  });

  const lang = language === "auto" ? contextLang?.split("-")[0] : language;
  if (lang) params.set("lang", lang);
  if (region !== "auto") params.set("lr", region);
  if (timeFilter && WITHIN[timeFilter]) params.set("within", WITHIN[timeFilter]);

  if (safeSearch === "strict") params.set("family", "yes");
  if (safeSearch === "off") params.set("adult", "1");

  if (legacy) {
    params.set("tmpl_version", "releases");
    params.set("web", "1");
    params.set("frame", "1");
    params.set("searchid", "3131712");
  }
  const path = legacy ? "/search/site/" : "/search/";
  return `https://${domain}${path}?${params.toString()}`;
};
