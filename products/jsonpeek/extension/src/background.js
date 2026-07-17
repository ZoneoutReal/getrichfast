// JSONPeek background: action/command grabs the current tab's text (when
// allowed) and opens the viewer with it; restricted pages open the viewer
// empty with its paste UI.
importScripts("lib/config.js", "lib/ExtPay.js");

if (JSONPEEK_CONFIG.EXTPAY_ID) {
  const extpay = ExtPay(JSONPEEK_CONFIG.EXTPAY_ID);
  extpay.startBackground();
}

function openViewer(query) {
  chrome.tabs.create({
    url: chrome.runtime.getURL("src/viewer/viewer.html") + (query || "")
  });
}

// Runs IN THE PAGE: pull the raw text a JSON endpoint renders.
function grabPageText() {
  const pre = document.body && document.body.querySelector("body > pre");
  const text = (pre ? pre.textContent : document.body ? document.body.innerText : "") || "";
  return { text: text.slice(0, 64 * 1024 * 1024), url: location.href };
}

async function grabAndOpen(tab) {
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: grabPageText
    });
    const grabbed = res && res.result && res.result.text ? res.result.text.trim() : "";
    // Only hand over text that can plausibly be JSON — otherwise open empty.
    if (grabbed && /^[[{"]|^-?\d|^true|^false|^null/.test(grabbed)) {
      await chrome.storage.local.set({ pendingJSON: { text: grabbed, sourceUrl: res.result.url, at: Date.now() } });
      openViewer("?src=tab");
      return;
    }
    await chrome.storage.local.set({ pendingJSON: null });
    openViewer();
  } catch {
    // Restricted surface (chrome://, Web Store) — viewer opens with paste UI.
    await chrome.storage.local.set({ pendingJSON: null });
    openViewer("?err=restricted");
  }
}

chrome.action.onClicked.addListener((tab) => grabAndOpen(tab));

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "open-viewer") grabAndOpen(tab);
});
