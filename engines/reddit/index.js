import * as cheerio from 'cheerio';
import { SETTINGS_SCHEMA } from './settings.js';
import {
  buildCookies,
  buildHeaders,
  buildUrl,
  DOMAIN,
  isBlocked,
  MAX_PAGE,
  resolveSafe,
  SAFE_MODES,
  SORT_MODES,
} from './request.js';
import { isSearchPage, parseNext, parseWeb } from './parse.js';

export const type = 'web';
export const description = 'Reddit post and community search through the old.reddit.com results page.';
export const site = 'https://www.reddit.com/';

const NAME = 'Reddit';
const NEXT_CACHE_MAX = 200;

export default class RedditEngine {
  isClientExposed = false;
  name = NAME;
  bangShortcut = 'r';
  safeSearch = 'moderate';
  sortBy = 'relevance';
  cookies = '';
  settingsSchema = SETTINGS_SCHEMA;
  _next = new Map();

  configure(settings) {
    if (SAFE_MODES.includes(settings?.safeSearch)) {
      this.safeSearch = settings.safeSearch;
    }
    if (SORT_MODES.includes(settings?.sortBy)) {
      this.sortBy = settings.sortBy;
    }
    if (typeof settings?.cookies === 'string' && settings.cookies !== '__SET__') {
      this.cookies = settings.cookies.trim();
    }
  }

  _blocked(context, where) {
    const message = `${NAME} was blocked ${where}`;
    return context?.engineError?.('blocked', message, { engine: NAME }) ?? new Error(message);
  }

  async executeSearch(query, page = 1, timeFilter, context) {
    if (page > MAX_PAGE) return [];
    const safe = resolveSafe(this.safeSearch, context);
    let url = buildUrl(query, timeFilter, { sortBy: this.sortBy, safeSearch: safe });
    for (let hop = 1; hop < page; hop++) {
      const next = this._next.get(url) ?? (await this._run(url, safe, context)).next;
      if (!next) return [];
      url = next;
    }
    const { results } = await this._run(url, safe, context);
    return results;
  }

  async _run(url, safe, context) {
    const doFetch = context?.fetch ?? fetch;
    const response = await doFetch(url, {
      headers: buildHeaders(context, buildCookies(this.cookies, safe)),
      redirect: 'follow',
    });
    context?.sentinel?.(response, this.name);

    if (response.status === 404) return { results: [], next: undefined };

    const html = await response.text();
    if (isBlocked(response, html)) {
      throw this._blocked(context, `on ${DOMAIN} (HTTP ${response.status})`);
    }

    const $ = cheerio.load(html);
    const results = parseWeb($, DOMAIN, this.name, { nsfw: safe === 'off' });
    if (results.length === 0 && !isSearchPage($)) throw new Error(`${this.name} changed its results page`);

    const next = parseNext($, DOMAIN);
    if (next) {
      this._next.delete(url);
      this._next.set(url, next);
      if (this._next.size > NEXT_CACHE_MAX) this._next.delete(this._next.keys().next().value);
    }
    return { results, next };
  }
}
