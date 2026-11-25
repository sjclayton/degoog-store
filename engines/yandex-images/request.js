export const FALLBACK_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

export const DOMAIN = "yandex.com";
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

const SIZE_MAP = { small: "small", medium: "medium", large: "large" };
const TYPE_MAP = { photo: "photo", clipart: "lineart" };
const LAYOUT_MAP = { square: "square", wide: "horizontal", tall: "vertical" };

export const buildSearchUrl = (query, page, safe, imageFilter, legacy = false) => {
  const params = new URLSearchParams({
    text: query,
    rpt: "image",
    p: String(Math.max(0, (page || 1) - 1)),
  });
  if (safe === "strict") params.set("family", "yes");
  if (safe === "off") params.set("adult", "1");
  if (legacy) params.set("tmpl_version", "releases");

  const f = imageFilter ?? {};
  if (f.size && SIZE_MAP[f.size]) params.set("isize", SIZE_MAP[f.size]);
  if (f.type && TYPE_MAP[f.type]) params.set("type", TYPE_MAP[f.type]);
  if (f.layout && LAYOUT_MAP[f.layout]) params.set("iorient", LAYOUT_MAP[f.layout]);

  return `https://${DOMAIN}/images/search?${params}`;
};

export const buildHeaders = (context, extra = {}) => ({
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
    '"Chromium";v="133", "Google Chrome";v="133", "Not-A.Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Linux"',
  ...extra,
});
