// ClipStack background service worker.
// Receives captured copies from the content script and appends them to the
// history in chrome.storage.local (deduped + capped by the pure store lib).
// Everything is local; nothing is ever transmitted.
importScripts("lib/config.js", "lib/store.js", "lib/ExtPay.js");

if (CLIPSTACK_CONFIG.EXTPAY_ID) {
  const extpay = ExtPay(CLIPSTACK_CONFIG.EXTPAY_ID);
  extpay.startBackground();
}

const S = ClipStackStore;

const DEFAULT_SETTINGS = {
  paused: false, // stop capturing without uninstalling
  ignore: [], // hosts we never capture from (e.g. your bank)
  max: CLIPSTACK_CONFIG.FREE_MAX_ITEMS, // preferred history cap (Pro can raise it)
  pro: false // cached ExtPay status so the worker needn't call it per-copy
};

async function getData() {
  const data = await chrome.storage.local.get({ clips: [], settings: DEFAULT_SETTINGS });
  data.settings = { ...DEFAULT_SETTINGS, ...data.settings };
  return data;
}

// The effective cap for a capture: free is hard-limited to FREE_MAX_ITEMS,
// Pro honors the user's chosen number (0 / blank = unlimited).
function effectiveMax(settings) {
  if (settings.pro) return settings.max && settings.max > 0 ? settings.max : Infinity;
  const wanted = settings.max && settings.max > 0 ? settings.max : CLIPSTACK_CONFIG.FREE_MAX_ITEMS;
  return Math.min(wanted, CLIPSTACK_CONFIG.FREE_MAX_ITEMS);
}

function isIgnored(host, ignore) {
  if (!host || !Array.isArray(ignore)) return false;
  const h = String(host).toLowerCase().replace(/^www\./, "");
  return ignore.some((raw) => {
    const p = String(raw || "").toLowerCase().replace(/^www\./, "").trim();
    return p && (h === p || h.endsWith("." + p));
  });
}

async function capture(input) {
  const { clips, settings } = await getData();
  if (settings.paused) return { ok: false, reason: "paused" };
  if (isIgnored(input.host, settings.ignore)) return { ok: false, reason: "ignored" };
  if (input.kind === "image" && !settings.pro) return { ok: false, reason: "pro" };
  if (!S.isAcceptable(input)) return { ok: false, reason: "empty" };

  const next = S.add(clips, input, { max: effectiveMax(settings), now: Date.now() });
  await chrome.storage.local.set({ clips: next });
  return { ok: true, count: next.length };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return;
  if (msg.type === "clip") {
    capture(msg)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, reason: String(err && err.message ? err.message : err) }));
    return true; // async response
  }
  if (msg.type === "get-clips") {
    getData()
      .then(({ clips }) => sendResponse({ ok: true, clips }))
      .catch((err) => sendResponse({ ok: false, reason: String(err && err.message ? err.message : err) }));
    return true;
  }
});

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason !== "install") return;
  const { settings } = await chrome.storage.local.get({ settings: null });
  if (!settings) await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  chrome.tabs.create({ url: chrome.runtime.getURL("src/options/options.html?welcome=1") });
});
