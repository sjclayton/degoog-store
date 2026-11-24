import { SETTINGS_SCHEMA } from "./settings.js";
import {
  buildHeaders,
  buildSearchUrl,
  DOMAINS,
  isCaptcha,
  resolveSafe,
  SAFE_MODES,
} from "./request.js";
import { parseResults } from "./parse.js";

export const type = "videos";
export const site = "https://yandex.com/";
export const description =
  "Yandex video search. Yandex does not block queries on keywords, so adult searches that other engines answer with zero results still return videos here.";

export const filters = {
  nsfw: ["on", "moderate", "off"],
};

export default class YandexVideosEngine {
  isClientExposed = false;
  name = "Yandex Videos";
  bangShortcut = "yv";
  safeSearch = "moderate";
  domain = DOMAINS[0];
  cookies = "";
  fallbackOnCaptcha = true;
  settingsSchema = SETTINGS_SCHEMA;

  configure(settings) {
    if (DOMAINS.includes(settings?.domain)) this.domain = settings.domain;
    if (SAFE_MODES.includes(settings?.safeSearch)) {
      this.safeSearch = settings.safeSearch;
    }
    if (typeof settings?.cookies === "string" && settings.cookies !== "__SET__") {
      this.cookies = settings.cookies.trim();
    }
    this.fallbackOnCaptcha = settings?.fallbackOnCaptcha !== "false";
  }

  _blocked(context, where) {
    const message = `${this.name} asked for a captcha ${where}`;
    const error =
      context?.engineError?.("captcha", message, { engine: this.name }) ??
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
    const safe = resolveSafe(this.safeSearch, context);
    const doFetch = context?.fetch ?? fetch;
    const response = await doFetch(buildSearchUrl(query, page, safe, domain, legacy), {
      headers: buildHeaders(
        domain,
        context,
        this.cookies ? { Cookie: this.cookies } : {},
      ),
      redirect: "follow",
    });
    context?.sentinel?.(response, this.name);

    const body = await response.text();
    if (isCaptcha(response, body)) throw this._blocked(context, `on ${domain}`);

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      throw new Error(`${this.name} changed its results page`);
    }

    return parseResults(data, this.name, {
      strict: safe === "strict",
    });
  }
}
