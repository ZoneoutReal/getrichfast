// SnipKey background service worker: payment bootstrap + first-run seeding.
importScripts("lib/config.js", "lib/ExtPay.js");

if (SNIPKEY_CONFIG.EXTPAY_ID) {
  const extpay = ExtPay(SNIPKEY_CONFIG.EXTPAY_ID);
  extpay.startBackground();
}

const STARTER_SNIPPETS = [
  {
    shortcut: "ty",
    text: "Thank you so much — I really appreciate it!"
  },
  {
    shortcut: "intro",
    text: "Hi {cursor},\n\nGreat to meet you! Here's a quick intro from my side:\n\n"
  },
  {
    shortcut: "tmrw",
    text: "Would {date+1} work for you? Happy to find another time if not."
  },
  {
    shortcut: "now",
    text: "{datetime}"
  }
];

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== "install") return;
  chrome.storage.local.get({ snippets: [] }, ({ snippets }) => {
    if (snippets.length === 0) {
      chrome.storage.local.set({
        snippets: STARTER_SNIPPETS.map((s) => ({
          id: crypto.randomUUID(),
          shortcut: s.shortcut,
          text: s.text,
          createdAt: Date.now()
        }))
      });
    }
    chrome.tabs.create({
      url: chrome.runtime.getURL("src/options/options.html?welcome=1")
    });
  });
});
