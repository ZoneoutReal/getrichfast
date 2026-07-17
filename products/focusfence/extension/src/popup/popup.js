// FocusFence popup: session control + quick block-list management. All state
// changes go through the background so rule-sync stays in one place.
const $ = (id) => document.getElementById(id);

let state = null;
let countdownTimer = null;

const send = (msg) => chrome.runtime.sendMessage(msg).catch(() => null);

function renderCountdown() {
  clearInterval(countdownTimer);
  const tick = () => {
    if (!state.session) return;
    const ms = state.session.endsAt - Date.now();
    if (ms <= 0) {
      refresh();
      return;
    }
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    $("countdown").textContent = `${m}:${String(s).padStart(2, "0")}`;
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

function render(active) {
  const sessionRunning = state.session && state.session.endsAt > Date.now();
  $("statusDot").className = `dot ${active ? "on" : "off"}`;
  $("sessionBox").hidden = !sessionRunning;
  $("startBox").hidden = !!sessionRunning;
  if (sessionRunning) {
    renderCountdown();
    $("strictNote").hidden = !state.strict;
    $("endBtn").hidden = state.strict;
  }
  $("alwaysOn").checked = state.alwaysOn;

  const limit = state.pro ? Infinity : FOCUSFENCE_CONFIG.FREE_SITE_LIMIT;
  $("count").textContent = state.pro ? `(${state.sites.length})` : `(${state.sites.length}/${FOCUSFENCE_CONFIG.FREE_SITE_LIMIT} free)`;

  const list = $("sites");
  list.textContent = "";
  for (const site of state.sites) {
    const row = document.createElement("div");
    row.className = "siteitem";
    const name = document.createElement("span");
    name.textContent = site;
    row.appendChild(name);
    const del = document.createElement("button");
    del.textContent = "✕";
    del.title = "Remove";
    del.addEventListener("click", async () => {
      const res = await send({ type: "set-state", patch: { sites: state.sites.filter((s) => s !== site) } });
      if (res && !res.ok && res.error === "strict-mode") flashStrict();
      refresh();
    });
    row.appendChild(del);
    list.appendChild(row);
  }
  window.__ffPopupReady = true;
}

function flashStrict() {
  $("strictNote").hidden = false;
  $("strictNote").textContent = "🔒 Strict mode — the list is frozen until the session ends.";
}

async function refresh() {
  const res = await send({ type: "get-state" });
  if (!res || !res.ok) return;
  state = res.state;
  render(res.active);
}

async function init() {
  $("price").textContent = FOCUSFENCE_CONFIG.PRO_PRICE_LABEL;

  const status = await FocusFencePay.getStatus();
  $("proBadge").hidden = !status.paid;
  $("upgradeBtn").hidden = !status.configured || status.paid;

  // cache pro into state for the background's gating
  const res = await send({ type: "get-state" });
  if (res && res.ok && !!res.state.pro !== status.paid) {
    await send({ type: "set-state", patch: { pro: status.paid }, allowInStrict: true });
  }

  // current tab host for quick-add (activeTab grants url access on popup open)
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && /^https?:/.test(tab.url || "")) {
    const host = new URL(tab.url).hostname.replace(/^www\./, "");
    $("siteRow").hidden = false;
    $("curHost").textContent = host;
    $("addCurrent").addEventListener("click", async () => {
      if (!state) return;
      if (state.sites.includes(host)) return;
      if (!state.pro && state.sites.length >= FOCUSFENCE_CONFIG.FREE_SITE_LIMIT) {
        if (FocusFencePay.configured) FocusFencePay.openPaymentPage();
        else $("count").textContent = `(free limit ${FOCUSFENCE_CONFIG.FREE_SITE_LIMIT} — Pro removes it)`;
        return;
      }
      const r = await send({ type: "set-state", patch: { sites: [...state.sites, host] } });
      if (r && !r.ok && r.error === "strict-mode") flashStrict();
      refresh();
    });
  }

  document.querySelectorAll(".sess").forEach((btn) =>
    btn.addEventListener("click", async () => {
      await send({ type: "start-session", minutes: Number(btn.dataset.mins) });
      refresh();
    })
  );
  $("endBtn").addEventListener("click", async () => {
    const r = await send({ type: "end-session" });
    if (r && !r.ok && r.error === "strict-mode") flashStrict();
    refresh();
  });
  $("alwaysOn").addEventListener("change", async () => {
    const r = await send({ type: "set-state", patch: { alwaysOn: $("alwaysOn").checked } });
    if (r && !r.ok && r.error === "strict-mode") {
      flashStrict();
      $("alwaysOn").checked = !$("alwaysOn").checked;
    }
    refresh();
  });
  $("optionsBtn").addEventListener("click", () => chrome.runtime.openOptionsPage());
  $("upgradeBtn").addEventListener("click", () => FocusFencePay.openPaymentPage());

  await refresh();
}

init();
