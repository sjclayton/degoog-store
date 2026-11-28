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
  withListing,
} from './request.js';
import { formatCommunitySnippet, parseAboutJson } from './community.js';
import { parseListing } from './parse.js';

export const type = 'web';
export const description = "Reddit post and community search through Reddit's search JSON results.";
export const site = 'https://www.reddit.com/';

const NAME = 'Reddit';
const NEXT_CACHE_MAX = 200;
const COMMUNITY_TTL_MS = 60 * 60 * 1000;
const COMMUNITY_FAIL_TTL_MS = 10 * 1000;
const COMMUNITY_CACHE_MAX = 200;
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
            icon: String(
              json?.data?.icon_img || json?.data?.community_icon || iconMatch?.[1] || iconMatch?.[2] || '',
            ).replace(/&amp;/g, '&'),
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
    const targets = [...groups];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), COMMUNITY_BUDGET_MS);
    if (context?.signal?.aborted) {
      controller.abort();
    } else if (context?.signal) {
      context.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    try {
      await Promise.allSettled(targets.map(([key]) => this._communityStats(key, context, safe, controller.signal)));
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
    const base = buildUrl(query, timeFilter, { sortBy: this.sortBy, safeSearch: safe });
    let cursors = { link: '', sr: '' };
    for (let hop = 1; hop < page; hop++) {
      cursors = this._next.get(base) ?? (await this._run(base, safe, context, cursors)).next;
      if (!cursors) return [];
    }
    const { results } = await this._run(base, safe, context, cursors);
    return results;
  }

  async _run(base, safe, context, cursors = { link: '', sr: '' }) {
    const doFetch = context?.fetch ?? fetch;
    const headers = {
      ...buildHeaders(context, buildCookies(this.cookies, safe)),
      Accept: 'application/json',
    };
    const settled = await Promise.allSettled(
      ['link', 'sr'].map(async type => {
        const url = withListing(base, type, cursors[type]);
        const response = await doFetch(url, { headers, redirect: 'follow' });
        context?.sentinel?.(response, this.name);
        if (response.status === 404) return { results: [], after: '' };
        const text = await response.text();
        if (isBlocked(response, text)) {
          throw this._blocked(context, `on ${DOMAIN} (HTTP ${response.status})`);
        }
        const json = parseAboutJson(text);
        if (!Array.isArray(json?.data?.children)) {
          throw new Error(`${this.name} changed its results page`);
        }
        return parseListing(json, { name: this.name, nsfw: safe === 'off' });
      }),
    );
    const listings = settled.map(entry => (entry.status === 'fulfilled' ? entry.value : { results: [], after: '' }));
    if (listings.every(entry => entry.results.length === 0)) {
      const failure = settled.find(entry => entry.status === 'rejected');
      if (failure) throw failure.reason;
    }

    const results = [];
    const seen = new Set();
    for (const listing of listings) {
      for (const result of listing.results) {
        if (seen.has(result.url)) continue;
        seen.add(result.url);
        results.push(result);
      }
    }

    await this.enrichCommunities(results, context, safe);

    const next = { link: listings[0]?.after || '', sr: listings[1]?.after || '' };
    if (next.link || next.sr) {
      this._next.delete(base);
      this._next.set(base, next);
      if (this._next.size > NEXT_CACHE_MAX) this._next.delete(this._next.keys().next().value);
    }
    return { results, next: next.link || next.sr ? next : undefined };
  }
}
