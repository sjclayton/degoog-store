import * as cheerio from 'cheerio';
import { SETTINGS_SCHEMA } from './settings.js';
import {
  buildAltchaPayload,
  buildHeaders,
  buildUrl,
  CHALLENGE_URL,
  DOMAIN,
  isBlocked,
  isCaptcha,
  MAX_PAGE,
  ORIGIN,
  parseChllgCookie,
  SAFE_SEARCH_MODES,
  solveAltcha,
  VERIFY_URL,
} from './request.js';
import { isSearchPage, parseWeb } from './parse.js';

export const type = 'web';
export const description = 'Mojeek web search.';
export const site = 'https://www.mojeek.com/';

const NAME = 'Mojeek';

export default class MojeekEngine {
  isClientExposed = false;
  name = NAME;
  bangShortcut = 'mjk';
  safeSearch = 'moderate';
  cookies = '';
  settingsSchema = SETTINGS_SCHEMA;
  _chllg = '';

  configure(settings) {
    if (SAFE_SEARCH_MODES.includes(settings?.safeSearch)) {
      this.safeSearch = settings.safeSearch;
    }
    if (typeof settings?.cookies === 'string' && settings.cookies !== '__SET__') {
      this.cookies = settings.cookies.trim();
    }
  }

  _cookieHeader() {
    return [this.cookies, this._chllg].filter(Boolean).join('; ');
  }

  _blocked(context, message) {
    return context?.engineError?.('blocked', message, { engine: NAME }) ?? new Error(message);
  }

  _captcha(context, message) {
    return context?.engineError?.('captcha', message, { engine: NAME }) ?? new Error(message);
  }

  async executeSearch(query, page = 1, timeFilter, context) {
    if (page > MAX_PAGE) return [];
    const doFetch = context?.fetch ?? fetch;
    const url = buildUrl(query, page, {
      safeSearch: this.safeSearch,
      timeFilter,
      dateFrom: context?.dateFrom,
    });

    let response = await this._run(doFetch, url, context);
    let html = await response.text();

    if (isCaptcha(response, html)) {
      const solved = await this._solveChallenge(doFetch, context);
      if (!solved) {
        throw this._captcha(
          context,
          `${NAME} is showing its ALTCHA challenge and it could not be solved. Add a chllg cookie or use the fetch transport.`,
        );
      }
      response = await this._run(doFetch, url, context);
      html = await response.text();
    }

    if (isBlocked(response, html)) {
      throw this._blocked(
        context,
        `${NAME} blocked the request (HTTP ${response.status}) as automated queries. Slow down or switch to Camoufox with a chllg cookie.`,
      );
    }

    if (isCaptcha(response, html)) {
      throw this._captcha(context, `${NAME} is still showing its ALTCHA challenge. Add a chllg cookie.`);
    }

    const $ = cheerio.load(html);
    if (!isSearchPage($)) throw new Error(`${NAME} changed its results page`);
    return parseWeb($, DOMAIN, NAME);
  }

  async _run(doFetch, url, context) {
    const response = await doFetch(url, {
      headers: buildHeaders(context, this._cookieHeader()),
      redirect: 'follow',
    });
    context?.sentinel?.(response, this.name);
    return response;
  }

  async _solveChallenge(doFetch, context) {
    try {
      const challengeResponse = await doFetch(CHALLENGE_URL, {
        headers: buildHeaders(context, this._cookieHeader()),
      });
      const challenge = await challengeResponse.json();
      const solution = await solveAltcha(challenge);
      if (!solution) return false;

      const verifyResponse = await doFetch(VERIFY_URL, {
        method: 'POST',
        headers: {
          ...buildHeaders(context, this._cookieHeader()),
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: `${ORIGIN}/search`,
        },
        body: `altcha=${encodeURIComponent(buildAltchaPayload(challenge, solution))}`,
      });
      const result = await verifyResponse.json().catch(() => null);
      if (!result?.ok || !result?.verified) return false;

      const cookie = parseChllgCookie(verifyResponse);
      if (cookie) this._chllg = cookie;
      return true;
    } catch {
      return false;
    }
  }
}
