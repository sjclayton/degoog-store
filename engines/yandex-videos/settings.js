import { DOMAINS, SAFE_MODES } from "./request.js";

export const SETTINGS_SCHEMA = [
  {
    key: "safeSearch",
    label: "Safe Search",
    type: "select",
    options: SAFE_MODES,
    default: "moderate",
    description:
      "Off sends Yandex the adult flag so unrestricted NSFW videos appear unblurred. Moderate keeps Yandex's defaults. Strict uses Yandex family mode.",
  },
  {
    key: "domain",
    label: "Yandex domain",
    type: "select",
    options: DOMAINS,
    default: DOMAINS[0],
    description: "Which Yandex site to search.",
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
      "On a captcha, retry the other Yandex domain and the alternate render before giving up.",
  },
];
