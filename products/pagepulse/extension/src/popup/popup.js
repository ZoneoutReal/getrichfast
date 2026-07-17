// PagePulse popup: set up/stop refresh jobs for the current tab, see all
// running tabs. Monitor mode requests per-origin host access on enable.
const $ = (id) => document.getElementById(id);
const T = PagePulseTiming;
const send = (msg) => chrome.runtime.sendMessage(msg).catch(() => null);

const state = { tab: null, host: "", pro: false, jobs: {}, countdownTimer: null };

function err(text) {
  $("err").hidden = !text;
  if (text) $("err").textContent = text;
}

function proNote(text) {
  $("proNote").hidden = false;
  $("proNote").textContent = text;
}

function requirePro(feature) {
  if (state.pro) return true;
  if (PagePulsePay.configured) PagePulsePay.openPaymentPage();
  else proNote(`${feature} is a Pro feature (${PAGEPULSE_CONFIG.PRO_PRICE_LABEL}) — not purchasable in this build yet.`);
  return false;
}

async function refreshJobs() {
  const res = await send({ type: "get-jobs" });
  state.jobs = res && res.ok ? res.jobs : {};
  render();
}

function render() {
  const job = state.tab ? state.jobs[state.tab.id] : null;
  $("controls").hidden = !!job;
  $("running").hidden = !job;
  clearInterval(state.countdownTimer);
  if (job) {
    $("curInterval").textContent = T.fmtInterval(job.intervalSec) + (job.jitterPct ? " ±" + job.jitterPct + "%" : "");
    const tick = () => {
      $("nextIn").textContent = T.badgeText(job.nextAt - Date.now());
      $("reloadCount").textContent = String(job.reloads || 0);
      if (job.nextAt - Date.now() < -1500) refreshJobs(); // reload happened → resync
    };
    tick();
    state.countdownTimer = setInterval(tick, 500);
  }

  const others = Object.values(state.jobs);
  $("jobsWrap").hidden = others.length === 0;
  const list = $("jobs");
  list.textContent = "";
  for (const j of others) {
    const row = document.createElement("div");
    row.className = "job";
    const host = document.createElement("span");
    host.textContent = j.host || `tab ${j.tabId}`;
    const int = document.createElement("span");
    int.className = "int";
    int.textContent = T.fmtInterval(j.intervalSec);
    const stop = document.createElement("button");
    stop.className = "stop";
    stop.textContent = "✕";
    stop.title = "Stop";
    stop.addEventListener("click", async () => {
      await send({ type: "stop", tabId: j.tabId });
      refreshJobs();
    });
    row.append(host, int, stop);
    list.appendChild(row);
  }
  window.__ppPopupReady = true;
}

async function start(intervalSec) {
  err("");
  let monitor = null;
  if ($("monitorOn").checked) {
    if (!requirePro("Change alerts")) return;
    // per-origin permission, requested inside this click's user gesture
    const origin = new URL(state.tab.url).origin + "/*";
    const granted = await chrome.permissions.request({ origins: [origin] }).catch(() => false);
    if (!granted) {
      err("Monitoring needs permission for this site — Chrome asked and it wasn't granted.");
      return;
    }
    monitor = { enabled: true, keyword: $("keyword").value.trim(), last: null };
  }
  const jitterPct = $("jitter").checked ? 20 : 0;
  if (jitterPct && !requirePro("Jitter")) return;

  await send({
    type: "start",
    tabId: state.tab.id,
    host: state.host,
    intervalSec,
    jitterPct,
    hardReload: $("hardReload").checked,
    monitor
  });
  refreshJobs();
}

async function init() {
  $("price").textContent = PAGEPULSE_CONFIG.PRO_PRICE_LABEL;
  $("homeLink").href = PAGEPULSE_CONFIG.HOMEPAGE;

  const status = await PagePulsePay.getStatus();
  state.pro = !!status.paid;
  document.body.classList.toggle("is-pro", state.pro);
  $("proBadge").hidden = !state.pro;
  $("upgradeBtn").hidden = !status.configured || status.paid;
  $("restoreBtn").hidden = !status.configured || status.paid;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tab = tab || null;
  const ok = tab && /^(https?|file):/.test(tab.url || "");
  if (!ok) {
    $("restricted").hidden = false;
    $("controls").hidden = true;
  } else {
    state.host = new URL(tab.url).hostname.replace(/^www\./, "") || "this tab";
    $("host").textContent = state.host;
  }

  // preset buttons
  const presets = $("presets");
  for (const sec of PAGEPULSE_CONFIG.FREE_PRESETS) {
    const b = document.createElement("button");
    b.className = "preset";
    b.textContent = T.fmtInterval(sec);
    b.addEventListener("click", () => start(sec));
    presets.appendChild(b);
  }

  $("customGo").addEventListener("click", () => {
    if (!requirePro("Custom intervals")) return;
    const sec = T.parseInterval($("custom").value, PAGEPULSE_CONFIG.MIN_INTERVAL);
    if (!sec) {
      err("Try something like 45s, 2m, or 1.5h (minimum 2s, max 24h).");
      return;
    }
    start(sec);
  });
  $("custom").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("customGo").click();
  });

  $("monitorOn").addEventListener("change", () => {
    $("keyword").hidden = !$("monitorOn").checked;
  });

  $("stopBtn").addEventListener("click", async () => {
    await send({ type: "stop", tabId: state.tab.id });
    refreshJobs();
  });
  $("stopAll").addEventListener("click", async () => {
    await send({ type: "stop-all" });
    refreshJobs();
  });
  $("upgradeBtn").addEventListener("click", () => PagePulsePay.openPaymentPage());
  $("restoreBtn").addEventListener("click", () => PagePulsePay.openLoginPage());

  await refreshJobs();
}

init();
