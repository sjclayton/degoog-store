const SNIPPET_MAX = 280;

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

const buildResult = ($, el, domain, name) => {
  const item = $(el);
  if (item.hasClass('ad')) return null;

  const link = item.find('h2 a.title').first();
  const title = cleanText(link.text());
  const url = absolute(link.attr('href'), domain) ?? absolute(item.find('a.ob').first().attr('href'), domain);
  if (!title || !url) return null;

  const snippet = truncate(cleanText(item.find('p.s').first().text()), SNIPPET_MAX) || undefined;
  const displayUrl = cleanText(item.find('span.url').first().text()) || undefined;

  return { title, url, snippet, source: name, displayUrl };
};

export const parseWeb = ($, domain, name) => {
  const results = [];
  const seen = new Set();
  $('ul.results-standard > li').each((_, el) => {
    const result = buildResult($, el, domain, name);
    if (!result || seen.has(result.url)) return;
    seen.add(result.url);
    results.push(result);
  });
  return results;
};

export const isSearchPage = $ => $('ul.results-standard, form[action="/search"], .pagination').length > 0;
