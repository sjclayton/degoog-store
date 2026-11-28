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
import { formatCommunitySnippet, parseAboutJson } from './community.js';
import { isSearchPage, parseNext, parseWeb } from './parse.js';

export const type = 'web';
export const description = 'Reddit post and community search through the old.reddit.com results page.';
export const site = 'https://www.reddit.com/';

const NAME = 'Reddit';
const NEXT_CACHE_MAX = 200;
const COMMUNITY_TTL_MS = 60 * 60 * 1000;
const COMMUNITY_FAIL_TTL_MS = 10 * 1000;
const COMMUNITY_CACHE_MAX = 200;
const COMMUNITY_LOOKUP_MAX = 10;
const COMMUNITY_BUDGET_MS = 25000;
const COMMUNITY_CACHE = new Map();

export default class RedditEngine {
  isClientExposed = false;
  name = NAME;
  bangShortcut = 'r';
  safeSearch = 'moderate';
  sortBy = 'relevance';
  cookies = '';
  communityStats = true;
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
    if (typeof settings?.communityStats !== 'undefined') {
      this.communityStats = settings.communityStats === true || settings.communityStats === 'true';
    }
  }

  async _communityStats(subreddit, context, safe, signal) {
    const name = String(subreddit || '').replace(/^r\//i, '');
    if (!name) return null;
    const key = name.toLowerCase();
    const cached = COMMUNITY_CACHE.get(key);
    if (cached && cached.expires > Date.now()) return cached.stats;
    let stats = null;
    try {
      const doFetch = context?.fetch ?? fetch;
      const url = `https://www.reddit.com/r/${encodeURIComponent(name)}/about.json`;
      const headers = {
        ...buildHeaders(context, buildCookies(this.cookies, safe)),
        Accept: 'application/json',
      };
      let response = await doFetch(url, { headers, redirect: 'manual', signal });
      if (!response.ok) {
        response = await doFetch(url, { headers, redirect: 'follow', signal });
      }
      if (response.ok) {
        const text = await response.text();
        const json = parseAboutJson(text);
        let count = Number(json?.data?.subscribers);
        if (!Number.isFinite(count) || count <= 0) {
          const match = text.match(/&quot;subscribers&quot;\s*:\s*(\d+)|"subscribers"\s*:\s*(\d+)/);
          if (match) count = Number(match[1] || match[2]);
        }
        if (Number.isFinite(count) && count > 0) {
          const iconMatch = text.match(/&quot;icon_img&quot;\s*:\s*&quot;([^&]+?)&quot;|"icon_img"\s*:\s*"([^"]+)"/);
          stats = {
            count: Math.floor(count),
            icon: String(json?.data?.icon_img || json?.data?.community_icon || iconMatch?.[1] || iconMatch?.[2] || ''),
          };
        }
      }
    } catch {}
    COMMUNITY_CACHE.set(key, {
      stats,
      expires: Date.now() + (stats ? COMMUNITY_TTL_MS : COMMUNITY_FAIL_TTL_MS),
    });
    if (COMMUNITY_CACHE.size > COMMUNITY_CACHE_MAX) {
      COMMUNITY_CACHE.delete(COMMUNITY_CACHE.keys().next().value);
    }
    return stats;
  }

  async enrichCommunities(results, context, safe) {
    if (!this.communityStats || !Array.isArray(results)) return;
    const groups = new Map();
    for (const result of results) {
      const subreddit = result?.community?.subreddit;
      if (!subreddit) continue;
      const key = String(subreddit).replace(/^r\//i, '').toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(result);
    }
    const targets = [...groups].slice(0, COMMUNITY_LOOKUP_MAX);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), COMMUNITY_BUDGET_MS);
    if (context?.signal?.aborted) {
      controller.abort();
    } else if (context?.signal) {
      context.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    try {
      await Promise.allSettled(
        targets.map(([key]) => this._communityStats(key, context, safe, controller.signal)),
      );
    } finally {
      clearTimeout(timer);
    }
    for (const [key, items] of targets) {
      const stats = COMMUNITY_CACHE.get(key)?.stats;
      if (!stats) continue;
      for (const result of items) {
        result.memberCount = stats.count;
        result.community.icon = stats.icon;
        result.snippet = formatCommunitySnippet(result);
      }
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

    await this.enrichCommunities(results, context, safe);

    const next = parseNext($, DOMAIN);
    if (next) {
      this._next.delete(url);
      this._next.set(url, next);
      if (this._next.size > NEXT_CACHE_MAX) this._next.delete(this._next.keys().next().value);
    }
    return { results, next };
  }
}
