// ClipStack options: the full history manager (search, pin, delete, bulk
// clear, JSON export) plus capture settings (pause, history size, ignore
// list). All reads/writes go straight to chrome.storage.local; the pure
// store lib does the list transforms. Pro surfaces are gated on ExtPay.
const $ = (id) => document.getElementById(id);
const S = ClipStackStore;

const DEFAULT_SETTINGS = {
  paused: false,
  ignore: [],
  max: CLIPSTACK_CONFIG.FREE_MAX_ITEMS,
  pro: false
};

const state = { clips: [], settings: { ...DEFAULT_SETTINGS }, pro: false, query: "" };

function showSaved() {
  const t = $("savedToast");
  t.hidden = false;
  clearTimeout(showSaved._t);
  showSaved._t = setTimeout(() => (t.hidden = true), 1200);
}

async function readAll() {
  const data = await chrome.storage.local.get({ clips: [], settings: DEFAULT_SETTINGS });
  state.clips = Array.isArray(data.clips) ? data.clips : [];
  state.settings = { ...DEFAULT_SETTINGS, ...data.settings };
}

async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  await chrome.storage.local.set({ settings: state.settings });
  showSaved();
}

async function saveClips(next) {
  state.clips = next;
  await chrome.storage.local.set({ clips: next });
  renderRows();
}

async function copyBack(entry) {
  if (entry.kind === "image" && entry.image) {
    try {
      const blob = await (await fetch(entry.image)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(entry.text || "");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = entry.text || "";
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

function itemRow(entry) {
  const row = document.createElement("div");
  row.className = "item" + (entry.pinned ? " pinned" : "");
  row.dataset.id = entry.id;

  if (entry.kind === "image" && entry.image) {
    const img = document.createElement("img");
    img.className = "thumb";
    img.src = entry.image;
    img.alt = entry.text || "Image";
    row.appendChild(img);
  } else {
    const body = document.createElement("div");
    body.className = "body" + (/[{};=<>]|=>|\bfunction\b/.test(entry.text || "") ? " mono" : "");
    body.textContent = S.preview(entry.text, 400);
    row.appendChild(body);
  }

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${entry.host || "local"} · ${S.timeAgo(entry.at)}`;
  row.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "actions";
  const copy = document.createElement("button");
  copy.className = "iconbtn copy";
  copy.title = "Copy back to clipboard";
  copy.textContent = "⧉";
  copy.addEventListener("click", () => {
    copyBack(entry);
    copy.textContent = "✓";
    setTimeout(() => (copy.textContent = "⧉"), 900);
  });
  const pin = document.createElement("button");
  pin.className = "iconbtn pin" + (entry.pinned ? " on" : "");
  pin.title = entry.pinned ? "Unpin" : "Pin";
  pin.textContent = entry.pinned ? "★" : "☆";
  pin.addEventListener("click", () => saveClips(S.togglePin(state.clips, entry.id)));
  const del = document.createElement("button");
  del.className = "iconbtn del";
  del.title = "Delete";
  del.textContent = "✕";
  del.addEventListener("click", () => saveClips(S.remove(state.clips, entry.id)));
  actions.append(copy, pin, del);
  row.appendChild(actions);
  return row;
}

function renderRows() {
  const view = S.ordered(S.search(state.clips, state.query));
  const rows = $("rows");
  rows.textContent = "";
  view.forEach((e) => rows.appendChild(itemRow(e)));
  const c = S.counts(state.clips);
  $("count").textContent = c.total ? `${c.total} clip${c.total === 1 ? "" : "s"}${c.pinned ? ` · ${c.pinned} pinned` : ""}` : "";
  $("emptyRows").hidden = view.length > 0;
  if (view.length === 0 && state.query) $("emptyRows").textContent = `No clips match "${state.query}".`;
  else $("emptyRows").textContent = "No clips yet — copy something on any page and it will appear here.";
  window.__csOptReady = true;
}

function renderIgnore() {
  const wrap = $("ignoreList");
  wrap.textContent = "";
  (state.settings.ignore || []).forEach((host) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    const label = document.createElement("span");
    label.textContent = host;
    const x = document.createElement("button");
    x.textContent = "✕";
    x.title = "Remove";
    x.addEventListener("click", () => {
      saveSettings({ ignore: state.settings.ignore.filter((h) => h !== host) });
      renderIgnore();
    });
    chip.append(label, x);
    wrap.appendChild(chip);
  });
}

function renderSettings() {
  $("pause").checked = !!state.settings.paused;
  $("maxItems").value = state.settings.max || CLIPSTACK_CONFIG.FREE_MAX_ITEMS;
  $("maxItems").disabled = false;
  $("maxNote").textContent = state.pro
    ? "Pro: set any size, or leave the cap high for unlimited history."
    : `Free keeps up to ${CLIPSTACK_CONFIG.FREE_MAX_ITEMS} clips. Pro removes the cap.`;
  renderIgnore();
}

function applyProUI() {
  document.body.classList.toggle("is-pro", state.pro);
  $("proBadge").hidden = !state.pro;
  $("proCard").classList.toggle("locked", !state.pro);
  $("proLockNote").hidden = state.pro;
  $("upsell").hidden = state.pro;
}

function proNote(text) {
  const n = $("proNote");
  n.hidden = false;
  n.textContent = text;
}

function gatePro(feature) {
  if (state.pro) return true;
  if (ClipStackPay.configured) ClipStackPay.openPaymentPage();
  else proNote(`${feature} is a Pro feature (${CLIPSTACK_CONFIG.PRO_PRICE_LABEL}) — not purchasable in this build yet.`);
  return false;
}

function exportJSON() {
  if (!gatePro("JSON export")) return;
  const blob = new Blob([S.exportJSON(state.clips)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clipstack-history-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function init() {
  $("price").textContent = CLIPSTACK_CONFIG.PRO_PRICE_LABEL;
  $("price2").textContent = CLIPSTACK_CONFIG.PRO_PRICE_LABEL;
  $("freeMax").textContent = String(CLIPSTACK_CONFIG.FREE_MAX_ITEMS);
  $("homeLink").href = CLIPSTACK_CONFIG.HOMEPAGE;
  if (new URLSearchParams(location.search).get("welcome")) $("welcome").hidden = false;

  const status = await ClipStackPay.getStatus();
  state.pro = !!status.paid;
  if (!ClipStackPay.configured) $("proUnavailable").hidden = false;
  applyProUI();

  await readAll();
  // Keep the background's cached Pro flag in sync with ExtPay.
  if (!!state.settings.pro !== state.pro) await saveSettings({ pro: state.pro });
  renderSettings();
  renderRows();

  $("search").addEventListener("input", () => {
    state.query = $("search").value;
    renderRows();
  });
  $("pause").addEventListener("change", () => saveSettings({ paused: $("pause").checked }));
  $("maxItems").addEventListener("change", () => {
    let n = parseInt($("maxItems").value, 10);
    if (!Number.isFinite(n) || n < 5) n = 5;
    if (!state.pro && n > CLIPSTACK_CONFIG.FREE_MAX_ITEMS) {
      n = CLIPSTACK_CONFIG.FREE_MAX_ITEMS;
      proNote(`Free keeps up to ${CLIPSTACK_CONFIG.FREE_MAX_ITEMS} clips — Pro removes the cap.`);
    }
    $("maxItems").value = n;
    saveSettings({ max: n });
  });
  $("ignoreAdd").addEventListener("click", () => {
    const raw = $("ignoreInput").value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
    if (!raw) return;
    if (!state.settings.ignore.includes(raw)) saveSettings({ ignore: [...state.settings.ignore, raw] });
    $("ignoreInput").value = "";
    renderIgnore();
  });
  $("ignoreInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("ignoreAdd").click();
  });
  $("exportBtn").addEventListener("click", exportJSON);
  $("clearUnpinnedBtn").addEventListener("click", () => {
    const c = S.counts(state.clips);
    if (c.unpinned === 0) return;
    if (confirm(`Delete ${c.unpinned} unpinned clip${c.unpinned === 1 ? "" : "s"}? Pinned clips are kept.`)) {
      saveClips(S.clearUnpinned(state.clips));
    }
  });
  $("clearBtn").addEventListener("click", () => {
    if (state.clips.length === 0) return;
    if (confirm(`Clear all ${state.clips.length} clips, including pinned? This can't be undone.`)) {
      saveClips(S.clearAll());
    }
  });
  $("upgradeBtn").addEventListener("click", () => {
    if (ClipStackPay.configured) ClipStackPay.openPaymentPage();
    else $("proUnavailable").hidden = false;
  });
  $("restoreBtn").addEventListener("click", () => {
    if (ClipStackPay.configured) ClipStackPay.openLoginPage();
    else $("proUnavailable").hidden = false;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.clips) {
      state.clips = changes.clips.newValue || [];
      renderRows();
    }
  });

  // Test/debug hook.
  window.__clipstackOpt = {
    get state() {
      return state;
    },
    setPro(v) {
      state.pro = v;
      applyProUI();
      renderSettings();
    }
  };
  window.__csOptReady = true;
}

init();
