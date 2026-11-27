export const FALLBACK_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

export const DOMAIN = 'old.reddit.com';
export const SAFE_MODES = ['off', 'moderate', 'strict'];
export const SORT_MODES = ['relevance', 'hot', 'top', 'new', 'comments'];
export const MAX_PAGE = 5;
export const WITHIN = {
  hour: 'hour',
  day: 'day',
  week: 'week',
  month: 'month',
  year: 'year',
};

export const BLOCKED_STATUSES = [403, 429, 503];
export const BLOCKED_MARKERS = [
  'whoa there, pardner',
  'blocked by network security',
  'log in or sign up to personalize your feed',
];

export const isBlocked = (response, html) => {
  if (BLOCKED_STATUSES.includes(response?.status)) return true;
  const lower = String(html ?? '').toLowerCase();
  return BLOCKED_MARKERS.some(marker => lower.includes(marker));
};

export const resolveSafe = (engineSafe, context) => {
  const nsfw = context?.imageFilter?.nsfw;
  if (nsfw === 'on') return 'strict';
  if (nsfw === 'moderate') return 'moderate';
  if (nsfw === 'off') return 'off';
  return SAFE_MODES.includes(engineSafe) ? engineSafe : 'moderate';
};

const SUBREDDIT_RE = /(?:^|\s)\/?r\/([A-Za-z0-9_]{2,21})(?=\s|$)/;
const SITE_OPERATOR_RE = /(?:^|\s)site:(?:https?:\/\/)?(?:www\.|old\.)?reddit\.com\/?(?=\s|$)/gi;

export const splitSubredditQuery = query => {
  const stripped = query.replace(SITE_OPERATOR_RE, ' ').replace(/\s+/g, ' ').trim() || query;
  const match = stripped.match(SUBREDDIT_RE);
  if (!match) return { text: stripped, subreddit: undefined };
  const text = `${stripped.slice(0, match.index)} ${stripped.slice(match.index + match[0].length)}`
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return { text: stripped, subreddit: undefined };
  return { text, subreddit: match[1] };
};

export const buildUrl = (query, timeFilter, opts) => {
  const { sortBy = 'relevance', safeSearch = 'moderate' } = opts;

  const { text, subreddit } = splitSubredditQuery(query);

  const params = new URLSearchParams({
    q: text,
    sort: SORT_MODES.includes(sortBy) ? sortBy : 'relevance',
    t: WITHIN[timeFilter] ?? 'all',
  });
  if (subreddit) params.set('restrict_sr', 'on');
  if (safeSearch === 'off') params.set('include_over_18', 'on');

  const path = subreddit ? `/r/${encodeURIComponent(subreddit)}/search` : '/search';
  return `https://${DOMAIN}${path}?${params.toString()}`;
};

export const buildCookies = (cookies = '', safeSearch = 'moderate') => {
  const base = cookies.trim().replace(/;\s*$/, '');
  if (safeSearch !== 'off' || /(?:^|;\s*)over18=/i.test(base)) return base;
  return base ? `${base}; over18=1` : 'over18=1';
};

export const buildHeaders = (context, cookies = '') => ({
  'User-Agent': context?.userAgent?.() ?? FALLBACK_UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': context?.buildAcceptLanguage?.() ?? 'en-US,en;q=0.9',
  ...(cookies ? { Cookie: cookies } : {}),
});
