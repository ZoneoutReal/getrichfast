// MockFill background: routes the keyboard command, context menu, and popup
// requests to one fill pipeline (config + engine + runner via scripting API).
importScripts("lib/config.js", "lib/ExtPay.js");

if (MOCKFILL_CONFIG.EXTPAY_ID) {
  const extpay = ExtPay(MOCKFILL_CONFIG.EXTPAY_ID);
  extpay.startBackground();
}

const FILL_FILES = ["src/lib/config.js", "src/fill/engine.js", "src/fill/inject.js"];

async function fillTab(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: FILL_FILES
  });
  // Sum per-frame counts; frames we can't touch just don't appear.
  return results.reduce((sum, r) => sum + (r && r.result && r.result.filled ? r.result.filled : 0), 0);
}

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== "fill-forms" || !tab || tab.id == null) return;
  try {
    await fillTab(tab.id);
  } catch {
    // Restricted page (chrome://, Web Store) — nothing we can do.
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "mockfill-fill",
    title: "Fill forms with fake data",
    contexts: ["page", "editable"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "mockfill-fill" || !tab || tab.id == null) return;
  try {
    await fillTab(tab.id);
  } catch {
    /* restricted page */
  }
});

// The popup delegates here so fill logic lives in one place.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "fill" && msg.tabId != null) {
    fillTab(msg.tabId)
      .then((filled) => sendResponse({ ok: true, filled }))
      .catch((err) => sendResponse({ ok: false, error: String(err && err.message ? err.message : err) }));
    return true; // async response
  }
});
