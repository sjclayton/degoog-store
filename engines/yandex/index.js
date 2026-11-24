import * as cheerio from "cheerio";
import { SETTINGS_SCHEMA } from "./settings.js";
import {
  buildHeaders,
  buildUrl,
  DOMAINS,
  isCaptcha,
  LANGUAGES,
  REGIONS,
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

  _blocked(context, where) {
    const message = `${NAME} asked for a captcha ${where}`;
    const error =
      context?.engineError?.("captcha", message, { engine: NAME }) ??
      new Error(message);
    return Object.assign(error, { __yandexCaptcha: true });
  }

  async executeSearch(query, page = 1, timeFilter, context) {
    const alternate = DOMAINS.find((candidate) => candidate !== this.domain);
    const attempts = [{ domain: this.domain, legacy: false }];
    if (this.fallbackOnCaptcha && alternate) {
      attempts.push({ domain: alternate, legacy: false });
    }
    attempts.push({ domain: this.domain, legacy: true });
    if (this.fallbackOnCaptcha && alternate) {
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
      buildUrl(query, page, timeFilter, {
        domain,
        legacy,
        language: this.language,
        region: this.region,
        safeSearch: this.safeSearch,
        contextLang: context?.lang,
      }),
      {
        headers: buildHeaders(context, this.cookies),
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
