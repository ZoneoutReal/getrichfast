// ClipStack history store: pure helpers for the clipboard history list.
// No chrome.* APIs and no DOM — the exact same file runs in the service
// worker, the extension pages, and the Node test harness. Every function
// takes the current list and returns a NEW list, so callers stay honest
// about persistence (they read from and write to chrome.storage.local).
(() => {
  const MAX_TEXT = 100000; // hard cap on a stored snippet's length (chars)
  const MAX_IMAGE_BYTES = 512 * 1024; // Pro image clips: data-URL size ceiling
  const PREVIEW_CHARS = 220;

  // crypto.randomUUID exists in browsers, service workers, and modern Node,
  // but we fall back so store.js never throws when imported bare.
  function uid() {
    try {
      if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    } catch {
      /* fall through */
    }
    return "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  // The default free cap, read lazily so config load order never matters.
  function freeMax() {
    const c = globalThis.CLIPSTACK_CONFIG;
    return c && Number.isFinite(c.FREE_MAX_ITEMS) ? c.FREE_MAX_ITEMS : 50;
  }

  // Collapsed, trimmed form used for equality (dedupe) and for previews.
  function normalize(text) {
    return String(text == null ? "" : text).replace(/\s+/g, " ").trim();
  }

  function preview(text, n = PREVIEW_CHARS) {
    const s = normalize(text);
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }

  // Build a fresh entry. kind: "text" (default) | "image". Image entries carry
  // a data URL in `image` and a human label in `text`.
  function makeEntry(input, now = Date.now()) {
    const kind = input.kind === "image" ? "image" : "text";
    const entry = {
      id: input.id || uid(),
      kind,
      text: kind === "image" ? String(input.text || "Image") : String(input.text == null ? "" : input.text).slice(0, MAX_TEXT),
      host: String(input.host || "").replace(/^www\./, ""),
      at: Number.isFinite(input.at) ? input.at : now,
      pinned: !!input.pinned
    };
    if (kind === "image") {
      entry.image = String(input.image || "");
      if (Number.isFinite(input.w)) entry.w = input.w;
      if (Number.isFinite(input.h)) entry.h = input.h;
    }
    return entry;
  }

  // Two entries are "the same clip" when they're the same kind and the same
  // payload (normalized text, or identical image data).
  function sameClip(a, b) {
    if (a.kind !== b.kind) return false;
    if (a.kind === "image") return a.image === b.image;
    return normalize(a.text) === normalize(b.text);
  }

  // Would this input be accepted by add()? (non-empty text, or a real image
  // within the size cap). Handy for callers before they hit storage.
  function isAcceptable(input) {
    if (input && input.kind === "image") {
      const img = String(input.image || "");
      return img.startsWith("data:") && img.length <= MAX_IMAGE_BYTES;
    }
    return normalize(input && input.text) !== "";
  }

  // Drop the oldest UNPINNED entries once the unpinned count passes `max`.
  // Pinned entries are never auto-evicted. Pro (max = Infinity) keeps all.
  function prune(list, max) {
    if (!Number.isFinite(max)) return list.slice();
    const unpinned = list.filter((e) => !e.pinned);
    if (unpinned.length <= max) return list.slice();
    // oldest unpinned first → mark the overflow for removal
    const doomed = new Set(
      unpinned
        .slice()
        .sort((a, b) => a.at - b.at)
        .slice(0, unpinned.length - max)
        .map((e) => e.id)
    );
    return list.filter((e) => !doomed.has(e.id));
  }

  // Add a captured clip. Dedupe: if an identical clip already exists, bump it
  // to "now" and move it to the top instead of storing a duplicate. Otherwise
  // prepend the new clip and prune the unpinned tail to the cap.
  // opts: { isPro, max, now }
  function add(list, input, opts = {}) {
    const now = Number.isFinite(opts.now) ? opts.now : Date.now();
    if (!isAcceptable(input)) return list.slice();
    // An explicit cap always wins; otherwise Pro is unlimited and free uses
    // the configured ceiling.
    const max = Number.isFinite(opts.max) ? opts.max : opts.isPro ? Infinity : freeMax();

    const candidate = makeEntry(input, now);
    const dupIdx = list.findIndex((e) => sameClip(e, candidate));
    if (dupIdx !== -1) {
      const existing = { ...list[dupIdx], at: now };
      const rest = list.filter((_, i) => i !== dupIdx);
      return [existing, ...rest]; // move-to-top, count unchanged → no prune
    }
    return prune([candidate, ...list], max);
  }

  function setPinned(list, id, pinned) {
    return list.map((e) => (e.id === id ? { ...e, pinned: !!pinned } : e));
  }

  function togglePin(list, id) {
    return list.map((e) => (e.id === id ? { ...e, pinned: !e.pinned } : e));
  }

  function remove(list, id) {
    return list.filter((e) => e.id !== id);
  }

  // Clear everything, or keep the pinned favorites.
  function clearAll() {
    return [];
  }
  function clearUnpinned(list) {
    return list.filter((e) => e.pinned);
  }

  // Case-insensitive substring match across the clip text and its host.
  function search(list, query) {
    const q = normalize(query).toLowerCase();
    if (!q) return list.slice();
    return list.filter((e) => (normalize(e.text) + " " + (e.host || "")).toLowerCase().includes(q));
  }

  // Display order: pinned first, then everything by most-recent. Stable within
  // each group so a freshly bumped clip lands at the very top.
  function ordered(list) {
    return list
      .map((e, i) => [e, i])
      .sort((a, b) => {
        if (!!b[0].pinned !== !!a[0].pinned) return a[0].pinned ? -1 : 1;
        if (b[0].at !== a[0].at) return b[0].at - a[0].at;
        return a[1] - b[1];
      })
      .map((pair) => pair[0]);
  }

  function counts(list) {
    let pinned = 0;
    for (const e of list) if (e.pinned) pinned++;
    return { total: list.length, pinned, unpinned: list.length - pinned };
  }

  // Relative time for the UI: "just now", "6m", "3h", "2d", then a date.
  function timeAgo(at, now = Date.now()) {
    const s = Math.max(0, Math.round((now - at) / 1000));
    if (s < 45) return "just now";
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.round(h / 24);
    if (d < 7) return `${d}d`;
    return new Date(at).toLocaleDateString();
  }

  function exportJSON(list) {
    return JSON.stringify({ app: "clipstack", version: 1, exportedAt: Date.now(), clips: list }, null, 2);
  }

  globalThis.ClipStackStore = {
    MAX_TEXT,
    MAX_IMAGE_BYTES,
    uid,
    normalize,
    preview,
    makeEntry,
    sameClip,
    isAcceptable,
    prune,
    add,
    setPinned,
    togglePin,
    remove,
    clearAll,
    clearUnpinned,
    search,
    ordered,
    counts,
    timeAgo,
    exportJSON
  };
})();
