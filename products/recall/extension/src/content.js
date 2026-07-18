// Recall content script: reads the readable text of the page you're viewing
// and hands it to the background worker to index locally. It runs at
// document_idle in the top frame only. It NEVER makes a network request — it
// only reads the DOM and messages the extension's own service worker.
//
// Injected after lib/config.js and lib/index.js, so RECALL_CONFIG and the
// shared RecallIndex URL-policy helpers are available here.
(() => {
  "use strict";

  // Top frame only — we index whole pages, not every embedded iframe.
  if (window.top !== window) return;
  if (window.__recallExtracted) return;
  window.__recallExtracted = true;

  const RI = globalThis.RecallIndex;
  const MIN_TEXT = 100; // below this it isn't a readable content page
  const BODY_CAP = 8000; // ~a few KB of body text per page

  // Skip non-http(s) and sensitive (auth/bank/checkout) URLs before doing any
  // work at all.
  if (!RI || !RI.isIndexableUrl(location.href)) return;

  function getSettings() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get({ recall_settings: {} }, (data) => {
          if (chrome.runtime.lastError) return resolve({});
          resolve((data && data.recall_settings) || {});
        });
      } catch {
        resolve({});
      }
    });
  }

  function metaDescription() {
    const sel = [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]'
    ];
    for (const s of sel) {
      const el = document.querySelector(s);
      const c = el && el.getAttribute("content");
      if (c && c.trim()) return c.trim();
    }
    return "";
  }

  const SKIP_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "CANVAS", "IFRAME",
    "NAV", "HEADER", "FOOTER", "ASIDE", "FORM", "BUTTON", "SELECT"
  ]);

  // Pull the visible reading text, preferring a <main>/<article> region.
  // Walks live text nodes (never mutating the page, and — unlike innerText on
  // a detached clone — preserving word spacing across block elements), while
  // skipping nav/header/footer/script/style and hidden subtrees.
  function extractBody() {
    const root = document.querySelector("main, article, [role='main']") || document.body;
    if (!root) return "";
    const stop = root.parentElement;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        for (let el = node.parentElement; el && el !== stop; el = el.parentElement) {
          if (SKIP_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
          if (el.getAttribute && (el.getAttribute("aria-hidden") === "true" || el.hidden)) {
            return NodeFilter.FILTER_REJECT;
          }
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const parts = [];
    let len = 0;
    let n;
    while ((n = walker.nextNode())) {
      const t = n.nodeValue.trim();
      parts.push(t);
      len += t.length + 1;
      if (len >= BODY_CAP) break;
    }
    return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, BODY_CAP);
  }

  async function run() {
    const settings = await getSettings();
    if (settings.paused) return;
    const host = RI.hostOf(location.href);
    const ignore = Array.isArray(settings.ignore) ? settings.ignore : [];
    if (ignore.some((h) => host === h || host.endsWith("." + h))) return;

    const body = extractBody();
    const title = (document.title || "").trim();
    const description = metaDescription();
    // Need enough substance to be worth remembering.
    if ((body + " " + title + " " + description).trim().length < MIN_TEXT) return;

    try {
      chrome.runtime.sendMessage(
        {
          type: "recall-index",
          page: { url: location.href, title, description, body, visitedAt: Date.now() }
        },
        () => void chrome.runtime.lastError // swallow "no receiver" races
      );
    } catch {
      /* extension context torn down — ignore */
    }
  }

  // Let late-rendering pages settle a beat past document_idle before reading.
  const start = () => run().catch(() => {});
  if ("requestIdleCallback" in window) {
    requestIdleCallback(start, { timeout: 1500 });
  } else {
    setTimeout(start, 400);
  }
})();
