import { DOMAINS, Include, INCLUDE_LABELS, SAFE_MODES } from "./request.js";

export const SETTINGS_SCHEMA = [
  {
    key: "privacy",
    label: "Where the image goes",
    type: "info",
    description:
      "This engine uploads every image searched with it to Yandex, a third party, together with any words typed next to it. Yandex sees this server's IP address, not the visitor's, and keeps the image under its own terms.",
  },
  {
    key: "safeSearch",
    label: "Safe Search",
    type: "select",
    options: SAFE_MODES,
    default: "moderate",
    description:
      "Off does not restrict adult results. Moderate keeps Yandex's defaults. Strict uses Yandex family mode.",
  },
  {
    key: "domain",
    label: "Yandex domain",
    type: "select",
    options: DOMAINS,
    default: DOMAINS[0],
    description: "Which Yandex site to use.",
  },
  {
    key: "include",
    label: "Results",
    type: "select",
    options: Object.values(Include),
    optionLabels: Object.values(Include).map((id) => INCLUDE_LABELS[id]),
    default: Include.Both,
    description:
      "Pages that contain the image, images that look like it, or both. Pages come first.",
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
