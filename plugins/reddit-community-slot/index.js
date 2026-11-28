import { readFileSync } from 'fs';
import { join } from 'path';

const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_FAIL_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 200;
const LOOKUP_MAX = 10;
const CACHE_BUDGET_MS = 5000;
const COMMUNITY_URL_RE = /^https?:\/\/(?:www\.|old\.)?reddit\.com\/r\/([^/?#]+)\/?$/i;
const SEARCH_RESULT_RE =
  /<p class="titlerow"><a href="https?:\/\/(?:www\.|old\.)?reddit\.com\/r\/([A-Za-z0-9_]+)\/",?[^>]*class="title"/gi;
const SEARCH_BUDGET_MS = 12000;
const statsCache = new Map();

const _engineSafeMode = () => {
  try {
    const file =
      process.env.DEGOOG_PLUGIN_SETTINGS_FILE ||
      join(process.env.DEGOOG_DATA_DIR || join(process.cwd(), 'data'), 'plugin-settings.json');
    const store = JSON.parse(readFileSync(file, 'utf8'));
    for (const [id, settings] of Object.entries(store)) {
      if (typeof id !== 'string' || !id.toLowerCase().endsWith('reddit-engine')) continue;
      const value = settings?.safeSearch;
      if (value === 'off' || value === 'moderate' || value === 'strict') return value;
    }
  } catch {}
  return null;
};

let maxCommunities = 5;
let template = '';
let fallbackIcon = '';
let cookies = '';
let source = 'results';
let safeSearchSetting = 'moderate';

const _esc = value => {
  if (typeof value !== 'string') return '';
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

const _formatCount = value => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
};

const _render = data => template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '');

const _parseAbout = text => {
  const raw = typeof text === 'string' ? text.trim() : '';
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {}
  const pre = raw.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  const body = (pre ? pre[1] : raw)
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
  try {
    return JSON.parse(body.trim());
  } catch {}
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
};

const _ageLabel = utc => {
  const value = Number(utc);
  if (!Number.isFinite(value) || value <= 0) return '';
  const days = Math.floor((Date.now() / 1000 - value) / 86400);
  if (days >= 365) {
    const n = Math.floor(days / 365);
    return `${n} year${n === 1 ? '' : 's'} old`;
  }
  if (days >= 30) {
    const n = Math.floor(days / 30);
    return `${n} month${n === 1 ? '' : 's'} old`;
  }
  const n = Math.max(days, 1);
  return `${n} day${n === 1 ? '' : 's'} old`;
};

const _queryNames = query => {
  const names = [];
  const add = value => {
    const name = String(value || '').replace(/[^A-Za-z0-9_]/g, '');
    if (name && !names.some(existing => existing.toLowerCase() === name.toLowerCase())) {
      names.push(name);
    }
  };
  const clean = String(query || '')
    .trim()
    .replace(/^!\S+\s*/, '');
  add(clean.replace(/\s+/g, ''));
  add(clean.replace(/\s+/g, '_'));
  for (const word of clean.split(/\s+/)) add(word);
  return names;
};

const _searchNames = async (query, fetchFn, signal) => {
  const url = `https://old.reddit.com/subreddits/search?q=${encodeURIComponent(query)}&sort=relevance`;
  const response = await fetchFn(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'degoog-reddit-community-slot/1.0',
      ...(cookies.trim() ? { Cookie: cookies.trim() } : {}),
    },
    redirect: 'follow',
    signal,
  });
  if (!response.ok) return [];
  const html = await response.text();
  const names = [];
  SEARCH_RESULT_RE.lastIndex = 0;
  let match;
  while ((match = SEARCH_RESULT_RE.exec(html))) {
    const name = match[1];
    if (!names.some(existing => existing.toLowerCase() === name.toLowerCase())) {
      names.push(name);
    }
  }
  return names;
};

const _fetchStats = async (name, fetchFn, signal, cookieHeader = '') => {
  const key = name.toLowerCase();
  const cached = statsCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.stats;
  let stats = null;
  try {
    const url = `https://www.reddit.com/r/${encodeURIComponent(name)}/about.json`;
    const headers = {
      Accept: 'application/json',
      'User-Agent': 'degoog-reddit-community-slot/1.0',
      ...(cookieHeader.trim() ? { Cookie: cookieHeader.trim() } : {}),
    };
    let response = await fetchFn(url, { headers, redirect: 'manual', signal });
    if (!response.ok) {
      response = await fetchFn(url, { headers, redirect: 'follow', signal });
    }
    if (response.ok) {
      const json = _parseAbout(await response.text());
      const count = Number(json?.data?.subscribers);
      if (Number.isFinite(count) && count > 0) {
        stats = {
          count: Math.floor(count),
          icon: String(json?.data?.icon_img || json?.data?.community_icon || '').replace(/&amp;/g, '&'),
          age: _ageLabel(json?.data?.created_utc),
          description: String(json?.data?.public_description || ''),
          over18: json?.data?.over18 === true,
        };
      }
    }
  } catch {}
  statsCache.set(key, {
    stats,
    expires: Date.now() + (stats ? CACHE_TTL_MS : CACHE_FAIL_TTL_MS),
  });
  if (statsCache.size > CACHE_MAX) statsCache.delete(statsCache.keys().next().value);
  return stats;
};

export const slot = {
  isClientExposed: false,
  id: 'reddit-community-slot',
  name: 'Reddit Communities',
  position: 'above-results',
  waitForResults: true,
  timeoutMs: 20000,
  description:
    "Shows the top Reddit communities by member count from Reddit results. Uses counts from sjclayton's Reddit engine when available, or works standalone when a Reddit cookie is set in its settings.",

  settingsSchema: [
    {
      key: 'maxCommunities',
      label: 'Top communities count',
      type: 'text',
      default: '5',
      placeholder: '5',
      description: 'Maximum number of community cards to display (1–10).',
    },
    {
      key: 'source',
      label: 'Source',
      type: 'select',
      options: ['results', 'direct'],
      optionLabels: ['From results', 'Direct'],
      default: 'results',
      description:
        'From results uses subreddit links in the search results. Direct looks up communities from the query itself, including matches in community descriptions. Direct requires the Reddit cookie.',
    },
    {
      key: 'cookies',
      label: 'Reddit cookies',
      type: 'password',
      secret: true,
      description:
        'Paste a signed-in Reddit cookie. Needed for community links that do not already carry a count, such as links from other engines or searches without the Reddit engine.',
    },
    {
      key: 'safeSearch',
      label: 'Safe search',
      type: 'select',
      options: ['off', 'moderate', 'strict'],
      default: 'moderate',
      description:
        'Used only when the Reddit engine is not installed. With the engine installed, its Safe Search setting controls whether NSFW communities are shown.',
    },
  ],

  init(ctx) {
    template = ctx.template;
    fallbackIcon = `/plugins/${ctx.pluginId}/snoo.png`;
  },

  configure(settings) {
    const n = parseInt(settings?.maxCommunities ?? '5', 10);
    maxCommunities = Number.isFinite(n) ? Math.max(1, Math.min(10, n)) : 5;
    if (typeof settings?.cookies === 'string' && settings.cookies !== '__SET__') {
      cookies = settings.cookies.trim();
    }
    source = settings?.source === 'direct' ? 'direct' : 'results';
    safeSearchSetting =
      settings?.safeSearch === 'off' || settings?.safeSearch === 'strict' ? settings.safeSearch : 'moderate';
  },

  trigger() {
    return true;
  },

  async execute(query, context) {
    const results = Array.isArray(context?.results) ? context.results : [];
    const fetchFn = context?.fetch ?? fetch;
    const seen = new Set();
    const candidates = [];
    const existing = new Map();
    let lookups = 0;

    for (const result of results) {
      const count = Number(result?.memberCount);
      if (Number.isFinite(count) && count > 0) {
        let sub = String(result?.community?.subreddit || '').replace(/^r\//i, '');
        if (!sub) {
          const m = String(result?.url || '').match(COMMUNITY_URL_RE);
          if (m) sub = m[1];
        }
        if (sub) {
          existing.set(sub.toLowerCase(), {
            count: Math.floor(count),
            icon: String(result?.community?.icon || ''),
            age: String(result?.community?.age || ''),
            description: String(result?.community?.description || ''),
          });
        }
      }
    }

    if (source === 'direct') {
      const cleanQuery = String(query || '')
        .trim()
        .replace(/^!\S+\s*/, '');
      const names = [];
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SEARCH_BUDGET_MS);
      try {
        names.push(...(await _searchNames(cleanQuery, fetchFn, controller.signal)));
      } catch {
      } finally {
        clearTimeout(timer);
      }
      names.push(..._queryNames(query));
      for (const name of names) {
        const key = name.toLowerCase();
        if (seen.has(key) || candidates.length >= maxCommunities) continue;
        seen.add(key);
        candidates.push({
          name,
          key,
          result: { url: `https://www.reddit.com/r/${name}` },
          stats: null,
        });
      }
    }

    if (source !== 'direct') {
      for (const result of results) {
        let name = String(result?.community?.subreddit || '').replace(/^r\//i, '');
        if (!name) {
          const match = String(result?.url || '').match(COMMUNITY_URL_RE);
          if (match) name = match[1];
        }
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        let stats = null;
        if (Number.isFinite(result?.memberCount) && result.memberCount > 0) {
          stats = {
            count: Math.floor(result.memberCount),
            icon: String(result?.community?.icon || ''),
            age: String(result?.community?.age || ''),
            description: String(result?.community?.description || ''),
          };
        } else if (existing.has(key)) {
          stats = existing.get(key);
        } else if (lookups < LOOKUP_MAX) {
          lookups++;
        } else {
          continue;
        }
        candidates.push({ name, key, result, stats });
      }
    }

    const pending = candidates.filter(candidate => !candidate.stats);
    if (pending.length > 0) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CACHE_BUDGET_MS);
      try {
        await Promise.allSettled(
          pending.map(candidate => _fetchStats(candidate.name, fetchFn, controller.signal, cookies)),
        );
      } finally {
        clearTimeout(timer);
      }
    }

    const communities = [];
    const mode = _engineSafeMode() ?? safeSearchSetting ?? 'moderate';
    for (const candidate of candidates) {
      const stats = candidate.stats ?? statsCache.get(candidate.key)?.stats;
      if (!stats || !stats.count) continue;
      if (stats.over18 && mode !== 'off') continue;
      communities.push({
        url: candidate.result.url,
        memberCount: stats.count,
        community: {
          subreddit: `r/${candidate.key}`,
          age: stats.age || String(candidate.result?.community?.age || ''),
          description: stats.description || String(candidate.result?.snippet || ''),
          icon: stats.icon,
        },
      });
    }

    if (communities.length === 0) return { title: '', html: '' };
    communities.sort((a, b) => b.memberCount - a.memberCount);

    const cards = communities.slice(0, maxCommunities).map(result => {
      const community = result.community;
      const subreddit = _esc(String(community.subreddit || 'r/unknown'));
      const href = _esc(String(result.url || ''));
      const age = _esc(String(community.age || ''));
      const count = `${_formatCount(result.memberCount)} members`;
      const exact = _esc(`${Number(result.memberCount).toLocaleString('en-US')} members`);
      const description = _esc(String(community.description || ''));
      const iconUrl =
        community.icon && context?.signProxyUrl
          ? _esc(context.signProxyUrl(String(community.icon)))
          : _esc(fallbackIcon);
      const meta = [count, age].filter(Boolean).join(' · ');

      return (
        `<a href="${href}" class="rd-slot-card">` +
        `<div class="rd-slot-head">` +
        `<span class="rd-slot-icon"><img src="${iconUrl}" alt="" class="rd-slot-icon-img" loading="lazy"></span>` +
        `<span class="rd-slot-name">${subreddit}</span>` +
        `</div>` +
        (meta ? `<div class="rd-slot-meta" title="${exact}">${meta}</div>` : '') +
        (description ? `<p class="rd-slot-desc">${description}</p>` : '') +
        `</a>`
      );
    });

    const content =
      `<div class="rd-slot-wrap">` +
      `<h4 class="rd-slot-heading">Top communities by members</h4>` +
      `<div class="rd-slot-grid">${cards.join('')}</div>` +
      `</div>`;
    return { title: 'Reddit Communities', html: _render({ content }) };
  },
};

export default { slot };
