// JSONPeek shared configuration.
// EXTPAY_ID: set to your extension's ID from https://extensionpay.com after
// registering it (see FOUNDER_SETUP.md). While null, all payment UI is
// hidden and Pro features stay locked with a "coming soon" note instead of a
// purchase flow.
globalThis.JSONPEEK_CONFIG = {
  EXTPAY_ID: null,
  PRO_PRICE_LABEL: "$12 one-time",
  HOMEPAGE: "https://zoneoutreal.github.io/getrichfast/jsonpeek/",
  FREE_SIZE_LIMIT: 2 * 1024 * 1024
};
