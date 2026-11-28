const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_FAIL_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 200;
const LOOKUP_MAX = 10;
const CACHE_BUDGET_MS = 9000;
const COMMUNITY_URL_RE = /^https?:\/\/(?:www\.|old\.)?reddit\.com\/r\/([^/?#]+)\/?$/i;
const statsCache = new Map();

let maxCommunities = 5;
let template = '';
let fallbackIcon = '';

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

const _fetchStats = async (name, fetchFn, signal) => {
  const key = name.toLowerCase();
  const cached = statsCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.stats;
  let stats = null;
  try {
    const response = await fetchFn(`https://www.reddit.com/r/${encodeURIComponent(name)}/about.json`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'degoog-reddit-community-slot/1.0',
      },
      signal,
    });
    if (response.ok) {
      const json = _parseAbout(await response.text());
      const count = Number(json?.data?.subscribers);
      if (Number.isFinite(count) && count > 0) {
        stats = {
          count: Math.floor(count),
          icon: String(json?.data?.icon_img || json?.data?.community_icon || ''),
          age: _ageLabel(json?.data?.created_utc),
          description: String(json?.data?.public_description || ''),
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
  description:
    "Shows the top Reddit communities by member count from Reddit engine results. Requires sjclayton's Reddit engine to be installed.",

  settingsSchema: [
    {
      key: 'maxCommunities',
      label: 'Top communities count',
      type: 'text',
      default: '5',
      placeholder: '5',
      description: 'Maximum number of community cards to display (1–10).',
    },
  ],

  init(ctx) {
    template = ctx.template;
    fallbackIcon = `/plugins/${ctx.pluginId}/snoo.png`;
  },

  configure(settings) {
    const n = parseInt(settings?.maxCommunities ?? '5', 10);
    maxCommunities = Number.isFinite(n) ? Math.max(1, Math.min(10, n)) : 5;
  },

  trigger() {
    return true;
  },

  async execute(_query, context) {
    const results = Array.isArray(context?.results) ? context.results : [];
    const fetchFn = context?.fetch ?? fetch;
    const seen = new Set();
    const candidates = [];
    let lookups = 0;

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
      } else if (lookups < LOOKUP_MAX) {
        lookups++;
      } else {
        continue;
      }
      candidates.push({ name, key, result, stats });
    }

    const pending = candidates.filter(candidate => !candidate.stats);
    if (pending.length > 0) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CACHE_BUDGET_MS);
      try {
        await Promise.allSettled(
          pending.map(candidate => _fetchStats(candidate.name, fetchFn, controller.signal)),
        );
      } finally {
        clearTimeout(timer);
      }
    }

    const communities = [];
    for (const candidate of candidates) {
      const stats = candidate.stats ?? statsCache.get(candidate.key)?.stats;
      if (!stats || !stats.count) continue;
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
      const meta = [age, count].filter(Boolean).join(' · ');

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
