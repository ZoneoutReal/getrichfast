// ClipStack popup: search the local history, click a clip to copy it back to
// the clipboard, pin favorites, delete. Keyboard: ↑/↓ to move, Enter to copy.
const $ = (id) => document.getElementById(id);
const S = ClipStackStore;

const state = { clips: [], pro: false, paused: false, query: "", view: [], active: 0 };

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 1400);
}

async function readState() {
  const { clips, settings } = await chrome.storage.local.get({ clips: [], settings: {} });
  state.clips = Array.isArray(clips) ? clips : [];
  state.paused = !!settings.paused;
}

async function persist(nextClips) {
  state.clips = nextClips;
  await chrome.storage.local.set({ clips: nextClips });
  render();
}

// Copy a clip's payload back to the system clipboard. writeText is the primary
// path (and what the tests observe); execCommand is the fallback for the rare
// context where the async Clipboard API is unavailable.
async function copyBack(entry) {
  if (entry.kind === "image" && entry.image) {
    try {
      const blob = await (await fetch(entry.image)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      toast("Image copied");
    } catch {
      toast("Couldn't copy image");
    }
    return;
  }
  const text = entry.text || "";
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied");
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      toast("Copied");
    } catch {
      toast("Clipboard write failed");
    }
  }
}

function clipRow(entry, index) {
  const row = document.createElement("div");
  row.className = "clip" + (entry.pinned ? " pinned" : "") + (index === state.active ? " active" : "");
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
    body.textContent = S.preview(entry.text);
    row.appendChild(body);
  }

  const meta = document.createElement("div");
  meta.className = "meta";
  const host = document.createElement("span");
  host.textContent = entry.host || "local";
  const dot = document.createElement("span");
  dot.className = "dot";
  dot.textContent = "·";
  const time = document.createElement("span");
  time.textContent = S.timeAgo(entry.at);
  meta.append(host, dot, time);
  row.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "actions";
  const pin = document.createElement("button");
  pin.className = "iconbtn pin" + (entry.pinned ? " on" : "");
  pin.title = entry.pinned ? "Unpin" : "Pin";
  pin.textContent = entry.pinned ? "★" : "☆";
  pin.addEventListener("click", (e) => {
    e.stopPropagation();
    persist(S.togglePin(state.clips, entry.id));
  });
  const del = document.createElement("button");
  del.className = "iconbtn del";
  del.title = "Delete";
  del.textContent = "✕";
  del.addEventListener("click", (e) => {
    e.stopPropagation();
    persist(S.remove(state.clips, entry.id));
  });
  actions.append(pin, del);
  row.appendChild(actions);

  row.addEventListener("click", () => {
    state.active = index;
    copyBack(entry);
  });
  return row;
}

function render() {
  state.view = S.ordered(S.search(state.clips, state.query));
  if (state.active >= state.view.length) state.active = Math.max(0, state.view.length - 1);

  const list = $("list");
  list.textContent = "";
  state.view.forEach((entry, i) => list.appendChild(clipRow(entry, i)));

  const has = state.view.length > 0;
  $("list").hidden = !has;
  $("empty").hidden = has || !!state.query;
  if (!has && state.query) {
    $("empty").hidden = false;
    $("empty").querySelector(".emptybig").textContent = "No matches";
    $("empty").querySelector(".emptysub").textContent = `Nothing in your history matches "${state.query}".`;
  }

  const c = S.counts(state.clips);
  $("count").textContent = c.total ? `${c.total} clip${c.total === 1 ? "" : "s"}${c.pinned ? ` · ${c.pinned} pinned` : ""}` : "";
  $("pausedNote").hidden = !state.paused;

  window.__csReady = true;
}

function moveActive(delta) {
  if (!state.view.length) return;
  state.active = (state.active + delta + state.view.length) % state.view.length;
  const rows = $("list").querySelectorAll(".clip");
  rows.forEach((r, i) => r.classList.toggle("active", i === state.active));
  const el = rows[state.active];
  if (el) el.scrollIntoView({ block: "nearest" });
}

async function addSelection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    const res = await chrome.tabs.sendMessage(tab.id, { type: "grab-selection" }).catch(() => null);
    if (!res || !res.ok || !res.text.trim()) {
      toast("Select some text on the page first");
      return;
    }
    const stored = await chrome.runtime.sendMessage({ type: "clip", text: res.text, host: res.host }).catch(() => null);
    if (stored && stored.ok) {
      await readState();
      render();
      toast("Added to history");
    } else {
      toast(stored && stored.reason === "ignored" ? "This site is on your ignore list" : "Couldn't add selection");
    }
  } catch {
    toast("Couldn't read this page");
  }
}

async function init() {
  $("price").textContent = CLIPSTACK_CONFIG.PRO_PRICE_LABEL;
  const optionsURL = chrome.runtime.getURL("src/options/options.html");
  $("manageLink").href = optionsURL;
  $("pausedManage").href = optionsURL;

  const status = await ClipStackPay.getStatus();
  state.pro = !!status.paid;
  document.body.classList.toggle("is-pro", state.pro);
  $("proBadge").hidden = !state.pro;
  $("upgradeBtn").hidden = !status.configured || status.paid;

  // Cache Pro status where the background can read it without calling ExtPay.
  const { settings } = await chrome.storage.local.get({ settings: {} });
  if (!!settings.pro !== state.pro) {
    await chrome.storage.local.set({ settings: { ...settings, pro: state.pro } });
  }

  await readState();
  render();

  $("search").addEventListener("input", () => {
    state.query = $("search").value;
    state.active = 0;
    render();
  });
  $("addSel").addEventListener("click", addSelection);
  $("upgradeBtn").addEventListener("click", () => ClipStackPay.openPaymentPage());
  $("resumeLink").addEventListener("click", async (e) => {
    e.preventDefault();
    const { settings: s } = await chrome.storage.local.get({ settings: {} });
    await chrome.storage.local.set({ settings: { ...s, paused: false } });
    state.paused = false;
    render();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === "Enter") {
      const entry = state.view[state.active];
      if (entry) {
        e.preventDefault();
        copyBack(entry);
      }
    }
  });

  // Reflect captures/edits that happen while the popup is open.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.clips) {
      state.clips = changes.clips.newValue || [];
      render();
    }
  });
}

init();
