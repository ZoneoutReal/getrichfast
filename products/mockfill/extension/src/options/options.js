// MockFill options: persists settings to chrome.storage.local (read by the
// injected runner) and gates Pro controls on ExtPay status.
const $ = (id) => document.getElementById(id);

const DEFAULTS = {
  emailDomain: "example.com",
  checkAllBoxes: false,
  cardBrand: "visa",
  fillCards: false,
  seedEnabled: false,
  seed: "",
  customRules: [],
  pro: false
};

const PRESETS = ["email", "phone", "fullName", "firstName", "lastName", "username", "password", "company", "streetAddress", "city", "state", "zip", "country", "url", "sentence", "paragraph", "number", "date"];

let settings = { ...DEFAULTS };
let pro = false;

function showSaved() {
  const t = $("savedToast");
  t.hidden = false;
  clearTimeout(showSaved._t);
  showSaved._t = setTimeout(() => (t.hidden = true), 1200);
}

async function save() {
  settings.pro = pro;
  await chrome.storage.local.set({ settings });
  showSaved();
}

function ruleRow(rule, idx) {
  const tr = document.createElement("tr");

  const tdPat = document.createElement("td");
  const pat = document.createElement("input");
  pat.value = rule.pattern || "";
  pat.placeholder = "e.g. coupon|promo";
  pat.addEventListener("change", () => {
    settings.customRules[idx].pattern = pat.value;
    save();
  });
  tdPat.appendChild(pat);

  const tdAct = document.createElement("td");
  const act = document.createElement("select");
  for (const [v, label] of [["value", "Fixed value"], ["preset", "Preset"], ["skip", "Skip field"]]) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = label;
    act.appendChild(o);
  }
  act.value = rule.action || "value";
  tdAct.appendChild(act);

  const tdVal = document.createElement("td");
  const fixed = document.createElement("input");
  fixed.value = rule.value || "";
  fixed.placeholder = "value";
  const preset = document.createElement("select");
  for (const p of PRESETS) {
    const o = document.createElement("option");
    o.value = p;
    o.textContent = p;
    preset.appendChild(o);
  }
  preset.value = rule.preset || "email";
  const syncValCell = () => {
    tdVal.textContent = "";
    if (act.value === "value") tdVal.appendChild(fixed);
    else if (act.value === "preset") tdVal.appendChild(preset);
    else tdVal.textContent = "—";
  };
  syncValCell();
  act.addEventListener("change", () => {
    settings.customRules[idx].action = act.value;
    syncValCell();
    save();
  });
  fixed.addEventListener("change", () => {
    settings.customRules[idx].value = fixed.value;
    save();
  });
  preset.addEventListener("change", () => {
    settings.customRules[idx].preset = preset.value;
    save();
  });

  const tdDel = document.createElement("td");
  const del = document.createElement("button");
  del.className = "del";
  del.textContent = "✕";
  del.title = "Delete rule";
  del.addEventListener("click", () => {
    settings.customRules.splice(idx, 1);
    renderRules();
    save();
  });
  tdDel.appendChild(del);

  tr.append(tdPat, tdAct, tdVal, tdDel);
  return tr;
}

function renderRules() {
  const body = $("rulesBody");
  body.textContent = "";
  settings.customRules.forEach((rule, idx) => body.appendChild(ruleRow(rule, idx)));
}

function applyProUI() {
  $("proBadge").hidden = !pro;
  $("proCard").classList.toggle("locked", !pro);
  $("proLockNote").hidden = pro;
  $("upsell").hidden = pro;
}

async function init() {
  $("price").textContent = MOCKFILL_CONFIG.PRO_PRICE_LABEL;
  $("price2").textContent = MOCKFILL_CONFIG.PRO_PRICE_LABEL;
  $("homeLink").href = MOCKFILL_CONFIG.HOMEPAGE;

  const data = await chrome.storage.local.get({ settings: DEFAULTS });
  settings = { ...DEFAULTS, ...data.settings, customRules: Array.isArray(data.settings.customRules) ? data.settings.customRules : [] };

  const status = await MockFillPay.getStatus();
  pro = !!status.paid;
  if (!MockFillPay.configured) $("proUnavailable").hidden = false;
  applyProUI();

  $("emailDomain").value = settings.emailDomain;
  $("checkAllBoxes").checked = settings.checkAllBoxes;
  $("fillCards").checked = settings.fillCards;
  $("cardBrand").value = settings.cardBrand;
  $("seedEnabled").checked = settings.seedEnabled;
  $("seed").value = settings.seed;
  renderRules();

  $("emailDomain").addEventListener("change", () => {
    settings.emailDomain = $("emailDomain").value.trim() || "example.com";
    save();
  });
  $("checkAllBoxes").addEventListener("change", () => {
    settings.checkAllBoxes = $("checkAllBoxes").checked;
    save();
  });
  $("fillCards").addEventListener("change", () => {
    settings.fillCards = $("fillCards").checked;
    save();
  });
  $("cardBrand").addEventListener("change", () => {
    settings.cardBrand = $("cardBrand").value;
    save();
  });
  $("seedEnabled").addEventListener("change", () => {
    settings.seedEnabled = $("seedEnabled").checked;
    save();
  });
  $("seed").addEventListener("change", () => {
    settings.seed = $("seed").value;
    save();
  });
  $("addRuleBtn").addEventListener("click", () => {
    settings.customRules.push({ pattern: "", action: "value", value: "", preset: "email" });
    renderRules();
    save();
  });
  $("upgradeBtn").addEventListener("click", () => {
    if (MockFillPay.configured) MockFillPay.openPaymentPage();
    else $("proUnavailable").hidden = false;
  });
  $("restoreBtn").addEventListener("click", () => {
    if (MockFillPay.configured) MockFillPay.openLoginPage();
    else $("proUnavailable").hidden = false;
  });

  // Test hook (mirrors SnipShot's pattern for the e2e suite).
  window.__mockfill = {
    get settings() {
      return settings;
    },
    get pro() {
      return pro;
    },
    setPro(v) {
      pro = v;
      applyProUI();
    }
  };
  window.__mockfillReady = true;
}

init();
