import {
  DOMAINS,
  LANGUAGES,
  REGIONS,
  REGION_LABELS,
  SAFE_SEARCH_MODES,
} from "./request.js";

export const SETTINGS_SCHEMA = [
  {
    key: "outgoingTransport",
    label: "Outgoing HTTP client transport",
    type: "select",
    options: ["curl", "curl-fallback", "fetch"],
    default: "curl",
    description:
      "Yandex blocks Bun's fetch with a verification/SmartCaptcha page, so curl is required.",
  },
  {
    key: "domain",
    label: "Yandex domain",
    type: "select",
    options: DOMAINS,
    default: "yandex.com",
    description: "Which Yandex site to search: yandex.com or ya.ru.",
  },
  {
    key: "safeSearch",
    label: "Safe Search",
    type: "select",
    options: SAFE_SEARCH_MODES,
    default: "moderate",
    description:
      "Off removes filtering, Moderate is Yandex's default, Strict enables family mode.",
  },
  {
    key: "language",
    label: "Result language",
    type: "select",
    options: LANGUAGES,
    default: "en",
    description:
      "Forces Yandex to bias results towards this language. Defaults to English, which is the strongest way to reduce Russian results on ya.ru.",
  },
  {
    key: "region",
    label: "Result region",
    type: "select",
    options: REGIONS,
    optionLabels: REGION_LABELS,
    default: "101",
    description:
      "Yandex 'lr' region. A non-Russian region further reduces Russian results. Germany (Stuttgart) scored best in testing.",
  },
  {
    key: "cookies",
    label: "Yandex cookies (optional)",
    type: "textarea",
    secret: true,
    description:
      "Paste the full Cookie header from yandex.com or ya.ru in your browser (signed in or not). A real browser session lowers the captcha rate. Keep it private.",
  },
  {
    key: "fallbackOnCaptcha",
    label: "Retry after a captcha",
    type: "toggle",
    default: "true",
    description:
      "On a captcha, try the legacy endpoint and then the other Yandex domain before giving up.",
  },
];
