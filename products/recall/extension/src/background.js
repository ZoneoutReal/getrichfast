// Recall background service worker: the single writer of the local search
// index. It receives extracted page text from the content script, folds it
// into the inverted index, prunes to the current tier's limits, and persists
// — all serialized so concurrent visits never clobber each other. It makes no
// network requests (ExtensionPay only boots when a paid ID is configured).
importScripts("lib/config.js", "lib/index.js", "lib/ExtPay.js");

const RI = globalThis.RecallIndex;

let extpay = null;
if (RECALL_CONFIG.EXTPAY_ID) {
  extpay = ExtPay(RECALL_CONFIG.EXTPAY_ID);
  extpay.startBackground();
}

const IDX_KEY = "recall_index";
const SET_KEY = "recall_settings";

const sget = (defaults) => new Promise((r) => chrome.storage.local.get(defaults, r));
const sset = (obj) => new Promise((r) => chrome.storage.local.set(obj, r));

// In-memory index cache + a promise chain that serializes every read/mutate/
// persist cycle. On a cold service-worker start the cache is reloaded lazily.
let index = null;
let chain = Promise.resolve();

function withIndex(fn) {
  const next = chain.then(async () => {
    if (!index) {
      const data = await sget({ [IDX_KEY]: null });
      index = data[IDX_KEY] && data[IDX_KEY].docs ? data[IDX_KEY] : RI.emptyIndex();
    }
    return fn(index);
  });
  chain = next.catch(() => {});
  return next;
}

async function isPro() {
  if (!extpay) return false;
  try {
    const user = await extpay.getUser();
    return !!user.paid;
  } catch {
    return false; // offline → fail closed to free limits
  }
}

async function tierLimits() {
  return (await isPro())
    ? { maxDocs: Infinity, retentionDays: Infinity }
    : { maxDocs: RECALL_CONFIG.FREE_MAX_DOCS, retentionDays: RECALL_CONFIG.FREE_RETENTION_DAYS };
}

async function indexPage(page) {
  return withIndex(async (idx) => {
    if (!page || !RI.isIndexableUrl(page.url)) return RI.stats(idx);
    RI.addDoc(idx, page);
    RI.prune(idx, { ...(await tierLimits()), now: Date.now() });
    await sset({ [IDX_KEY]: idx });
    return RI.stats(idx);
  });
}

async function clearIndex() {
  return withIndex(async () => {
    index = RI.emptyIndex();
    await sset({ [IDX_KEY]: index });
    return RI.stats(index);
  });
}

async function deleteDoc(docId) {
  return withIndex(async (idx) => {
    RI.removeDoc(idx, String(docId));
    await sset({ [IDX_KEY]: idx });
    return RI.stats(idx);
  });
}

// Re-apply the current tier's limits on demand (e.g. after a retention change).
async function pruneNow() {
  return withIndex(async (idx) => {
    RI.prune(idx, { ...(await tierLimits()), now: Date.now() });
    await sset({ [IDX_KEY]: idx });
    return RI.stats(idx);
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;
  const reply = (p) =>
    p
      .then((stats) => sendResponse({ ok: true, stats }))
      .catch((err) => sendResponse({ ok: false, error: String(err && err.message ? err.message : err) }));

  if (msg.type === "recall-index") {
    reply(indexPage(msg.page));
    return true;
  }
  if (msg.type === "recall-clear") {
    reply(clearIndex());
    return true;
  }
  if (msg.type === "recall-delete") {
    reply(deleteDoc(msg.docId));
    return true;
  }
  if (msg.type === "recall-prune") {
    reply(pruneNow());
    return true;
  }
  if (msg.type === "recall-stats") {
    reply(withIndex((idx) => RI.stats(idx)));
    return true;
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== "install") return;
  chrome.storage.local.get({ [SET_KEY]: null }, (d) => {
    if (!d[SET_KEY]) chrome.storage.local.set({ [SET_KEY]: { paused: false, ignore: [] } });
  });
  chrome.tabs.create({ url: chrome.runtime.getURL("src/options/options.html?welcome=1") });
});
