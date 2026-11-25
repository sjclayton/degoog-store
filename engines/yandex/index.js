import * as cheerio from "cheerio";
import { SETTINGS_SCHEMA } from "./settings.js";
import {
  buildHeaders,
  buildUrl,
  DOMAIN,
  isCaptcha,
  SAFE_SEARCH_MODES,
  splitSiteQuery,
} from "./request.js";
import { parseLegacyWeb, parseWeb } from "./parse.js";

export const type = "web";
export const description = "Yandex web search.";
export const site = "https://yandex.com/";

const NAME = "Yandex";
const CAPTCHA_RETRY_DELAY_MS = 1500;

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
    const hasSite = Boolean(splitSiteQuery(query).site);
    const attempts = [
      { legacy: false, siteParam: false, tries: 2 },
      ...(hasSite ? [{ legacy: false, siteParam: true, tries: 1 }] : []),
      { legacy: true, siteParam: false, tries: 1 },
    ];
    let empty = null;
    for (const attempt of attempts) {
      for (let tryIndex = 0; tryIndex < attempt.tries; tryIndex++) {
        try {
          const results = await this._run(query, page, timeFilter, context, attempt);
          if (results.length > 0) return results;
          empty = results;
          break;
        } catch (error) {
          if (!error?.__yandexCaptcha) throw error;
          if (tryIndex + 1 < attempt.tries) {
            await new Promise((resolve) => setTimeout(resolve, CAPTCHA_RETRY_DELAY_MS));
          }
        }
      }
    }
    if (empty) return empty;
    throw this._blocked(context, `on ${DOMAIN}`);
  }

  async _run(query, page, timeFilter, context, opts) {
    const doFetch = context?.fetch ?? fetch;
    const response = await doFetch(
      buildUrl(query, page, timeFilter, { ...opts, safeSearch: this.safeSearch }),
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
    return opts.legacy
      ? parseLegacyWeb($, DOMAIN, this.name)
      : parseWeb($, DOMAIN, this.name);
  }
}
