export const SETTINGS_SCHEMA = [
  {
    key: "outgoingTransport",
    label: "Outgoing HTTP client transport",
    type: "select",
    options: ["curl", "curl-fallback", "fetch"],
    default: "curl-fallback",
    description:
      "curl-fallback tries fetch first and retries with curl when Yandex blocks or rate-limits it.",
  },
  {
    key: "safeSearch",
    label: "Safe Search",
    type: "select",
    options: ["off", "moderate", "strict"],
    default: "moderate",
    description:
      "Off sends Yandex the adult flag and serves unblurred thumbnails, Moderate keeps Yandex's defaults, Strict uses Yandex family mode.",
  },
  {
    key: "cookies",
    label: "Yandex cookies (optional)",
    type: "textarea",
    secret: true,
    description:
      "Paste the full Cookie header from yandex.com in your browser (signed in or not). A real browser session lowers the captcha rate. Keep it private.",
  },
];
