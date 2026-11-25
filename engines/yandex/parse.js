import * as cheerio from 'cheerio';

const absolute = (raw, domain) => {
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/')) return `https://${domain}${value}`;
  if (/^https?:\/\//i.test(value)) return value;
  return undefined;
};

const cleanText = value => (typeof value === 'string' ? cheerio.load(`<span>${value}</span>`).text().trim() : '');

const isYandexUrl = url => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host === 'yandex.com';
  } catch {
    return true;
  }
};

const PLACEHOLDER_TITLE_RE = /^link to\s+[a-z0-9.-]+\.[a-z]{2,}\s*$/i;
const PLACEHOLDER_SNIPPET_RE = /hides the (web )?page description/i;

const isRedditUrl = url => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return /(^|\.)reddit\.com$/i.test(host);
  } catch {
    return false;
  }
};
const SMALL_WORDS = new Set([
  'a',
  'an',
  'and',
  'the',
  'of',
  'in',
  'on',
  'at',
  'to',
  'for',
  'with',
  'by',
  'or',
  'vs',
  'x',
  'per',
]);

const _decode = value => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const prettifySlug = slug => {
  const cleaned = _decode(slug)
    .replace(/\+/g, ' ')
    .replace(/[_\-]+/g, ' ')
    .replace(/[.#?=&%:\/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return cleaned
    .split(' ')
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && SMALL_WORDS.has(lower)) return lower;
      if (word.length > 1 && word === word.toUpperCase()) return word;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
};

const deriveFromRedditUrl = url => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const segments = parsed.pathname.split('/').filter(Boolean).map(_decode);
  const hasR = segments[0]?.toLowerCase() === 'r';
  const sub = hasR ? segments[1] : undefined;
  const isPost = hasR && segments[2]?.toLowerCase() === 'comments';
  if (!hasR && segments[0]?.toLowerCase() === 'domain' && segments[1]) {
    return {
      title: `Reddit links to ${segments[1]}`,
      description: `Reddit posts linking to ${segments[1]}.`,
    };
  }
  if (!sub) return null;
  if (isPost) {
    const prettySlug = segments[4] ? prettifySlug(segments[4]) : '';
    return {
      title: prettySlug || `r/${sub}`,
      description: `Reddit post in r/${sub}.`,
    };
  }
  return {
    title: `r/${sub}`,
    description: `Reddit community for r/${sub}.`,
  };
};

const prettifyReddit = result => {
  const placeholderTitle = PLACEHOLDER_TITLE_RE.test(result.title ?? '');
  const placeholderSnippet = PLACEHOLDER_SNIPPET_RE.test(result.snippet ?? '');
  if ((placeholderTitle || placeholderSnippet) && isRedditUrl(result.url)) {
    const derived = deriveFromRedditUrl(result.url);
    if (derived) {
      if (placeholderTitle && derived.title) result.title = derived.title;
      if ((!result.snippet || placeholderSnippet) && derived.description) {
        result.snippet = derived.description;
      }
    }
    if (result.snippet && PLACEHOLDER_SNIPPET_RE.test(result.snippet)) {
      result.snippet = undefined;
    }
  }
  return result;
};

const buildResult = ($, el, domain, name) => {
  const item = $(el);
  if (item.find(".Label_theme_direct, [data-fast-name='adv']").length > 0) return null;

  const link = item.find('a.OrganicTitle-Link, h2 a').first();
  let title = link.text().trim();
  let url = absolute(link.attr('href'), domain);
  if ((!url || isYandexUrl(url)) && !title) return null;

  if (!url || isYandexUrl(url)) {
    url = absolute(item.find('a.OrganicHost-Link').first().attr('href'), domain);
  }
  if (!url || isYandexUrl(url) || !title) return null;

  let snippet =
    cleanText(item.find(".OrganicTextContent, .OrganicText, [class*='OrganicTextContent']").first().html() ?? '') ||
    undefined;

  return prettifyReddit({
    title,
    url,
    snippet,
    source: name,
    displayUrl: item.find('.Path-Item').first().text().trim() || undefined,
  });
};

export const parseWeb = ($, domain, name) => {
  const results = [];
  const seen = new Set();
  $('li.serp-item[data-cid], div.Organic').each((_, el) => {
    const result = buildResult($, el, domain, name);
    if (!result || seen.has(result.url)) return;
    seen.add(result.url);
    results.push(result);
  });
  return results;
};

export const parseLegacyWeb = ($, domain, name) => {
  const results = [];
  $('li.b-serp-item').each((_, el) => {
    const item = $(el);
    if (item.find('.b-direct, .ad').length > 0) return;
    const link = item.find('a.b-serp-item__title-link').first();
    const title = cleanText(link.text());
    const url = absolute(link.attr('href'), domain);
    if (!title || !url || isYandexUrl(url)) return;
    const snippet = cleanText(item.find('.b-serp-item__text').first().html() ?? '') || undefined;
    results.push(
      prettifyReddit({
        title,
        url,
        snippet,
        source: name,
        displayUrl: item.find('.b-serp-url').first().text().trim() || undefined,
      }),
    );
  });
  return results;
};
