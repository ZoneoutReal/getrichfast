// TypeVault background service worker: payment bootstrap + first-run welcome.
// All draft capture happens in the content script; there is no background
// polling. Data lives entirely in chrome.storage.local.
importScripts("lib/config.js", "lib/ExtPay.js");

if (TYPEVAULT_CONFIG.EXTPAY_ID) {
  const extpay = ExtPay(TYPEVAULT_CONFIG.EXTPAY_ID);
  extpay.startBackground();
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== "install") return;
  chrome.tabs.create({
    url: chrome.runtime.getURL("src/options/options.html?welcome=1")
  });
});
