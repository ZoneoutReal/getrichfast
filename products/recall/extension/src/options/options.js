// Recall options / full-search page: a roomier search over the local index,
// with Pro-gated site/date filters and JSON export, plus data settings
// (pause, ignore list, retention, clear-all). Reads the index from
// chrome.storage.local; destructive writes go through the background worker
// (the single index writer).
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const RI = globalThis.RecallIndex;
  const send = (msg) => chrome.runtime.sendMessage(msg).catch(() => null);
  const sget = (defaults) => new Promise((r) => chrome.storage.local.get(defaults, r));
  const sset = (obj) => new Promise((r) => chrome.storage.local.set(obj, r));

  const state = { index: RI.emptyIndex(), settings: { paused: false, ignore: [] }, pro: false, configured: false };

  // ---- helpers --------------------------------------------------------------
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 1400);
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlight(container, text, qTokens) {
    container.textContent = "";
    if (!qTokens.length) {
      container.textContent = text;
      return;
    }
    const re = new RegExp("(" + qTokens.map(escapeRe).join("|") + ")", "gi");
    let last = 0;
    let m;
    while ((m = re.exec(text))) {
      if (m.index > last) container.appendChild(document.createTextNode(text.slice(last, m.index)));
      const mark = document.createElement("mark");
      mark.textContent = m[0];
      container.appendChild(mark);
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    if (last < text.length) container.appendChild(document.createTextNode(text.slice(last)));
  }

  function hueFor(host) {
    let h = 0;
    for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) % 360;
    return h;
  }

  function parseHost(raw) {
    let s = String(raw || "").trim().toLowerCase();
    if (!s) return null;
    s = s.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
    if (s === "localhost") return s;
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(s) ? s : null;
  }

  const dayStart = (v) => (v ? new Date(v + "T00:00:00").getTime() : null);
  const dayEnd = (v) => (v ? new Date(v + "T23:59:59.999").getTime() : null);

  // ---- Pro gating -----------------------------------------------------------
  function requirePro(feature) {
    if (state.pro) return true;
    $("dlgFeature").textContent = feature + " is a Recall Pro feature.";
    $("dlgBuy").hidden = !state.configured;
    $("dlgNote").textContent = state.configured ? "" : "Not purchasable in this build yet — coming in a future update.";
    $("upgrade").showModal();
    return false;
  }

  // ---- rendering ------------------------------------------------------------
  function activeFilters() {
    if (!state.pro) return { site: null, from: null, to: null };
    return {
      site: $("siteFilter").value || null,
      from: dayStart($("fromDate").value),
      to: dayEnd($("toDate").value)
    };
  }

  function recentDocs(f) {
    return Object.entries(state.index.docs)
      .map(([docId, d]) => ({ docId, ...d, snippet: d.snippet, matched: 0, score: 0 }))
      .filter((d) => (!f.site || d.host === f.site) && (f.from == null || d.visitedAt >= f.from) && (f.to == null || d.visitedAt <= f.to))
      .sort((a, b) => b.visitedAt - a.visitedAt)
      .slice(0, 40);
  }

  function resultRow(r, qTokens) {
    const li = document.createElement("li");
    li.dataset.url = r.url;
    li.dataset.docid = r.docId;

    const mono = document.createElement("div");
    mono.className = "mono";
    mono.style.background = `linear-gradient(135deg, hsl(${hueFor(r.host)} 55% 42%), hsl(${(hueFor(r.host) + 40) % 360} 60% 46%))`;
    mono.textContent = (r.host[0] || "•").toUpperCase();

    const main = document.createElement("div");
    main.className = "res-main";
    const title = document.createElement("div");
    title.className = "res-title";
    title.textContent = r.title || r.host || r.url;
    const meta = document.createElement("div");
    meta.className = "res-meta";
    const host = document.createElement("span");
    host.textContent = r.host || "page";
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.textContent = "·";
    const when = document.createElement("span");
    when.textContent = RI.timeAgo(r.visitedAt);
    const dot2 = document.createElement("span");
    dot2.className = "dot";
    dot2.textContent = "·";
    const url = document.createElement("span");
    url.className = "res-url";
    url.textContent = r.url.replace(/^https?:\/\//, "");
    meta.append(host, dot, when, dot2, url);
    const snip = document.createElement("div");
    snip.className = "res-snip";
    highlight(snip, r.snippet || "", qTokens);
    main.append(title, meta, snip);

    const del = document.createElement("button");
    del.className = "rowdel";
    del.textContent = "✕";
    del.title = "Remove from index";
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      await send({ type: "recall-delete", docId: r.docId });
      await reload();
      toast("Removed");
    });

    li.append(mono, main, del);
    li.addEventListener("click", () => chrome.tabs.create({ url: r.url }));
    return li;
  }

  function renderResults() {
    const q = $("q").value.trim();
    const f = activeFilters();
    const list = $("results");
    list.textContent = "";
    const qTokens = q ? [...new Set(RI.tokenize(q))] : [];
    const results = q ? RI.search(state.index, q, { ...f, limit: 50, now: Date.now() }) : recentDocs(f);

    for (const r of results) list.appendChild(resultRow(r, qTokens));
    $("resultsEmpty").hidden = results.length > 0;
    if (results.length === 0) {
      $("resultsEmpty").textContent = q
        ? `No indexed page matches “${q}”.`
        : "Nothing indexed yet. Browse a few articles, then search here.";
    }
    $("clearFilters").hidden = !(f.site || f.from || f.to);
  }

  function renderStats() {
    const s = RI.stats(state.index);
    $("statDocs").textContent = s.docs.toLocaleString();
    $("statSites").textContent = RI.hosts(state.index).length.toLocaleString();
    $("statTokens").textContent = s.tokens.toLocaleString();
    $("statOldest").textContent = s.oldest ? RI.timeAgo(s.oldest) : "—";
  }

  function renderSettings() {
    $("pauseToggle").checked = !!state.settings.paused;
    $("retentionInfo").textContent = state.pro
      ? "Unlimited — your full reading history is kept."
      : `Last ${RECALL_CONFIG.FREE_RETENTION_DAYS} days · up to ${RECALL_CONFIG.FREE_MAX_DOCS.toLocaleString()} pages. Older pages are dropped automatically. Pro keeps everything.`;
    const list = $("ignoreList");
    list.textContent = "";
    for (const host of state.settings.ignore || []) {
      const item = document.createElement("span");
      item.className = "ignoreitem";
      item.append(document.createTextNode(host));
      const x = document.createElement("button");
      x.textContent = "✕";
      x.title = "Remove";
      x.addEventListener("click", async () => {
        state.settings.ignore = (state.settings.ignore || []).filter((h) => h !== host);
        await sset({ recall_settings: state.settings });
        renderSettings();
      });
      item.appendChild(x);
      list.appendChild(item);
    }
  }

  function populateSiteFilter() {
    const sel = $("siteFilter");
    const cur = sel.value;
    sel.textContent = "";
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "All sites";
    sel.appendChild(all);
    for (const h of RI.hosts(state.index)) {
      const o = document.createElement("option");
      o.value = h;
      o.textContent = h;
      sel.appendChild(o);
    }
    sel.value = cur;
  }

  function renderAll() {
    populateSiteFilter();
    renderResults();
    renderStats();
    renderSettings();
  }

  async function reload() {
    const data = await sget({ recall_index: null, recall_settings: {} });
    state.index = data.recall_index && data.recall_index.docs ? data.recall_index : RI.emptyIndex();
    state.settings = Object.assign({ paused: false, ignore: [] }, data.recall_settings || {});
    renderAll();
  }

  // ---- export ---------------------------------------------------------------
  function exportJSON() {
    const pages = Object.values(state.index.docs).map((d) => ({
      url: d.url,
      title: d.title,
      host: d.host,
      visitedAt: d.visitedAt,
      excerpt: d.snippet
    }));
    return JSON.stringify({ app: "recall", version: 1, exportedAt: Date.now(), settings: state.settings, pages }, null, 2);
  }

  function downloadExport() {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `recall-index-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---- init -----------------------------------------------------------------
  async function init() {
    $("priceLabel").textContent = RECALL_CONFIG.PRO_PRICE_LABEL;
    $("dlgPrice").textContent = RECALL_CONFIG.PRO_PRICE_LABEL;
    $("homeLink").href = RECALL_CONFIG.HOMEPAGE;

    const params = new URLSearchParams(location.search);
    if (params.get("welcome") === "1") $("welcome").hidden = false;

    const status = await RecallPay.getStatus();
    state.pro = !!status.paid;
    state.configured = !!status.configured;
    document.body.classList.toggle("is-pro", state.pro);
    $("planBadge").textContent = state.pro ? "Pro" : "Free";
    $("proCard").hidden = state.pro;
    if (!status.configured) $("proUnavailable").hidden = false;
    if (state.pro) {
      // hide the upsell purchase button/link when already Pro
      $("payBtn").hidden = true;
      $("restoreLink").hidden = true;
    }

    await reload();

    // search
    $("q").addEventListener("input", renderResults);

    // filters (Pro)
    const onFilter = (el) => {
      if (!state.pro) {
        el.value = "";
        requirePro("Filtering by site and date");
        return;
      }
      renderResults();
    };
    $("siteFilter").addEventListener("change", (e) => onFilter(e.target));
    $("fromDate").addEventListener("change", (e) => onFilter(e.target));
    $("toDate").addEventListener("change", (e) => onFilter(e.target));
    $("clearFilters").addEventListener("click", () => {
      $("siteFilter").value = "";
      $("fromDate").value = "";
      $("toDate").value = "";
      renderResults();
    });

    // settings
    $("pauseToggle").addEventListener("change", async (e) => {
      state.settings.paused = e.target.checked;
      await sset({ recall_settings: state.settings });
      toast(e.target.checked ? "Indexing paused" : "Indexing on");
    });
    $("ignoreAdd").addEventListener("click", async () => {
      const host = parseHost($("ignoreInput").value);
      if (!host) {
        toast("Enter a site like example.com");
        return;
      }
      state.settings.ignore = [...new Set([...(state.settings.ignore || []), host])];
      await sset({ recall_settings: state.settings });
      $("ignoreInput").value = "";
      renderSettings();
      toast("Added to ignore list");
    });
    $("ignoreInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") $("ignoreAdd").click();
    });

    // data
    $("exportBtn").addEventListener("click", () => {
      if (!requirePro("JSON export")) return;
      downloadExport();
      toast("Exported");
    });
    $("clearBtn").addEventListener("click", async () => {
      if (!confirm("Delete the entire local search index? This cannot be undone.")) return;
      await send({ type: "recall-clear" });
      await reload();
      toast("Index cleared");
    });

    // pro card
    $("payBtn").addEventListener("click", () => (state.configured ? RecallPay.openPaymentPage() : ($("proUnavailable").hidden = false)));
    $("restoreLink").addEventListener("click", (e) => {
      e.preventDefault();
      if (state.configured) RecallPay.openLoginPage();
      else $("proUnavailable").hidden = false;
    });

    // dialog
    $("dlgClose").addEventListener("click", () => $("upgrade").close());
    $("dlgBuy").addEventListener("click", () => {
      if (state.configured) RecallPay.openPaymentPage();
      $("upgrade").close();
    });
    $("welcomeClose").addEventListener("click", () => ($("welcome").hidden = true));

    // live refresh when the background indexes a new page
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.recall_index || changes.recall_settings) reload();
    });

    // test hooks
    window.__recallOptions = {
      get index() {
        return state.index;
      },
      get pro() {
        return state.pro;
      },
      exportJSON,
      setPro(v) {
        state.pro = v;
        document.body.classList.toggle("is-pro", v);
        $("planBadge").textContent = v ? "Pro" : "Free";
        $("proCard").hidden = v;
        renderAll();
      }
    };
    window.__recallOptionsReady = true;
  }

  init();
})();
