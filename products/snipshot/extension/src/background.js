// SnipShot background: capture the visible tab, hand off to the editor.
importScripts("lib/config.js", "lib/ExtPay.js");

if (SNIPSHOT_CONFIG.EXTPAY_ID) {
  const extpay = ExtPay(SNIPSHOT_CONFIG.EXTPAY_ID);
  extpay.startBackground();
}

function openEditor(query) {
  chrome.tabs.create({
    url: chrome.runtime.getURL("src/editor/editor.html") + (query || "")
  });
}

async function capture(tab) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab ? tab.windowId : undefined, {
      format: "png"
    });
    await chrome.storage.local.set({
      pendingCapture: { dataUrl, sourceUrl: tab && tab.url, capturedAt: Date.now() }
    });
    openEditor();
  } catch (err) {
    // Restricted surface (chrome://, Web Store, etc.) — open the editor with
    // an explanation instead of failing silently.
    await chrome.storage.local.set({ pendingCapture: null });
    openEditor("?err=restricted");
  }
}

chrome.action.onClicked.addListener((tab) => capture(tab));

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "take-screenshot") capture(tab);
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // First run: open the editor in demo mode so people can try the tools
    // immediately without hunting for something to capture.
    openEditor("?demo=1");
  }
});
