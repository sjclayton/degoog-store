const SNIPPET_MAX = 260;
const NSFW_SELECTOR = ".nsfw-stamp, .search-result-icon-NSFW, [class*='NSFW']";
const SEARCH_PAGE_SELECTOR = '#search, form#search, .search-summary, .searchpage, body.search-page';

const absolute = (raw, domain) => {
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/')) return `https://${domain}${value}`;
  if (/^https?:\/\//i.test(value)) return value;
  return undefined;
};

const cleanText = value => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');

const truncate = (value, max) => {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30)).trimEnd()}…`;
};

const isRedditUrl = url => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return /(^|\.)reddit\.com$/i.test(host);
  } catch {
    return false;
  }
};

const hostOf = url => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const withPrefix = (value, prefix) => {
  const text = cleanText(value);
  if (!text) return '';
  return text.toLowerCase().startsWith(prefix) ? text : `${prefix}${text.replace(/^\/?/, '')}`;
};

const subredditOf = url => {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    return segments[0]?.toLowerCase() === 'r' && segments[1] ? `r/${segments[1]}` : '';
  } catch {
    return '';
  }
};

const isUserUrl = url => {
  try {
    const first = new URL(url).pathname.split('/').filter(Boolean)[0]?.toLowerCase();
    return first === 'user' || first === 'u';
  } catch {
    return false;
  }
};

const toWww = url => {
  const parsed = new URL(url);
  parsed.hostname = 'www.reddit.com';
  return parsed.toString();
};

const buildResult = ($, el, domain, name, nsfw) => {
  const item = $(el);

  const flagged = item.find(NSFW_SELECTOR).length > 0;
  if (flagged && !nsfw) return null;

  const link = item.find('a.search-title').first();
  const title = cleanText(link.text());
  const linkUrl = absolute(link.attr('href'), domain);
  const commentsUrl = absolute(item.find('a.search-comments').first().attr('href'), domain);
  const external = linkUrl && !isRedditUrl(linkUrl) ? linkUrl : undefined;

  const threadUrl = commentsUrl ?? (linkUrl && !external ? linkUrl : undefined);
  if (!title || !threadUrl || !isRedditUrl(threadUrl)) return null;

  const subreddit = withPrefix(item.find('a.search-subreddit-link').first().text(), 'r/') || subredditOf(threadUrl);
  const meta = [
    subreddit,
    withPrefix(item.find('.search-author a.author, a.author').first().text(), 'u/'),
    cleanText(item.find('.search-score').first().text()),
    cleanText(item.find('a.search-comments').first().text()),
    cleanText(item.find('.search-time time').first().text()),
    flagged ? 'NSFW' : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const body = truncate(cleanText(item.find('.search-result-body, .search-expando .md').first().text()), SNIPPET_MAX);
  const snippet = [meta, body || (external ? `Link to ${hostOf(external)}` : '')].filter(Boolean).join(' — ');

  return {
    title,
    url: toWww(threadUrl),
    snippet: snippet || undefined,
    source: name,
    displayUrl: subreddit ? `reddit.com/${subreddit}` : 'reddit.com',
  };
};

const buildCommunityResult = ($, el, domain, name, nsfw) => {
  const item = $(el);

  const flagged = item.find(NSFW_SELECTOR).length > 0;
  if (flagged && !nsfw) return null;

  const link = item.find('header.search-result-header a.search-title, a.search-title').first();
  const linkUrl = absolute(link.attr('href'), domain);
  if (!linkUrl || !isRedditUrl(linkUrl) || isUserUrl(linkUrl)) return null;

  const subreddit = withPrefix(item.find('a.search-subreddit-link').first().text(), 'r/') || subredditOf(linkUrl);
  if (!subreddit) return null;

  const title = cleanText(link.text()) || subreddit;
  const age = cleanText(item.find('.search-time').first().text());
  const meta = [subreddit, age].filter(Boolean).join(' · ');
  const body = truncate(cleanText(item.find('.search-result-body').first().text()), SNIPPET_MAX);
  const snippet = [meta, body].filter(Boolean).join(' — ');

  return {
    title,
    url: toWww(linkUrl),
    snippet: snippet || undefined,
    source: name,
    displayUrl: subreddit ? `reddit.com/${subreddit}` : 'reddit.com',
  };
};

export const parseWeb = ($, domain, name, options = {}) => {
  const { nsfw = false } = options;
  const results = [];
  const seen = new Set();
  $('div.search-result-link').each((_, el) => {
    const result = buildResult($, el, domain, name, nsfw);
    if (!result || seen.has(result.url)) return;
    seen.add(result.url);
    results.push(result);
  });
  $('div.search-result-subreddit').each((_, el) => {
    const result = buildCommunityResult($, el, domain, name, nsfw);
    if (!result || seen.has(result.url)) return;
    seen.add(result.url);
    results.push(result);
  });
  return results;
};

export const parseNext = ($, domain) => {
  const href = $('span.next-button a, .nav-buttons .next-button a, a[rel~="next"]').first().attr('href');
  const next = absolute(href, domain);
  if (!next || !isRedditUrl(next)) return undefined;
  const parsed = new URL(next);
  parsed.protocol = 'https:';
  parsed.hostname = domain;
  return parsed.toString();
};

export const isSearchPage = $ => $(SEARCH_PAGE_SELECTOR).length > 0;
