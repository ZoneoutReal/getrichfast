// MockFill popup: one big fill button + status. Opening the popup counts as
// invoking the extension, so activeTab is granted for the current tab.
const $ = (id) => document.getElementById(id);

const state = { tab: null, pro: false };

async function init() {
  $("price").textContent = MOCKFILL_CONFIG.PRO_PRICE_LABEL;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tab = tab || null;
  const url = (tab && tab.url) || "";
  const restricted = !/^(https?|file):/.test(url);
  if (restricted) {
    $("fillBtn").disabled = true;
    $("restricted").hidden = false;
  }

  const status = await MockFillPay.getStatus();
  state.pro = status.paid;
  $("proBadge").hidden = !status.paid;
  $("upgradeBtn").hidden = !status.configured || status.paid;

  // Cache pro for the injected runner (it can't call ExtPay itself).
  const { settings } = await chrome.storage.local.get({ settings: {} });
  if (!!settings.pro !== status.paid) {
    await chrome.storage.local.set({ settings: { ...settings, pro: status.paid } });
  }
}

$("fillBtn").addEventListener("click", async () => {
  if (!state.tab) return;
  $("fillBtn").disabled = true;
  const res = await chrome.runtime.sendMessage({ type: "fill", tabId: state.tab.id }).catch(() => null);
  $("fillBtn").disabled = false;
  const out = $("result");
  out.hidden = false;
  if (res && res.ok) {
    out.textContent = res.filled === 0 ? "No fillable fields found on this page." : `✓ Filled ${res.filled} field${res.filled === 1 ? "" : "s"}.`;
  } else {
    out.textContent = "Couldn't fill this page — Chrome blocks extensions here.";
  }
});

$("optionsBtn").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("upgradeBtn").addEventListener("click", () => MockFillPay.openPaymentPage());

init();
