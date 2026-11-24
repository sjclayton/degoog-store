export const FALLBACK_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

export const DOMAINS = ["yandex.com", "ya.ru"];
export const SAFE_MODES = ["off", "moderate", "strict"];

export const CAPTCHA_RE = /showcaptcha|smartcaptcha|[?&]captcha=/i;
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
  const lower = String(html ?? "").toLowerCase();
  return CAPTCHA_MARKERS.some((marker) => lower.includes(marker.toLowerCase()));
};

export const resolveSafe = (engineSafe, context) => {
  const nsfw = context?.imageFilter?.nsfw;
  if (nsfw === "on") return "strict";
  if (nsfw === "moderate") return "moderate";
  if (nsfw === "off") return "off";
  return SAFE_MODES.includes(engineSafe) ? engineSafe : "moderate";
};

export const buildSearchUrl = (query, page, safe, domain, legacy = false) => {
  const params = new URLSearchParams({
    text: query,
    p: String(Math.max(0, (page || 1) - 1)),
    format: "json",
  });
  if (safe === "strict") params.set("family", "yes");
  if (safe === "off") params.set("adult", "1");
  if (legacy) params.set("tmpl_version", "releases");
  return `https://${domain}/video/search?${params}`;
};

export const buildHeaders = (domain, context, extra = {}) => ({
  "User-Agent": context?.userAgent?.() ?? FALLBACK_UA,
  Accept: "application/json, text/html, */*",
  "Accept-Language": context?.buildAcceptLanguage?.() ?? "en-US,en;q=0.9",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  ...extra,
});
