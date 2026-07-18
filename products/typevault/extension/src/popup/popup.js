// TypeVault popup: drafts saved on the active page, with a per-field version
// timeline (times, previews, word-level diff vs the previous version) and
// one-click restore back into the live field. Free tier can restore the last
// 24h / newest 5 versions of the current site; deeper history is Pro.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const CFG = globalThis.TYPEVAULT_CONFIG;
  const Diff = globalThis.TypeVaultDiff;
  const Store = globalThis.TypeVaultStore;

  const state = {
    ctx: null, // { origin, host, path, tabId }
    vault: {},
    settings: { pausedSites: [], globalPause: false, retention: 20, minLen: 15 },
    pay: { configured: false, paid: false },
    view: "list",
    sig: null
  };

  // --------------------------------------------------------------- helpers

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 1600);
  }

  function proNote(text) {
    const el = $("proNote");
    el.hidden = false;
    el.textContent = text;
  }

  function requirePro(feature) {
    if (state.pay.paid) return true;
    if (TypeVaultPay.configured) TypeVaultPay.openPaymentPage();
    else proNote(`${feature} is a Pro feature (${CFG.PRO_PRICE_LABEL}) — not purchasable in this build yet.`);
    return false;
  }

  function timeAgo(ts) {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 45) return "just now";
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    if (s < 86400) return `${Math.round(s / 3600)}h ago`;
    return `${Math.round(s / 86400)}d ago`;
  }

  function oneLine(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  // A version is locked for free users when it's older than the free window or
  // sits beyond the newest N versions.
  function isLocked(field, index) {
    if (state.pay.paid) return false;
    const fromEnd = field.versions.length - 1 - index;
    if (fromEnd >= CFG.FREE_VERSIONS_PER_FIELD) return true;
    if (Date.now() - field.versions[index].at > CFG.FREE_HISTORY_HOURS * 3600 * 1000) return true;
    return false;
  }

  function siteFields() {
    const origin = state.ctx && state.ctx.origin;
    return Object.values(state.vault)
      .filter((f) => origin && f.origin === origin)
      .sort((a, b) => (b.lastEdited || 0) - (a.lastEdited || 0));
  }

  // --------------------------------------------------------------- list view

  function renderList() {
    const q = $("search").value.trim().toLowerCase();
    const list = $("drafts");
    list.textContent = "";
    const fields = siteFields().filter((f) => {
      if (!q) return true;
      const last = Store.latest(f);
      return (
        (f.label || "").toLowerCase().includes(q) || (last && last.text.toLowerCase().includes(q))
      );
    });

    for (const f of fields) {
      const last = Store.latest(f);
      const li = document.createElement("li");
      li.className = "draft";
      li.title = "Open version timeline";

      const top = document.createElement("div");
      top.className = "draft-top";
      const label = document.createElement("span");
      label.className = "draft-label";
      label.textContent = f.label || "Text field";
      const count = document.createElement("span");
      count.className = "chip vcount";
      count.textContent = `${f.versions.length} ver${f.versions.length === 1 ? "" : "s"}`;
      top.append(label, count);

      const prev = document.createElement("div");
      prev.className = "draft-preview";
      prev.textContent = last ? oneLine(last.text) : "";

      const meta = document.createElement("div");
      meta.className = "draft-meta small muted";
      meta.textContent = last ? `Edited ${timeAgo(f.lastEdited)}` : "";

      li.append(top, prev, meta);
      li.addEventListener("click", () => openTimeline(f.signature));
      list.appendChild(li);
    }

    const total = Object.keys(state.vault).length;
    const hasSite = !!(state.ctx && state.ctx.origin);
    $("empty").hidden = !hasSite || fields.length > 0;
    $("restricted").hidden = hasSite;
    $("totalLabel").textContent = total ? `${total} draft${total === 1 ? "" : "s"} saved · all sites` : "No drafts yet";
    $("siteHost").textContent = (state.ctx && state.ctx.host) || "this page";
  }

  // --------------------------------------------------------------- timeline

  function renderDiff(container, oldText, newText) {
    container.textContent = "";
    const ops = Diff.diffWords(oldText || "", newText || "");
    for (const op of ops) {
      const span = document.createElement("span");
      span.className = op.type === "add" ? "d-add" : op.type === "del" ? "d-del" : "d-same";
      span.textContent = op.text;
      container.appendChild(span);
    }
  }

  function openTimeline(sig) {
    const field = state.vault[sig];
    if (!field) return;
    state.sig = sig;
    state.view = "timeline";
    $("listView").hidden = true;
    $("timelineView").hidden = false;
    $("tlLabel").textContent = field.label || "Text field";
    $("tlCount").textContent = `${field.versions.length} version${field.versions.length === 1 ? "" : "s"}`;

    const wrap = $("versions");
    wrap.textContent = "";
    // newest first
    for (let idx = field.versions.length - 1; idx >= 0; idx--) {
      const v = field.versions[idx];
      const prevV = idx > 0 ? field.versions[idx - 1] : null;
      const locked = isLocked(field, idx);

      const li = document.createElement("li");
      li.className = "ver" + (locked ? " locked" : "");

      const head = document.createElement("div");
      head.className = "ver-head";
      const when = document.createElement("span");
      when.className = "ver-when";
      when.textContent = timeAgo(v.at);
      const stat = document.createElement("span");
      stat.className = "chip ver-stat";
      if (prevV) {
        const s = Diff.diffStats(Diff.diffWords(prevV.text, v.text));
        stat.textContent = `+${s.added} −${s.removed}`;
      } else {
        stat.textContent = "first";
      }
      const size = document.createElement("span");
      size.className = "small muted ver-size";
      size.textContent = `${v.len} chars`;
      head.append(when, stat, size);
      if (locked) {
        const lock = document.createElement("span");
        lock.className = "chip lock";
        lock.textContent = "🔒 Pro";
        head.appendChild(lock);
      }

      const preview = document.createElement("div");
      preview.className = "ver-preview";
      preview.textContent = oneLine(v.text);

      const diffBox = document.createElement("div");
      diffBox.className = "ver-diff";
      diffBox.hidden = true;
      if (prevV) renderDiff(diffBox, prevV.text, v.text);
      else diffBox.textContent = v.text;

      const actions = document.createElement("div");
      actions.className = "ver-actions";
      const diffBtn = document.createElement("button");
      diffBtn.className = "btn btn-ghost tiny";
      diffBtn.textContent = "Diff";
      diffBtn.addEventListener("click", () => {
        diffBox.hidden = !diffBox.hidden;
        diffBtn.classList.toggle("on", !diffBox.hidden);
      });
      const copyBtn = document.createElement("button");
      copyBtn.className = "btn btn-ghost tiny";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(v.text);
          toast("Copied to clipboard");
        } catch {
          toast("Couldn't copy");
        }
      });
      const restoreBtn = document.createElement("button");
      restoreBtn.className = "btn btn-primary tiny";
      restoreBtn.textContent = locked ? "🔒 Restore" : "Restore";
      restoreBtn.addEventListener("click", () => restore(field, idx));

      actions.append(diffBtn, copyBtn, restoreBtn);
      li.append(head, preview, diffBox, actions);
      wrap.appendChild(li);
    }
    $("proNote").hidden = true;
  }

  function backToList() {
    state.view = "list";
    state.sig = null;
    $("timelineView").hidden = true;
    $("listView").hidden = false;
    renderList();
  }

  // --------------------------------------------------------------- restore

  async function restore(field, index) {
    if (isLocked(field, index) && !requirePro("Restoring older versions")) return;
    const v = field.versions[index];
    if (!state.ctx || state.ctx.tabId == null) {
      try {
        await navigator.clipboard.writeText(v.text);
        toast("Copied to clipboard");
      } catch {
        toast("Couldn't restore here");
      }
      return;
    }
    try {
      const res = await chrome.tabs.sendMessage(state.ctx.tabId, {
        type: "tv-restore",
        signature: field.signature,
        text: v.text
      });
      if (res && res.restored) toast("Restored into the field");
      else if (res && res.copied) toast("Field gone — copied to clipboard");
      else toast("Couldn't find that field on the page");
    } catch {
      try {
        await navigator.clipboard.writeText(v.text);
        toast("Copied to clipboard");
      } catch {
        toast("Couldn't restore here");
      }
    }
  }

  // --------------------------------------------------------------- settings

  async function loadSettings() {
    const data = await new Promise((r) => chrome.storage.local.get({ settings: state.settings }, r));
    state.settings = Object.assign({}, state.settings, data.settings);
    const host = state.ctx && state.ctx.host;
    const paused =
      state.settings.globalPause ||
      (Array.isArray(state.settings.pausedSites) && host && state.settings.pausedSites.includes(host));
    $("pauseToggle").checked = !!paused;
  }

  async function togglePause(on) {
    const host = state.ctx && state.ctx.host;
    if (!host) return;
    const set = new Set(state.settings.pausedSites || []);
    if (on) set.add(host);
    else set.delete(host);
    state.settings.pausedSites = Array.from(set);
    await new Promise((r) => chrome.storage.local.set({ settings: state.settings }, r));
    toast(on ? `Paused on ${host}` : `Capturing on ${host}`);
  }

  // --------------------------------------------------------------- boot

  async function getActiveContext() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || tab.id == null) return null;
      const res = await chrome.tabs.sendMessage(tab.id, { type: "tv-origin" });
      if (!res || !res.origin) return null;
      return { origin: res.origin, host: res.host, path: res.path, tabId: tab.id };
    } catch {
      return null;
    }
  }

  async function refresh() {
    const data = await new Promise((r) => chrome.storage.local.get({ vault: {} }, r));
    state.vault = data.vault || {};
    if (state.view === "timeline" && state.sig && state.vault[state.sig]) openTimeline(state.sig);
    else renderList();
    window.__tvReady = true;
  }

  async function init() {
    $("price").textContent = CFG.PRO_PRICE_LABEL;

    state.pay = await TypeVaultPay.getStatus();
    document.body.classList.toggle("is-pro", state.pay.paid);
    $("proBadge").hidden = !state.pay.paid;
    $("upgradeBtn").hidden = !state.pay.configured || state.pay.paid;

    state.ctx = await getActiveContext();
    await loadSettings();

    $("search").addEventListener("input", renderList);
    $("backBtn").addEventListener("click", backToList);
    $("pauseToggle").addEventListener("change", (e) => togglePause(e.target.checked));
    $("manageLink").addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL("src/options/options.html") });
    });
    $("upgradeBtn").addEventListener("click", () => TypeVaultPay.openPaymentPage());

    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.vault) refresh();
      });
    } catch {
      /* stub */
    }

    await refresh();
  }

  init();
})();
