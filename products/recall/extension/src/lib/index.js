// Recall indexing & search engine — pure, dependency-free, and side-effect
// free. No chrome.*, no DOM, no network: the identical file powers the
// service worker (importScripts), the popup/options pages (<script>), the
// content-script URL policy, AND the Node test harness (import()).
//
// It only ever assigns globalThis.RecallIndex and defines functions, so it is
// valid both as a classic script (browser) and as an ES module (Node), where
// importing it simply executes the IIFE and populates globalThis.RecallIndex.
(() => {
  "use strict";

  const DAY_MS = 86400000;

  // Function words only. Content words like "html"/"http" are deliberately
  // kept searchable — Recall searches what you *read*, not boilerplate.
  const STOPWORDS = new Set(
    ("a an and are as at be been being but by for from had has have having he her here him his " +
      "how i if in into is it its me my no not of on or our out over she so some such than that " +
      "the their them then there these they this those through to too under up us very was we were " +
      "what when where which while who why will with would you your about after again all also any " +
      "because both can could did do does down each few more most off only other should shall may " +
      "might must now new just").split(" ")
  );

  // ---- URL policy (shared with the content script) --------------------------
  function isHttpUrl(url) {
    return /^https?:\/\//i.test(String(url || ""));
  }

  // Pages that commonly hold secrets or private account state — never indexed.
  const SENSITIVE_RE =
    /(^|[^a-z])(login|log-in|signin|sign-in|signup|sign-up|logout|sign-out|auth|oauth|sso|saml|session|password|passwd|passphrase|account|checkout|payment|billing|invoice|bank|banking|wallet|wire-transfer|reset-password|verify|verification|2fa|otp|token|credential|wp-admin|wp-login|admin)([^a-z]|$)/i;

  // High-signal subdomains that almost always front private/account surfaces.
  const SENSITIVE_HOST_RE = /(^|\.)(login|signin|logon|auth|sso|secure|bank|banking|wallet)\./i;

  function isSensitiveUrl(url) {
    const s = String(url || "");
    try {
      const u = new URL(s);
      // A login./secure./bank. subdomain is skipped outright; otherwise probe
      // the path+query so "account.example.com/blog" stays indexable but
      // ".../account/settings" or "?token=" is skipped.
      if (SENSITIVE_HOST_RE.test(u.hostname + ".")) return true;
      return SENSITIVE_RE.test(u.pathname + u.search);
    } catch {
      return SENSITIVE_RE.test(s);
    }
  }

  // A page is indexable if it is an http(s) page and not sensitive.
  function isIndexableUrl(url) {
    return isHttpUrl(url) && !isSensitiveUrl(url);
  }

  // ---- URL / host helpers ---------------------------------------------------
  function normalizeUrl(url) {
    const s = String(url || "");
    try {
      const u = new URL(s);
      u.hash = ""; // "#section" variants are the same page
      return u.toString();
    } catch {
      return s;
    }
  }

  function hostOf(url) {
    try {
      return new URL(String(url)).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  // ---- tokenization ---------------------------------------------------------
  // Lowercase → split on non-word (unicode aware) → drop stopwords and
  // single-character noise. Returns tokens WITH repeats so callers can count
  // term frequency; the inverted index dedupes per document via those counts.
  function tokenize(text) {
    const raw = String(text || "").toLowerCase().match(/[\p{L}\p{N}]+/gu);
    if (!raw) return [];
    const out = [];
    for (const t of raw) {
      if (t.length < 2 || t.length > 40) continue;
      if (STOPWORDS.has(t)) continue;
      out.push(t);
    }
    return out;
  }

  function termFreqs(tokens) {
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    return tf;
  }

  function collapse(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  // The short excerpt stored per doc that snippets are cut from.
  function makeSnippetSource(text, cap = 600) {
    const s = collapse(text);
    return s.length > cap ? s.slice(0, cap) : s;
  }

  // ---- index construction ---------------------------------------------------
  function emptyIndex() {
    return { seq: 1, ids: {}, docs: {}, inv: {} };
  }

  // Remove a set of docIds from the docs map, the url→id map, and every
  // posting list — in a single pass over the inverted index.
  function removeDocs(idx, docIds) {
    const set = docIds instanceof Set ? docIds : new Set(docIds);
    if (set.size === 0) return 0;
    for (const id of set) {
      const doc = idx.docs[id];
      if (doc && idx.ids[doc.url] === id) delete idx.ids[doc.url];
      delete idx.docs[id];
    }
    for (const token of Object.keys(idx.inv)) {
      const posting = idx.inv[token];
      for (const id of set) {
        if (id in posting) delete posting[id];
      }
      // drop tokens whose posting list is now empty
      if (Object.keys(posting).length === 0) delete idx.inv[token];
    }
    return set.size;
  }

  function removeDoc(idx, docId) {
    return removeDocs(idx, new Set([docId]));
  }

  // Add or update a page. Re-visiting a URL updates its entry in place (same
  // docId) instead of creating a duplicate.
  function addDoc(idx, { url, title, description, body, visitedAt }) {
    const normUrl = normalizeUrl(url);
    if (!normUrl) return null;
    const existing = idx.ids[normUrl];
    if (existing != null) removeDoc(idx, existing);
    const docId = existing != null ? existing : String(idx.seq++);

    const host = hostOf(normUrl);
    const ttl = collapse(title) || host || normUrl;
    const desc = collapse(description);
    const bod = collapse(body);
    const full = [ttl, desc, bod].filter(Boolean).join(" ");
    const tf = termFreqs(tokenize(full));

    for (const [token, count] of tf) {
      (idx.inv[token] || (idx.inv[token] = {}))[docId] = count;
    }
    const v = Number(visitedAt);
    idx.docs[docId] = {
      url: normUrl,
      title: ttl,
      host,
      snippet: makeSnippetSource(desc ? desc + " — " + bod : bod),
      visitedAt: Number.isFinite(v) ? v : Date.now(),
      tokens: tf.size
    };
    idx.ids[normUrl] = docId;
    return docId;
  }

  // ---- search ---------------------------------------------------------------
  function docCount(idx) {
    return Object.keys(idx.docs).length;
  }

  // Build a snippet: a window of text around the first matched query token in
  // the stored excerpt. Falls back to the start of the excerpt (e.g. when the
  // match was on the title only). Returns plain text — the UI highlights.
  function makeSnippet(source, qTokens, width = 180) {
    const src = String(source || "");
    if (!src) return "";
    const low = src.toLowerCase();
    let pos = -1;
    for (const t of qTokens) {
      const i = low.indexOf(t);
      if (i !== -1 && (pos === -1 || i < pos)) pos = i;
    }
    if (pos === -1) {
      return src.length > width ? src.slice(0, width).trimEnd() + "…" : src;
    }
    let start = Math.max(0, pos - Math.floor(width * 0.35));
    let end = Math.min(src.length, start + width);
    // snap to word boundaries so we don't cut words in half
    if (start > 0) {
      const sp = src.indexOf(" ", start);
      if (sp !== -1 && sp < pos) start = sp + 1;
    }
    if (end < src.length) {
      const sp = src.lastIndexOf(" ", end);
      if (sp > pos) end = sp;
    }
    return (start > 0 ? "…" : "") + src.slice(start, end).trim() + (end < src.length ? "…" : "");
  }

  // query → ranked results. opts: { limit, now, site, from, to }.
  // Scoring: TF-IDF summed across query tokens; ranked AND-ish, so a doc that
  // matches more of the query tokens always outranks one that matches fewer,
  // with the TF-IDF sum (then recency) breaking ties.
  function search(idx, query, opts = {}) {
    const qTokens = [...new Set(tokenize(query))];
    if (qTokens.length === 0) return [];
    const limit = opts.limit || 20;
    const site = opts.site || null;
    const from = opts.from != null ? Number(opts.from) : null;
    const to = opts.to != null ? Number(opts.to) : null;
    const N = Math.max(1, docCount(idx));

    const acc = new Map(); // docId -> { score, matched }
    for (const token of qTokens) {
      const posting = idx.inv[token];
      if (!posting) continue;
      const df = Object.keys(posting).length;
      const idf = Math.log(1 + N / df);
      for (const docId in posting) {
        const cur = acc.get(docId) || { score: 0, matched: 0 };
        cur.score += posting[docId] * idf;
        cur.matched += 1;
        acc.set(docId, cur);
      }
    }

    const results = [];
    for (const [docId, s] of acc) {
      const doc = idx.docs[docId];
      if (!doc) continue;
      if (site && doc.host !== site) continue;
      if (from != null && doc.visitedAt < from) continue;
      if (to != null && doc.visitedAt > to) continue;
      results.push({
        docId,
        url: doc.url,
        title: doc.title,
        host: doc.host,
        visitedAt: doc.visitedAt,
        score: s.score,
        matched: s.matched,
        snippet: makeSnippet(doc.snippet, qTokens)
      });
    }

    results.sort(
      (a, b) => b.matched - a.matched || b.score - a.score || b.visitedAt - a.visitedAt
    );
    return results.slice(0, limit);
  }

  // ---- pruning (keeps storage bounded) --------------------------------------
  // Evicts docs older than the retention window, then evicts the oldest until
  // at most maxDocs remain. retentionDays / maxDocs of null/Infinity = no cap
  // (Pro). Returns the number of docs removed.
  function prune(idx, { maxDocs = Infinity, retentionDays = Infinity, now = Date.now() } = {}) {
    const victims = new Set();
    const entries = Object.entries(idx.docs);

    if (retentionDays != null && Number.isFinite(retentionDays)) {
      const cutoff = now - retentionDays * DAY_MS;
      for (const [id, doc] of entries) {
        if (doc.visitedAt < cutoff) victims.add(id);
      }
    }

    if (maxDocs != null && Number.isFinite(maxDocs)) {
      const survivors = entries
        .filter(([id]) => !victims.has(id))
        .sort((a, b) => a[1].visitedAt - b[1].visitedAt); // oldest first
      const excess = survivors.length - maxDocs;
      for (let i = 0; i < excess; i++) victims.add(survivors[i][0]);
    }

    return removeDocs(idx, victims);
  }

  // ---- misc read helpers ----------------------------------------------------
  function stats(idx) {
    let oldest = Infinity;
    let newest = 0;
    const docs = Object.values(idx.docs);
    for (const d of docs) {
      if (d.visitedAt < oldest) oldest = d.visitedAt;
      if (d.visitedAt > newest) newest = d.visitedAt;
    }
    return {
      docs: docs.length,
      tokens: Object.keys(idx.inv).length,
      oldest: docs.length ? oldest : null,
      newest: docs.length ? newest : null
    };
  }

  function hosts(idx) {
    const seen = new Set();
    for (const d of Object.values(idx.docs)) if (d.host) seen.add(d.host);
    return [...seen].sort();
  }

  // Human-friendly relative time. Pure and testable.
  function timeAgo(ts, now = Date.now()) {
    const diff = Math.max(0, now - Number(ts));
    const s = Math.floor(diff / 1000);
    if (s < 45) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    const w = Math.floor(d / 7);
    if (w < 5) return `${w}w ago`;
    const mo = Math.floor(d / 30);
    if (mo < 12) return `${mo}mo ago`;
    return `${Math.floor(d / 365)}y ago`;
  }

  globalThis.RecallIndex = {
    DAY_MS,
    STOPWORDS,
    isHttpUrl,
    isSensitiveUrl,
    isIndexableUrl,
    normalizeUrl,
    hostOf,
    tokenize,
    termFreqs,
    makeSnippetSource,
    emptyIndex,
    addDoc,
    removeDoc,
    removeDocs,
    search,
    makeSnippet,
    prune,
    stats,
    hosts,
    docCount,
    timeAgo
  };
})();
