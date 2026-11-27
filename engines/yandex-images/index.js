import { SETTINGS_SCHEMA } from './settings.js';
import { buildHeaders, buildSearchUrl, DOMAIN, isCaptcha, resolveSafe, SAFE_MODES } from './request.js';
import { initialState, parseResults } from './parse.js';

export const type = 'images';
export const site = 'https://yandex.com/';
export const description =
  'Yandex image search. Yandex does not block queries on keywords, so NSFW searches that Google, Bing, DuckDuckGo and Brave answer with zero results still return images here.';

export const filters = {
  size: ['small', 'medium', 'large'],
  type: ['photo', 'clipart'],
  layout: ['square', 'wide', 'tall'],
  nsfw: ['on', 'moderate', 'off'],
};

export default class YandexImagesEngine {
  isClientExposed = false;
  name = 'Yandex Images';
  bangShortcut = 'yi';
  safeSearch = 'moderate';
  cookies = '';
  settingsSchema = SETTINGS_SCHEMA;

  configure(settings) {
    if (SAFE_MODES.includes(settings?.safeSearch)) {
      this.safeSearch = settings.safeSearch;
    }
    if (typeof settings?.cookies === 'string' && settings.cookies !== '__SET__') {
      this.cookies = settings.cookies.trim();
    }
  }

  _blocked(context, where) {
    const message = `${this.name} asked for a captcha ${where}`;
    const error = context?.engineError?.('captcha', message, { engine: this.name }) ?? new Error(message);
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
    const safe = resolveSafe(this.safeSearch, context);
    const doFetch = context?.fetch ?? fetch;
    const response = await doFetch(buildSearchUrl(query, page, safe, context?.imageFilter, legacy), {
      headers: buildHeaders(context, this.cookies ? { Cookie: this.cookies } : {}),
      redirect: 'follow',
    });
    context?.sentinel?.(response, this.name);

    const html = await response.text();
    if (isCaptcha(response, html)) throw this._blocked(context, `on ${DOMAIN}`);

    const state = initialState(html);
    if (!state) throw new Error(`${this.name} changed its results page`);

    return parseResults(state, this.name, {
      unblur: safe === 'off',
      strict: safe === 'strict',
    });
  }
}
