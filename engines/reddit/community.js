const AGE_RE = /(\d+)\s*(minute|hour|day|week|month|year)s?/i;

export const formatAgeLabel = raw => {
  const text = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
  if (!text) return '';
  const match = text.match(AGE_RE);
  if (!match) return '';
  const value = match[1];
  const unit = match[2].toLowerCase();
  return `${value} ${unit}${value === '1' ? '' : 's'} old`;
};

export const formatMemberCount = value => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return '';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
};

export const parseAboutJson = text => {
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

export const formatCommunitySnippet = result => {
  const community = result?.community ?? {};
  const count = Number.isFinite(result?.memberCount)
    ? `${formatMemberCount(result.memberCount)} members`
    : '';
  return [community.subreddit, count, community.age, community.description]
    .filter(Boolean)
    .join(' · ');
};
