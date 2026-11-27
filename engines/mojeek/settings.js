import { SAFE_SEARCH_MODES } from './request.js';

export const SETTINGS_SCHEMA = [
  {
    key: 'outgoingTransport',
    label: 'Outgoing HTTP client transport',
    type: 'select',
    options: ['fetch', 'curl', 'curl-fallback', 'camoufox'],
    default: 'curl-fallback',
    description:
      'Mojeek guards searches with an ALTCHA proof-of-work. fetch and curl let the engine solve it automatically. Camoufox gets past the automated-query rate limit more often, but needs a chllg cookie set because it cannot submit the challenge POST.',
  },
  {
    key: 'safeSearch',
    label: 'Safe Search',
    type: 'select',
    options: SAFE_SEARCH_MODES,
    default: 'moderate',
    description:
      "Off sends safe=0 and includes adult results. Moderate and Strict send safe=1, which is Mojeek's own filter.",
  },
  {
    key: 'cookies',
    label: 'Mojeek cookies (optional)',
    type: 'password',
    secret: true,
    description:
      'Paste the chllg cookie from a browser that has passed the Mojeek challenge. It lasts about 30 days and skips the challenge, which the Camoufox transport needs. Keep it private.',
  },
];
