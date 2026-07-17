// CopyMark popup. The popup owns focus while open, so all clipboard writes
// for popup-initiated copies happen HERE via navigator.clipboard.
const $ = (id) => document.getElementById(id);

const state = { tab: null, pro: false };

function show(msg, ok = true) {
  const out = $("result");
  out.hidden = false;
  out.textContent = msg;
  out.style.opacity = ok ? 1 : 0.85;
}

async function writeClipboard(md) {
  try {
    await navigator.clipboard.writeText(md);
    return true;
  } catch {
    return false;
  }
}

async function doCapture(action) {
  if (!state.tab) return;
  const res = await chrome.runtime.sendMessage({ type: "capture", tabId: state.tab.id, action }).catch(() => null);
  if (!res || !res.ok) {
    if (res && res.reason === "no-selection") show("Select some text on the page first.", false);
    else show("Couldn't read this page — Chrome blocks extensions here.", false);
    return;
  }
  const ok = await writeClipboard(res.md);
  show(ok ? `✓ Copied ${res.chars.toLocaleString()} characters of Markdown.` : "Clipboard write failed — click the page and try the shortcut.", ok);
}

async function doTabs() {
  const res = await chrome.runtime.sendMessage({ type: "tabs-markdown" }).catch(() => null);
  if (!res || !res.ok) {
    show("Couldn't list tabs.", false);
    return;
  }
  const ok = await writeClipboard(res.md);
  show(ok ? `✓ Copied ${res.md.split("\n").filter(Boolean).length} tab links as Markdown.` : "Clipboard write failed.", ok);
}

function gate(fn) {
  return () => {
    if (!state.pro) {
      if (CopyMarkPay.configured) CopyMarkPay.openPaymentPage();
      else show(`This is a Pro feature (${COPYMARK_CONFIG.PRO_PRICE_LABEL}) — not purchasable in this build yet.`, false);
      return;
    }
    fn();
  };
}

async function init() {
  $("price").textContent = COPYMARK_CONFIG.PRO_PRICE_LABEL;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tab = tab || null;
  const restricted = !/^(https?|file):/.test((tab && tab.url) || "");
  if (restricted) {
    $("selBtn").disabled = true;
    $("linkBtn").disabled = true;
    $("pageBtn").disabled = true;
    $("restricted").hidden = false;
  }

  const status = await CopyMarkPay.getStatus();
  state.pro = status.paid;
  $("proBadge").hidden = !status.paid;
  $("upgradeBtn").hidden = !status.configured || status.paid;
  document.querySelectorAll("[data-protag]").forEach((el) => el.classList.toggle("owned", status.paid));

  // Cache pro for the background pipeline (it can't call ExtPay per-invoke).
  const { settings } = await chrome.storage.local.get({ settings: {} });
  if (!!settings.pro !== status.paid) {
    await chrome.storage.local.set({ settings: { ...settings, pro: status.paid } });
  }

  $("selBtn").addEventListener("click", () => doCapture("selection"));
  $("linkBtn").addEventListener("click", () => doCapture("link"));
  $("pageBtn").addEventListener("click", gate(() => doCapture("page")));
  $("tabsBtn").addEventListener("click", gate(doTabs));
  $("optionsBtn").addEventListener("click", () => chrome.runtime.openOptionsPage());
  $("upgradeBtn").addEventListener("click", () => CopyMarkPay.openPaymentPage());

  window.__copymarkReady = true;
}

init();
