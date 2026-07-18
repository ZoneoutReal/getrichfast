// TypeVault manager: cross-site draft history with per-site grouping, search,
// a per-field version timeline + word-level diff, settings, JSON export and
// clear-all. Everything reads/writes chrome.storage.local — nothing leaves the
// device. Free tier exposes the recent window; full history/diff/export is Pro.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const CFG = globalThis.TYPEVAULT_CONFIG;
  const Diff = globalThis.TypeVaultDiff;
  const Store = globalThis.TypeVaultStore;

  const DEFAULT_SETTINGS = { retention: 20, minLen: 15, pausedSites: [], globalPause: false };

  const state = {
    vault: {},
    settings: Object.assign({}, DEFAULT_SETTINGS),
    pay: { configured: false, paid: false }
  };

  // --------------------------------------------------------------- helpers

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 1800);
  }

  function requirePro(feature) {
    if (state.pay.paid) return true;
    if (TypeVaultPay.configured) TypeVaultPay.openPaymentPage();
    else toast(`${feature} is a Pro feature (${CFG.PRO_PRICE_LABEL}) — not available in this build yet.`);
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

  function isLocked(field, index) {
    if (state.pay.paid) return false;
    const fromEnd = field.versions.length - 1 - index;
    if (fromEnd >= CFG.FREE_VERSIONS_PER_FIELD) return true;
    if (Date.now() - field.versions[index].at > CFG.FREE_HISTORY_HOURS * 3600 * 1000) return true;
    return false;
  }

  function allFields() {
    return Object.values(state.vault);
  }

  // --------------------------------------------------------------- rendering

  function render() {
    const q = $("search").value.trim().toLowerCase();
    const container = $("sites");
    container.textContent = "";

    const fields = allFields().filter((f) => {
      if (!q) return true;
      const last = Store.latest(f);
      return (
        (f.label || "").toLowerCase().includes(q) ||
        (f.host || "").toLowerCase().includes(q) ||
        (last && last.text.toLowerCase().includes(q))
      );
    });

    // group by host, most-recently-edited site first
    const groups = new Map();
    for (const f of fields) {
      const key = f.host || f.origin || "unknown";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(f);
    }
    const orderedHosts = Array.from(groups.keys()).sort((a, b) => {
      const la = Math.max(...groups.get(a).map((f) => f.lastEdited || 0));
      const lb = Math.max(...groups.get(b).map((f) => f.lastEdited || 0));
      return lb - la;
    });

    for (const hostKey of orderedHosts) {
      const list = groups.get(hostKey).sort((a, b) => (b.lastEdited || 0) - (a.lastEdited || 0));
      const group = document.createElement("div");
      group.className = "site";

      const head = document.createElement("div");
      head.className = "site-head";
      const dot = document.createElement("span");
      dot.className = "site-dot";
      const name = document.createElement("span");
      name.className = "site-name";
      name.textContent = hostKey;
      const cnt = document.createElement("span");
      cnt.className = "chip site-count";
      cnt.textContent = `${list.length} draft${list.length === 1 ? "" : "s"}`;
      head.append(dot, name, cnt);
      group.appendChild(head);

      for (const f of list) {
        const last = Store.latest(f);
        const row = document.createElement("div");
        row.className = "drow";
        row.title = "Open version timeline";

        const label = document.createElement("div");
        label.className = "drow-label";
        label.textContent = f.label || "Text field";

        const preview = document.createElement("div");
        preview.className = "drow-preview";
        preview.textContent = last ? oneLine(last.text) : "";

        const meta = document.createElement("div");
        meta.className = "drow-meta";
        const vers = document.createElement("span");
        vers.className = "chip";
        vers.textContent = `${f.versions.length}`;
        const edited = document.createElement("span");
        edited.className = "small muted";
        edited.textContent = last ? timeAgo(f.lastEdited) : "";
        meta.append(vers, edited);

        row.append(label, preview, meta);
        row.addEventListener("click", () => openTimeline(f));
        group.appendChild(row);
      }
      container.appendChild(group);
    }

    const totalFields = allFields().length;
    const totalVersions = allFields().reduce((n, f) => n + f.versions.length, 0);
    const totalSites = new Set(allFields().map((f) => f.host || f.origin)).size;

    $("empty").hidden = totalFields > 0;
    $("managerCount").textContent = totalFields
      ? `${fields.length} of ${totalFields} draft${totalFields === 1 ? "" : "s"}`
      : "";
    $("statFields").textContent = String(totalFields);
    $("statVersions").textContent = String(totalVersions);
    $("statSites").textContent = String(totalSites);
    $("statPlan").textContent = state.pay.paid ? "Pro — unlimited" : "Free";
    $("planBadge").textContent = state.pay.paid ? "Pro" : "Free";
    $("proCard").hidden = !state.pay.configured || state.pay.paid;
    $("priceLabel").textContent = CFG.PRO_PRICE_LABEL;
    $("exportTag").hidden = state.pay.paid;

    // settings reflect
    $("globalPause").checked = !!state.settings.globalPause;
    $("retention").value = String(state.settings.retention || DEFAULT_SETTINGS.retention);
    $("minLen").value = String(state.settings.minLen || DEFAULT_SETTINGS.minLen);
    renderPausedSites();
    $("homeLink").href = CFG.HOMEPAGE;

    window.__tvReady = true;
  }

  function renderPausedSites() {
    const wrap = $("pausedSites");
    wrap.textContent = "";
    const sites = state.settings.pausedSites || [];
    $("noPaused").hidden = sites.length > 0;
    for (const host of sites) {
      const tag = document.createElement("span");
      tag.className = "paused-tag";
      const name = document.createElement("span");
      name.textContent = host;
      const x = document.createElement("button");
      x.className = "paused-x";
      x.textContent = "✕";
      x.title = "Resume capturing here";
      x.addEventListener("click", async () => {
        state.settings.pausedSites = sites.filter((h) => h !== host);
        await saveSettings();
        toast(`Resumed capturing on ${host}`);
      });
      tag.append(name, x);
      wrap.appendChild(tag);
    }
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

  function openTimeline(field) {
    $("tlLabel").textContent = field.label || "Text field";
    $("tlSub").textContent = `${field.host || field.origin} · ${field.versions.length} version${
      field.versions.length === 1 ? "" : "s"
    }`;
    const wrap = $("versions");
    wrap.textContent = "";

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
      when.textContent = `${timeAgo(v.at)} · ${new Date(v.at).toLocaleString()}`;
      const stat = document.createElement("span");
      stat.className = "chip ver-stat";
      stat.textContent = prevV ? (() => {
        const s = Diff.diffStats(Diff.diffWords(prevV.text, v.text));
        return `+${s.added} −${s.removed}`;
      })() : "first";
      head.append(when, stat);
      if (locked) {
        const lock = document.createElement("span");
        lock.className = "chip lock";
        lock.textContent = "🔒 Pro";
        head.appendChild(lock);
      }

      const diffBox = document.createElement("div");
      diffBox.className = "ver-diff";
      if (prevV) renderDiff(diffBox, prevV.text, v.text);
      else diffBox.textContent = v.text;

      const actions = document.createElement("div");
      actions.className = "ver-actions";
      const copyBtn = document.createElement("button");
      copyBtn.className = "btn btn-ghost tiny";
      copyBtn.textContent = locked ? "🔒 Copy" : "Copy version";
      copyBtn.addEventListener("click", async () => {
        if (locked && !requirePro("Full version history")) return;
        try {
          await navigator.clipboard.writeText(v.text);
          toast("Copied to clipboard");
        } catch {
          toast("Couldn't copy");
        }
      });
      actions.append(copyBtn);

      li.append(head, diffBox, actions);
      wrap.appendChild(li);
    }
    $("timeline").showModal();
  }

  // --------------------------------------------------------------- settings

  async function saveSettings() {
    await new Promise((r) => chrome.storage.local.set({ settings: state.settings }, r));
    renderPausedSites();
  }

  // --------------------------------------------------------------- data

  async function exportJSON() {
    const data = await new Promise((r) => chrome.storage.local.get({ vault: {}, settings: DEFAULT_SETTINGS }, r));
    return JSON.stringify({ app: "typevault", version: 1, exportedAt: Date.now(), settings: data.settings, vault: data.vault }, null, 2);
  }

  // --------------------------------------------------------------- boot

  async function refresh() {
    const data = await new Promise((r) =>
      chrome.storage.local.get({ vault: {}, settings: DEFAULT_SETTINGS }, r)
    );
    state.vault = data.vault || {};
    state.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
    render();
  }

  function wire() {
    $("search").addEventListener("input", render);

    $("globalPause").addEventListener("change", async (e) => {
      state.settings.globalPause = e.target.checked;
      await saveSettings();
      toast(e.target.checked ? "Capturing paused everywhere" : "Capturing resumed");
    });
    $("retention").addEventListener("change", async (e) => {
      state.settings.retention = parseInt(e.target.value, 10) || DEFAULT_SETTINGS.retention;
      await saveSettings();
      toast(`Keeping ${state.settings.retention} versions per field`);
    });
    $("minLen").addEventListener("change", async (e) => {
      state.settings.minLen = parseInt(e.target.value, 10) || DEFAULT_SETTINGS.minLen;
      await saveSettings();
    });

    $("exportBtn").addEventListener("click", async () => {
      if (!requirePro("JSON export")) return;
      const json = await exportJSON();
      const blob = new Blob([json], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "typevault-export.json";
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Exported all drafts as JSON");
    });

    $("clearBtn").addEventListener("click", () => $("confirm").showModal());
    $("confirmCancel").addEventListener("click", () => $("confirm").close());
    $("confirmClear").addEventListener("click", async () => {
      await new Promise((r) => chrome.storage.local.set({ vault: {} }, r));
      $("confirm").close();
      toast("All drafts cleared");
      refresh();
    });

    $("tlClose").addEventListener("click", () => $("timeline").close());
    $("timeline").addEventListener("click", (e) => {
      if (e.target === $("timeline")) $("timeline").close();
    });

    $("payBtn").addEventListener("click", () => TypeVaultPay.openPaymentPage());
    $("restoreLink").addEventListener("click", (e) => {
      e.preventDefault();
      TypeVaultPay.openLoginPage();
    });

    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && (changes.vault || changes.settings)) refresh();
      });
    } catch {
      /* stub */
    }
  }

  (async () => {
    wire();
    const params = new URLSearchParams(location.search);
    if (params.get("welcome")) {
      $("welcome").hidden = false;
      $("welcomeClose").addEventListener("click", () => ($("welcome").hidden = true));
    }
    state.pay = await TypeVaultPay.getStatus();
    await refresh();
  })();
})();
