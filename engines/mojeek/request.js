export const FALLBACK_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

export const DOMAIN = 'www.mojeek.com';
export const ORIGIN = `https://${DOMAIN}`;
export const SAFE_SEARCH_MODES = ['off', 'moderate', 'strict'];
export const RESULTS_PER_PAGE = 10;
export const MAX_PAGE = 10;

export const CHALLENGE_URL = `${ORIGIN}/captcha/challenge`;
export const VERIFY_URL = `${ORIGIN}/captcha/verify`;

export const BLOCKED_STATUSES = [403, 429];
export const BLOCKED_MARKERS = ['network appears to be sending automated queries', 'automated queries'];

export const isBlocked = (response, html) => {
  if (BLOCKED_STATUSES.includes(response?.status)) return true;
  const lower = String(html ?? '').toLowerCase();
  return BLOCKED_MARKERS.some(marker => lower.includes(marker));
};

export const CAPTCHA_MARKERS = ['captcha-wrap', 'altcha-widget', 'verification required'];

export const isCaptcha = (response, html) => {
  const body = String(html ?? '');
  const lower = body.toLowerCase();
  if (CAPTCHA_MARKERS.some(marker => lower.includes(marker))) return true;
  const title = body.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '';
  return /^captcha$/i.test(title.trim());
};

const pad = value => String(value).padStart(2, '0');
const ymd = date => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;

export const sinceDate = (timeFilter, dateFrom) => {
  if (timeFilter === 'custom') return dateFrom ? dateFrom.replace(/-/g, '') : '';
  if (!['hour', 'day', 'week', 'month', 'year'].includes(timeFilter)) return '';
  const date = new Date();
  if (timeFilter === 'hour' || timeFilter === 'day') date.setDate(date.getDate() - 1);
  else if (timeFilter === 'week') date.setDate(date.getDate() - 7);
  else if (timeFilter === 'month') date.setMonth(date.getMonth() - 1);
  else date.setFullYear(date.getFullYear() - 1);
  return ymd(date);
};

export const buildUrl = (query, page, options = {}) => {
  const { safeSearch = 'moderate', timeFilter, dateFrom } = options;
  const params = new URLSearchParams({
    q: query,
    safe: safeSearch === 'off' ? '0' : '1',
  });
  const pageNumber = Math.max(1, Number(page) || 1);
  if (pageNumber > 1) params.set('s', String(RESULTS_PER_PAGE * (pageNumber - 1) + 1));
  const since = sinceDate(timeFilter, dateFrom);
  if (since) params.set('since', since);
  return `${ORIGIN}/search?${params.toString()}`;
};

export const buildHeaders = (context, cookies = '') => ({
  'User-Agent': context?.userAgent?.() ?? FALLBACK_UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': context?.buildAcceptLanguage?.() ?? 'en-US,en;q=0.9',
  ...(cookies ? { Cookie: cookies } : {}),
});

const HEX = '0123456789abcdef';

const fromHex = hex => {
  const out = new Uint8Array(hex.length / 2);
  for (let index = 0; index < out.length; index++) {
    out[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return out;
};

const toHex = bytes => Array.from(bytes, byte => HEX[byte >> 4] + HEX[byte & 15]).join('');

const startsWith = (bytes, prefix) => {
  if (bytes.length < prefix.length) return false;
  for (let index = 0; index < prefix.length; index++) {
    if (bytes[index] !== prefix[index]) return false;
  }
  return true;
};

const counterBytes = counter => {
  const buffer = new Uint8Array(4);
  new DataView(buffer.buffer).setUint32(0, counter, false);
  return buffer;
};

const concat = (first, second) => {
  const out = new Uint8Array(first.length + second.length);
  out.set(first, 0);
  out.set(second, first.length);
  return out;
};

const derive = async (password, salt, cost, keyLength) => {
  const key = await crypto.subtle.importKey('raw', password, { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: cost, hash: 'SHA-256' },
    key,
    keyLength * 8,
  );
  return new Uint8Array(bits);
};

export const solveAltcha = async (challenge, maxCounters = 200000) => {
  const parameters = challenge?.parameters;
  if (!parameters?.keyPrefix || !parameters?.nonce || !parameters?.salt) return null;
  const nonce = fromHex(parameters.nonce);
  const salt = fromHex(parameters.salt);
  const prefix = fromHex(parameters.keyPrefix);
  const cost = Number(parameters.cost) || 1;
  const keyLength = Number(parameters.keyLength) || 32;
  for (let counter = 0; counter <= maxCounters; counter++) {
    const derivedKey = await derive(concat(nonce, counterBytes(counter)), salt, cost, keyLength);
    if (startsWith(derivedKey, prefix)) {
      return { counter, derivedKey: toHex(derivedKey) };
    }
  }
  return null;
};

const toBase64 = value => (typeof btoa === 'function' ? btoa(value) : Buffer.from(value, 'binary').toString('base64'));

export const buildAltchaPayload = (challenge, solution) =>
  toBase64(
    JSON.stringify({
      challenge: { parameters: challenge.parameters, signature: challenge.signature },
      solution: { counter: solution.counter, derivedKey: solution.derivedKey, time: 150 },
    }),
  );

export const parseChllgCookie = response => {
  const header = response?.headers?.getSetCookie?.() ?? response?.headers?.get?.('set-cookie') ?? '';
  const parts = Array.isArray(header) ? header : [header];
  for (const part of parts) {
    const match = String(part).match(/(?:^|;\s*)chllg=([^;]+)/);
    if (match) return `chllg=${match[1]}`;
  }
  return '';
};
