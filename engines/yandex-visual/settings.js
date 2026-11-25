import { Include, INCLUDE_LABELS, SAFE_MODES } from "./request.js";

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
      "Off does not restrict NSFW results. Moderate keeps Yandex's defaults. Strict uses Yandex family mode.",
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
      "Paste the full Cookie header from yandex.com in your browser (signed in or not). A real browser session lowers the captcha rate. Keep it private.",
  },
];
