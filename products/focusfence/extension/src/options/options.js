// FocusFence options: block list + schedule CRUD, all persisted through the
// background (single rule-sync path), Pro-gated on ExtPay status.
const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg).catch(() => null);

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

let state = null;
let pro = false;

function showSaved() {
  const t = $("savedToast");
  t.hidden = false;
  clearTimeout(showSaved._t);
  showSaved._t = setTimeout(() => (t.hidden = true), 1200);
}

async function patch(p) {
  const res = await send({ type: "set-state", patch: p });
  if (res && !res.ok && res.error === "strict-mode") {
    $("strictBanner").hidden = false;
    return false;
  }
  if (res && res.ok) {
    state = res.state;
    showSaved();
    return true;
  }
  return false;
}

function renderSites() {
  const list = $("siteList");
  list.textContent = "";
  const overLimit = !pro && state.sites.length > FOCUSFENCE_CONFIG.FREE_SITE_LIMIT;
  $("countNote").textContent = pro ? `— ${state.sites.length} site${state.sites.length === 1 ? "" : "s"}` : `— ${Math.min(state.sites.length, FOCUSFENCE_CONFIG.FREE_SITE_LIMIT)}/${FOCUSFENCE_CONFIG.FREE_SITE_LIMIT} free${overLimit ? " (extra sites need Pro)" : ""}`;
  state.sites.forEach((site, i) => {
    const row = document.createElement("div");
    row.className = "siteitem";
    const name = document.createElement("span");
    name.textContent = site;
    row.appendChild(name);
    if (FocusFenceRules.isProPattern(site)) {
      const tag = document.createElement("span");
      tag.className = "protag";
      tag.textContent = "PATH · PRO";
      row.appendChild(tag);
    } else if (!pro && i >= FOCUSFENCE_CONFIG.FREE_SITE_LIMIT) {
      const tag = document.createElement("span");
      tag.className = "protag";
      tag.textContent = "OVER FREE LIMIT";
      row.appendChild(tag);
    }
    const del = document.createElement("button");
    del.textContent = "✕";
    del.title = "Remove";
    del.addEventListener("click", async () => {
      if (await patch({ sites: state.sites.filter((s) => s !== site) })) renderSites();
    });
    row.appendChild(del);
    list.appendChild(row);
  });
}

function schedRow(sched, idx) {
  const row = document.createElement("div");
  row.className = "schedrow";
  const days = document.createElement("div");
  days.className = "days";
  for (let d = 0; d < 7; d++) {
    const b = document.createElement("button");
    b.className = "day" + (sched.days.includes(d) ? " on" : "");
    b.textContent = DAY_LABELS[d];
    b.addEventListener("click", async () => {
      const next = sched.days.includes(d) ? sched.days.filter((x) => x !== d) : [...sched.days, d].sort();
      const schedules = state.schedules.map((s, i) => (i === idx ? { ...s, days: next } : s));
      if (await patch({ schedules })) renderSchedules();
    });
    days.appendChild(b);
  }
  row.appendChild(days);

  const start = document.createElement("input");
  start.type = "time";
  start.value = sched.start;
  start.addEventListener("change", async () => {
    const schedules = state.schedules.map((s, i) => (i === idx ? { ...s, start: start.value } : s));
    await patch({ schedules });
  });
  const dash = document.createElement("span");
  dash.textContent = "–";
  const end = document.createElement("input");
  end.type = "time";
  end.value = sched.end;
  end.addEventListener("change", async () => {
    const schedules = state.schedules.map((s, i) => (i === idx ? { ...s, end: end.value } : s));
    await patch({ schedules });
  });
  row.append(start, dash, end);

  const del = document.createElement("button");
  del.className = "del";
  del.textContent = "✕";
  del.addEventListener("click", async () => {
    if (await patch({ schedules: state.schedules.filter((_, i) => i !== idx) })) renderSchedules();
  });
  row.appendChild(del);
  return row;
}

function renderSchedules() {
  const list = $("schedList");
  list.textContent = "";
  (state.schedules || []).forEach((s, i) => list.appendChild(schedRow(s, i)));
}

function applyProUI() {
  $("proBadge").hidden = !pro;
  $("proCard").classList.toggle("locked", !pro);
  $("proLockNote").hidden = pro;
  $("upsell").hidden = pro;
}

async function init() {
  $("price").textContent = FOCUSFENCE_CONFIG.PRO_PRICE_LABEL;
  $("price2").textContent = FOCUSFENCE_CONFIG.PRO_PRICE_LABEL;
  $("homeLink").href = FOCUSFENCE_CONFIG.HOMEPAGE;

  const status = await FocusFencePay.getStatus();
  pro = !!status.paid;
  if (!FocusFencePay.configured) $("proUnavailable").hidden = false;
  applyProUI();

  const res = await send({ type: "get-state" });
  if (!res || !res.ok) return;
  state = res.state;
  if (!!state.pro !== pro) {
    await send({ type: "set-state", patch: { pro }, allowInStrict: true });
    state.pro = pro;
  }

  const strictNow = state.strict && state.session && state.session.endsAt > Date.now();
  $("strictBanner").hidden = !strictNow;

  $("alwaysOn").checked = state.alwaysOn;
  $("strict").checked = state.strict;
  $("blockMessage").value = state.blockMessage || "";
  renderSites();
  renderSchedules();

  $("addBtn").addEventListener("click", async () => {
    const raw = $("siteInput").value.trim();
    $("addErr").hidden = true;
    const parsed = FocusFenceRules.parsePattern(raw);
    if (!parsed) {
      $("addErr").hidden = false;
      $("addErr").textContent = `"${raw}" doesn't look like a site — try something like facebook.com`;
      return;
    }
    if (FocusFenceRules.isProPattern(raw) && !pro) {
      $("addErr").hidden = false;
      $("addErr").textContent = "Path patterns (like reddit.com/r/all) are a Pro feature — whole domains are free.";
      return;
    }
    if (!pro && state.sites.length >= FOCUSFENCE_CONFIG.FREE_SITE_LIMIT) {
      $("addErr").hidden = false;
      $("addErr").textContent = `The free tier fences ${FOCUSFENCE_CONFIG.FREE_SITE_LIMIT} sites — Pro removes the limit.`;
      return;
    }
    if (state.sites.includes(raw)) return;
    if (await patch({ sites: [...state.sites, raw] })) {
      $("siteInput").value = "";
      renderSites();
    }
  });
  $("siteInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("addBtn").click();
  });

  $("alwaysOn").addEventListener("change", () => patch({ alwaysOn: $("alwaysOn").checked }));
  $("strict").addEventListener("change", () => patch({ strict: $("strict").checked }));
  $("blockMessage").addEventListener("change", () => patch({ blockMessage: $("blockMessage").value }));
  $("addSchedBtn").addEventListener("click", async () => {
    const schedules = [...(state.schedules || []), { days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" }];
    if (await patch({ schedules })) renderSchedules();
  });
  $("upgradeBtn").addEventListener("click", () => {
    if (FocusFencePay.configured) FocusFencePay.openPaymentPage();
    else $("proUnavailable").hidden = false;
  });
  $("restoreBtn").addEventListener("click", () => {
    if (FocusFencePay.configured) FocusFencePay.openLoginPage();
    else $("proUnavailable").hidden = false;
  });

  window.__focusfence = {
    get state() {
      return state;
    },
    get pro() {
      return pro;
    },
    setPro(v) {
      pro = v;
      applyProUI();
      renderSites();
    }
  };
  window.__ffReady = true;
}

init();
