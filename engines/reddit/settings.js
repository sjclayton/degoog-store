import { SAFE_MODES, SORT_MODES } from './request.js';

export const SETTINGS_SCHEMA = [
  {
    key: 'outgoingTransport',
    label: 'Outgoing HTTP client transport',
    type: 'select',
    options: ['curl', 'curl-fallback', 'fetch'],
    default: 'curl',
    description: 'Reddit blocks most server IPs and plain HTTP clients. Camoufox gets through far more often.',
  },
  {
    key: 'safeSearch',
    label: 'Safe Search',
    type: 'select',
    options: SAFE_MODES,
    default: 'moderate',
    description:
      'Off includes NSFW posts and sends the over18 cookie. Moderate and Strict hide NSFW posts and communities, which is what Reddit does by default.',
  },
  {
    key: 'sortBy',
    label: 'Sort By',
    type: 'select',
    options: SORT_MODES,
    default: 'relevance',
    description: 'How Reddit sorts the results.',
  },
  {
    key: 'cookies',
    label: 'Reddit cookies (required)',
    type: 'password',
    secret: true,
    description:
      'Reddit only serves old.reddit.com to logged-in accounts. Paste the full Cookie header from a signed-in old.reddit.com browser session. reddit_session carries the login; token_v2 and the other cookies are optional. The account must have used Old Reddit in the last six months unless it moderates a subreddit. Keep it private.',
  },
  {
    key: 'communityStats',
    label: 'Community member counts',
    type: 'toggle',
    default: 'true',
    description:
      'Look up member counts and icons for community results. Adds one short-lived cached request per community; turn off if Reddit rate-limits the instance.',
  },
];
