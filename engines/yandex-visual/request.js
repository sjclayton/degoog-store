export const FALLBACK_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

export const DOMAIN = "yandex.com";
export const SAFE_MODES = ["off", "moderate", "strict"];

export const Include = Object.freeze({
  Both: "both",
  Pages: "pages",
  Similar: "similar",
});

export const INCLUDE_LABELS = {
  [Include.Both]: "Pages and similar images",
  [Include.Pages]: "Pages that contain the image",
  [Include.Similar]: "Similar images",
};

export const UPLOAD_BLOCKS = JSON.stringify({
  blocks: [{ block: "b-page_type_search-by-image__link" }],
});

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

export const buildHeaders = (context, extra = {}) => ({
  "User-Agent": context?.userAgent?.() ?? FALLBACK_UA,
  "Accept-Language": context?.buildAcceptLanguage?.() ?? "en-US,en;q=0.9",
  Referer: `https://${DOMAIN}/images/`,
  ...extra,
});

const _extension = (mime) =>
  ({ "image/png": "png", "image/webp": "webp" })[mime] ?? "jpg";

const _multipart = (field, filename, mime, bytes) => {
  const boundary = `----degoog${crypto.randomUUID().replaceAll("-", "")}`;
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);
  return { body, type: `multipart/form-data; boundary=${boundary}` };
};

const _safeParams = (params, safe) => {
  if (safe === "strict") params.set("family", "yes");
  if (safe === "off") params.set("adult", "1");
};

export const buildUpload = (host, image, safe) => {
  const { body, type } = _multipart(
    "upfile",
    `image.${_extension(image.mime)}`,
    image.mime,
    image.bytes,
  );
  const params = new URLSearchParams({
    rpt: "imageview",
    format: "json",
    request: UPLOAD_BLOCKS,
  });
  _safeParams(params, safe);
  return { url: `${host}/images/search?${params}`, body, type };
};

export const buildResultsUrl = (host, cbirId, include, query, safe) => {
  const params = new URLSearchParams({
    rpt: "imageview",
    cbir_id: cbirId,
    cbir_page: include === Include.Similar ? "similar" : "sites",
  });
  const text = String(query ?? "").trim().slice(0, 200);
  if (text) params.set("text", text);
  _safeParams(params, safe);
  return `${host}/images/search?${params}`;
};
