export const SETTINGS_SCHEMA = [
  {
    key: "safeSearch",
    label: "Safe Search",
    type: "select",
    options: ["off", "moderate", "strict"],
    default: "moderate",
    description:
      "Off sends Yandex the adult flag and serves unblurred thumbnails, Moderate keeps Yandex's blur on adult tiles, Strict uses Yandex family mode.",
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
