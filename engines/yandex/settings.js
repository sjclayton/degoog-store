import { SAFE_SEARCH_MODES } from './request.js';

export const SETTINGS_SCHEMA = [
  {
    key: 'outgoingTransport',
    label: 'Outgoing HTTP client transport',
    type: 'select',
    options: ['curl', 'curl-fallback', 'fetch'],
    default: 'curl',
    description: "Yandex blocks Bun's fetch with a verification/SmartCaptcha page, so curl is required.",
  },
  {
    key: 'safeSearch',
    label: 'Safe Search',
    type: 'select',
    options: SAFE_SEARCH_MODES,
    default: 'moderate',
    description: "Off removes filtering, Moderate is Yandex's default, Strict enables family mode.",
  },
  {
    key: 'cookies',
    label: 'Yandex cookies (optional)',
    type: 'password',
    secret: true,
    description:
      'Paste the full Cookie header from yandex.com in your browser (signed in or not). A real browser session lowers the captcha rate. Keep it private.',
  },
];
