import { formatAgeLabel, formatCommunitySnippet, formatMemberCount } from './community.js';

const SNIPPET_MAX = 260;

const cleanText = value => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');

const truncate = (value, max) => {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30)).trimEnd()}…`;
};

const decoded = value =>
  cleanText(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const hostOf = url => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const isRedditUrl = url => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return /(^|\.)reddit\.com$/i.test(host);
  } catch {
    return false;
  }
};

const ageFromUtc = utc => {
  const value = Number(utc);
  if (!Number.isFinite(value) || value <= 0) return '';
  const days = Math.floor((Date.now() - value * 1000) / 86400000);
  if (days >= 365) return formatAgeLabel(`${Math.floor(days / 365)} year`);
  if (days >= 30) return formatAgeLabel(`${Math.floor(days / 30)} month`);
  return formatAgeLabel(`${Math.max(days, 1)} day`);
};

const agoFromUtc = utc => {
  const value = Number(utc);
  if (!Number.isFinite(value) || value <= 0) return '';
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - value));
  if (seconds < 3600)
    return `${Math.max(1, Math.floor(seconds / 60))} minute${Math.floor(seconds / 60) === 1 ? '' : 's'} ago`;
  if (seconds < 86400) {
    const n = Math.floor(seconds / 3600);
    return `${n} hour${n === 1 ? '' : 's'} ago`;
  }
  const n = Math.floor(seconds / 86400);
  return `${n} day${n === 1 ? '' : 's'} ago`;
};

const buildPost = (data, name, nsfw) => {
  const permalink = cleanText(data.permalink);
  if (!permalink.startsWith('/r/') || !permalink.includes('/comments/')) return null;
  const flagged = data.over_18 === true;
  if (flagged && !nsfw) return null;
  const title = cleanText(data.title);
  if (!title) return null;
  const subreddit = cleanText(data.subreddit) ? `r/${cleanText(data.subreddit)}` : '';
  const author = cleanText(data.author) && data.author !== '[deleted]' ? `u/${cleanText(data.author)}` : '';
  const points = formatMemberCount(data.score);
  const score = points ? `${points.toLowerCase()} points` : '';
  const comments = Number.isFinite(Number(data.num_comments)) ? `${data.num_comments} comments` : '';
  const meta = [subreddit, author, score, comments, agoFromUtc(data.created_utc), flagged ? 'NSFW' : '']
    .filter(Boolean)
    .join(' · ');
  const body = truncate(cleanText(data.selftext), SNIPPET_MAX);
  const external = cleanText(data.url) && !isRedditUrl(data.url) ? cleanText(data.url) : '';
  const snippet = [meta, body || (external ? `Link to ${hostOf(external)}` : '')].filter(Boolean).join(' — ');
  return {
    title,
    url: `https://www.reddit.com${permalink}`,
    snippet: snippet || undefined,
    source: name,
    displayUrl: subreddit ? `reddit.com/${subreddit}` : 'reddit.com',
  };
};

const buildCommunity = (data, name, nsfw) => {
  if (data.over18 === true && !nsfw) return null;
  const display = cleanText(data.display_name);
  if (!display) return null;
  const subreddit = `r/${display}`;
  const description = truncate(cleanText(data.public_description), SNIPPET_MAX);
  const result = {
    title: cleanText(data.display_name_prefixed) || subreddit,
    url: `https://www.reddit.com/r/${display}/`,
    source: name,
    displayUrl: `reddit.com/${subreddit}`,
    community: {
      subreddit,
      age: ageFromUtc(data.created_utc),
      description,
      icon: decoded(data.icon_img || data.community_icon || ''),
    },
  };
  result.snippet = formatCommunitySnippet(result) || undefined;
  return result;
};

export const parseListing = (json, { name, nsfw = false } = {}) => {
  const children = Array.isArray(json?.data?.children) ? json.data.children : [];
  const results = [];
  const seen = new Set();
  for (const child of children) {
    const data = child?.data;
    if (!data) continue;
    const result =
      child.kind === 't5' ? buildCommunity(data, name, nsfw) : child.kind === 't3' ? buildPost(data, name, nsfw) : null;
    if (!result || seen.has(result.url)) continue;
    seen.add(result.url);
    results.push(result);
  }
  return { results, after: cleanText(json?.data?.after) };
};
