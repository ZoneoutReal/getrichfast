// Recall popup: a fast search box over the locally-built content index.
// Reads the index straight from chrome.storage.local and ranks in-page with
// the shared RecallIndex engine — no network, no background round-trip.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const RI = globalThis.RecallIndex;

  const state = { index: RI.emptyIndex(), settings: { paused: false, ignore: [] }, pro: false };

  const sget = (defaults) => new Promise((r) => chrome.storage.local.get(defaults, r));
  const sset = (obj) => new Promise((r) => chrome.storage.local.set(obj, r));

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Safely highlight query terms inside untrusted page text via DOM nodes
  // (never innerHTML).
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

  function resultRow(r, qTokens) {
    const li = document.createElement("li");
    li.dataset.url = r.url;
    li.title = r.url;

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
    meta.append(host, dot, when);
    const snip = document.createElement("div");
    snip.className = "res-snip";
    highlight(snip, r.snippet || "", qTokens);
    main.append(title, meta, snip);

    li.append(mono, main);
    li.addEventListener("click", () => chrome.tabs.create({ url: r.url }));
    return li;
  }

  function render() {
    const q = $("q").value.trim();
    const list = $("results");
    list.textContent = "";
    const total = RI.docCount(state.index);
    $("countLabel").textContent = `${total} page${total === 1 ? "" : "s"} indexed${state.pro ? " · Pro" : ""}`;

    if (!q) {
      $("empty").hidden = false;
      $("noresults").hidden = true;
      return;
    }
    $("empty").hidden = true;

    const qTokens = [...new Set(RI.tokenize(q))];
    const results = RI.search(state.index, q, { limit: 15, now: Date.now() });
    if (results.length === 0) {
      $("noresults").hidden = false;
      $("noQ").textContent = q;
      return;
    }
    $("noresults").hidden = true;
    for (const r of results) list.appendChild(resultRow(r, qTokens));
  }

  async function load() {
    const data = await sget({ recall_index: null, recall_settings: {} });
    const idx = data.recall_index;
    state.index = idx && idx.docs ? idx : RI.emptyIndex();
    state.settings = Object.assign({ paused: false, ignore: [] }, data.recall_settings || {});
    $("pauseToggle").checked = !!state.settings.paused;
    render();
    window.__recallPopupReady = true;
  }

  async function init() {
    $("price").textContent = RECALL_CONFIG.PRO_PRICE_LABEL;

    const status = await RecallPay.getStatus();
    state.pro = !!status.paid;
    $("proBadge").hidden = !state.pro;
    $("upgradeBtn").hidden = !status.configured || status.paid;

    $("q").addEventListener("input", render);
    $("pauseToggle").addEventListener("change", async (e) => {
      state.settings.paused = e.target.checked;
      await sset({ recall_settings: state.settings });
    });
    $("manageLink").addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL("src/options/options.html") });
    });
    $("upgradeBtn").addEventListener("click", () => RecallPay.openPaymentPage());

    // Live-update if the background indexes a new page while the popup is open.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.recall_index) {
        const v = changes.recall_index.newValue;
        state.index = v && v.docs ? v : RI.emptyIndex();
        render();
      }
    });

    await load();
  }

  init();
})();
