export const FALLBACK_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export const DOMAIN = "yandex.com";
export const SAFE_SEARCH_MODES = ["off", "moderate", "strict"];
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
  "Verification JavaScript is disabled",
  "Checking your browser before redirecting",
  "Turn on Javascript and refresh the page",
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
  ...(cookies ? { Cookie: cookies } : {}),
});

const SITE_OPERATOR_RE = /(?:^|\s)site:([^\s/]+)(?=\s|$)/gi;

export const splitSiteQuery = (query) => {
  const matches = [...query.matchAll(SITE_OPERATOR_RE)];
  if (matches.length !== 1) return { text: query, site: undefined };
  const match = matches[0];
  const site = match[1].replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const text = `${query.slice(0, match.index)} ${query.slice(match.index + match[0].length)}`
    .replace(/\s+/g, " ")
    .trim();
  if (!site || !text) return { text: query, site: undefined };
  return { text, site };
};

export const buildUrl = (query, page, timeFilter, opts) => {
  const { legacy = false, safeSearch = "moderate" } = opts;

  const { text, site } = legacy
    ? { text: query, site: undefined }
    : splitSiteQuery(query);

  const params = new URLSearchParams({
    text,
    p: String(Math.max(0, (page || 1) - 1)),
  });
  if (site) params.set("site", site);

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
  return `https://${DOMAIN}${path}?${params.toString()}`;
};
