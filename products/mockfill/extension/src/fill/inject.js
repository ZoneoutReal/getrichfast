// MockFill page runner: injected (after config.js + engine.js) by the
// background worker or popup via chrome.scripting. Reads settings, fills the
// document, and shows a small confirmation toast. Safe to inject repeatedly.
(() => {
  function toast(text) {
    try {
      const id = "__mockfill_toast";
      document.getElementById(id)?.remove();
      const el = document.createElement("div");
      el.id = id;
      el.textContent = text;
      el.style.cssText =
        "position:fixed;z-index:2147483647;right:16px;bottom:16px;" +
        "background:#16182d;color:#fff;font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;" +
        "padding:10px 14px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25);" +
        "opacity:0;transition:opacity .15s ease";
      document.documentElement.appendChild(el);
      requestAnimationFrame(() => (el.style.opacity = "1"));
      setTimeout(() => {
        el.style.opacity = "0";
        setTimeout(() => el.remove(), 300);
      }, 1800);
    } catch {
      /* toast is cosmetic — never fail the fill over it */
    }
  }

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

  function run(settings) {
    const result = globalThis.MockFillEngine.fillDocument(document, settings);
    if (window === window.top) {
      toast(result.filled === 0 ? "MockFill: no fillable fields here" : `MockFill: filled ${result.filled} field${result.filled === 1 ? "" : "s"}`);
    }
    return result;
  }

  // In the real extension, settings live in chrome.storage.local (written by
  // the options page; `pro` is cached there by pages that check ExtPay).
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local && chrome.runtime && chrome.runtime.id) {
    return new Promise((resolve) => {
      chrome.storage.local.get({ settings: DEFAULTS }, (data) => {
        resolve(run({ ...DEFAULTS, ...data.settings }));
      });
    });
  }
  // Harness fallback: settings provided by the test page.
  return run({ ...DEFAULTS, ...(globalThis.__mockfillSettings || {}) });
})();
