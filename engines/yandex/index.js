import * as cheerio from "cheerio";
import { SETTINGS_SCHEMA } from "./settings.js";
import {
  buildHeaders,
  buildUrl,
  DOMAIN,
  isCaptcha,
  SAFE_SEARCH_MODES,
} from "./request.js";
import { parseLegacyWeb, parseWeb } from "./parse.js";

export const type = "web";
export const description = "Yandex web search.";
export const site = "https://yandex.com/";

const NAME = "Yandex";

export default class YandexEngine {
  isClientExposed = false;
  name = NAME;
  bangShortcut = "y";
  safeSearch = "moderate";
  cookies = "";
  settingsSchema = SETTINGS_SCHEMA;

  configure(settings) {
    if (SAFE_SEARCH_MODES.includes(settings?.safeSearch)) {
      this.safeSearch = settings.safeSearch;
    }
    if (typeof settings?.cookies === "string" && settings.cookies !== "__SET__") {
      this.cookies = settings.cookies.trim();
    }
  }

  _blocked(context, where) {
    const message = `${NAME} asked for a captcha ${where}`;
    const error =
      context?.engineError?.("captcha", message, { engine: NAME }) ??
      new Error(message);
    return Object.assign(error, { __yandexCaptcha: true });
  }

  async executeSearch(query, page = 1, timeFilter, context) {
    for (const legacy of [false, true]) {
      try {
        return await this._run(query, page, timeFilter, context, legacy);
      } catch (error) {
        if (!error?.__yandexCaptcha) throw error;
      }
    }
    throw this._blocked(context, `on ${DOMAIN}`);
  }

  async _run(query, page, timeFilter, context, legacy) {
    const doFetch = context?.fetch ?? fetch;
    const response = await doFetch(
      buildUrl(query, page, timeFilter, {
        legacy,
        safeSearch: this.safeSearch,
      }),
      {
        headers: buildHeaders(context, this.cookies),
        redirect: "follow",
      },
    );
    context?.sentinel?.(response, this.name);

    const html = await response.text();
    if (isCaptcha(response, html)) {
      throw this._blocked(context, `on ${DOMAIN}`);
    }

    const $ = cheerio.load(html);
    return legacy
      ? parseLegacyWeb($, DOMAIN, this.name)
      : parseWeb($, DOMAIN, this.name);
  }
}
