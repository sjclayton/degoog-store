import { SETTINGS_SCHEMA } from "./settings.js";
import {
  buildHeaders,
  buildResultsUrl,
  buildUpload,
  DOMAIN,
  Include,
  isCaptcha,
  resolveSafe,
  SAFE_MODES,
} from "./request.js";
import { initialState, parseCbirId, parseResults } from "./parse.js";

export const type = "images";
export const input = "image";
export const site = "https://yandex.com/";
export const description =
  "Yandex reverse image search. Upload an image or use the image tab to find pages containing it and similar images. Adult results are not blocked when safe search is off.";

export const filters = {
  size: ["small", "medium", "large"],
  type: ["photo", "clipart"],
  layout: ["square", "wide", "tall"],
  nsfw: ["on", "moderate", "off"],
};

export default class YandexVisualEngine {
  isClientExposed = false;
  name = "Yandex Visual Search";
  safeSearch = "moderate";
  include = Include.Both;
  cookies = "";
  settingsSchema = SETTINGS_SCHEMA;

  configure(settings) {
    if (SAFE_MODES.includes(settings?.safeSearch)) {
      this.safeSearch = settings.safeSearch;
    }
    if (Object.values(Include).includes(settings?.include)) {
      this.include = settings.include;
    }
    if (typeof settings?.cookies === "string" && settings.cookies !== "__SET__") {
      this.cookies = settings.cookies.trim();
    }
  }

  _blocked(context, where) {
    const message = `${this.name} asked for a captcha ${where}`;
    const error =
      context?.engineError?.("captcha", message, { engine: this.name }) ??
      new Error(message);
    return Object.assign(error, { __yandexCaptcha: true });
  }

  async executeSearch(query, page = 1, _timeFilter, context) {
    const image = context?.image;
    if (!image || page > 1) return [];
    return this._run(query, context);
  }

  async _run(query, context) {
    const safe = resolveSafe(this.safeSearch, context);
    const doFetch = context?.fetch ?? fetch;
    const host = `https://${DOMAIN}`;
    const headers = buildHeaders(
      context,
      this.cookies ? { Cookie: this.cookies } : {},
    );

    const upload = buildUpload(host, context.image, safe);
    const uploadRes = await doFetch(upload.url, {
      method: "POST",
      headers: { ...headers, Accept: "application/json", "Content-Type": upload.type },
      body: upload.body,
    });
    context?.sentinel?.(uploadRes, this.name);
    const uploadText = await uploadRes.text();
    if (isCaptcha(uploadRes, uploadText))
      throw this._blocked(context, "on upload");

    const cbirId = parseCbirId(uploadText);
    if (!cbirId) throw new Error(`${this.name} didn't accept the image`);

    const resultsUrl = buildResultsUrl(
      host,
      cbirId,
      this.include,
      query,
      safe,
    );
    const resultsRes = await doFetch(resultsUrl, {
      headers: {
        ...headers,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });
    context?.sentinel?.(resultsRes, this.name);
    const html = await resultsRes.text();
    if (isCaptcha(resultsRes, html))
      throw this._blocked(context, "on the results page");

    const state = initialState(html);
    if (!state) throw new Error(`${this.name} changed its results page`);

    return parseResults(state, host, this.include);
  }
}
