// SnipKey shared configuration.
// EXTPAY_ID: set to your extension's ID from https://extensionpay.com after
// registering (see FOUNDER_SETUP.md). While null, all payment UI is hidden
// and the extension runs in free mode only.
globalThis.SNIPKEY_CONFIG = {
  EXTPAY_ID: "getsnipkey",
  FREE_SNIPPET_LIMIT: 10,
  PRO_PRICE_LABEL: "$15 one-time",
  HOMEPAGE: "https://zoneoutreal.github.io/getrichfast/snipkey/",
  SHORTCUT_PATTERN: "^[a-zA-Z0-9_-]{1,32}$"
};
