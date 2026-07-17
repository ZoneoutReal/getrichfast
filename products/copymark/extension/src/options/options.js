// CopyMark options: persists settings to chrome.storage.local (read by the
// background pipeline) and gates Pro controls on ExtPay status.
const $ = (id) => document.getElementById(id);

const DEFAULTS = {
  bullet: "-",
  imageMode: "markdown",
  fence: "```",
  frontMatter: "",
  pro: false
};

const OBSIDIAN_PRESET = `---\ntitle: "{{title}}"\nsource: {{url}}\nclipped: {{date}}\ntags: [clipping]\n---`;

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

function applyProUI() {
  $("proBadge").hidden = !pro;
  $("proCard").classList.toggle("locked", !pro);
  $("proLockNote").hidden = pro;
  $("upsell").hidden = pro;
}

async function init() {
  $("price").textContent = COPYMARK_CONFIG.PRO_PRICE_LABEL;
  $("price2").textContent = COPYMARK_CONFIG.PRO_PRICE_LABEL;
  $("homeLink").href = COPYMARK_CONFIG.HOMEPAGE;

  const data = await chrome.storage.local.get({ settings: DEFAULTS });
  settings = { ...DEFAULTS, ...data.settings };

  const status = await CopyMarkPay.getStatus();
  pro = !!status.paid;
  if (!CopyMarkPay.configured) $("proUnavailable").hidden = false;
  applyProUI();

  $("bullet").value = settings.bullet;
  $("fence").value = settings.fence;
  $("imageMode").value = settings.imageMode;
  $("frontMatter").value = settings.frontMatter;

  for (const [id, key] of [["bullet", "bullet"], ["fence", "fence"], ["imageMode", "imageMode"], ["frontMatter", "frontMatter"]]) {
    $(id).addEventListener("change", () => {
      settings[key] = $(id).value;
      save();
    });
  }
  $("obsidianPreset").addEventListener("click", () => {
    $("frontMatter").value = OBSIDIAN_PRESET;
    settings.frontMatter = OBSIDIAN_PRESET;
    save();
  });
  $("upgradeBtn").addEventListener("click", () => {
    if (CopyMarkPay.configured) CopyMarkPay.openPaymentPage();
    else $("proUnavailable").hidden = false;
  });
  $("restoreBtn").addEventListener("click", () => {
    if (CopyMarkPay.configured) CopyMarkPay.openLoginPage();
    else $("proUnavailable").hidden = false;
  });

  window.__copymark = {
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
  window.__copymarkReady = true;
}

init();
