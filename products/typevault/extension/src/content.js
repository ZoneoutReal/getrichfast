// TypeVault content script.
// Watches every text input, textarea, and contenteditable on the page and
// saves debounced, versioned snapshots of what the user types to
// chrome.storage.local — keyed by origin+path+a stable field signature — so a
// cleared form or a crashed tab never loses the draft. Password fields and
// very short scraps are ignored. Everything is on-device; nothing is sent
// anywhere. TypeVaultStore (loaded alongside this file) holds the pure
// versioning logic.
(() => {
  "use strict";

  const S = globalThis.TypeVaultStore;
  const DEBOUNCE_MS = 800;
  const DEFAULTS = { retention: 20, minLen: 15, pausedSites: [], globalPause: false };
  const MAX_FIELDS = 60; // global budget across all origins
  const TEXT_CAP = 20000; // per-version text length ceiling (storage safety)
  const INPUT_TYPES = ["text", "search", "email", "url", "tel", "number", ""];

  const state = { settings: Object.assign({}, DEFAULTS) };
  const timers = new Map(); // signature -> debounce timeout
  const elBySig = new Map(); // signature -> live element (for restore)

  // Guards our own programmatic mutations so the synthetic input events they
  // fire don't re-enter the capture handler.
  let suppress = false;
  // Serializes storage writes so concurrent field flushes don't clobber.
  let writeChain = Promise.resolve();

  const host = location.hostname.replace(/^www\./, "");
  const origin = location.origin;
  const pathKey = location.pathname || "/";

  // --------------------------------------------------------------- settings

  function loadSettings() {
    try {
      chrome.storage.local.get({ settings: DEFAULTS }, (data) => {
        if (chrome.runtime.lastError) return;
        state.settings = Object.assign({}, DEFAULTS, data && data.settings);
      });
    } catch {
      /* extension context torn down */
    }
  }

  function sitePaused() {
    const s = state.settings;
    if (s.globalPause) return true;
    return Array.isArray(s.pausedSites) && s.pausedSites.includes(host);
  }

  // --------------------------------------------------------------- field id

  function kindOf(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el instanceof HTMLTextAreaElement) return el.readOnly || el.disabled ? null : "textarea";
    if (el instanceof HTMLInputElement) {
      const type = (el.type || "text").toLowerCase();
      if (type === "password") return null; // never capture secrets
      if (!INPUT_TYPES.includes(type)) return null;
      return el.readOnly || el.disabled ? null : "input";
    }
    if (el.isContentEditable) return "editable";
    return null;
  }

  function readText(el, kind) {
    if (kind === "editable") return el.innerText != null ? el.innerText : el.textContent || "";
    return el.value || "";
  }

  function domIndex(el, kind) {
    const sel = kind === "editable" ? "[contenteditable]" : kind === "textarea" ? "textarea" : "input";
    const list = Array.prototype.slice.call(document.querySelectorAll(sel));
    const i = list.indexOf(el);
    return i < 0 ? 0 : i;
  }

  function attr(el, name) {
    return (el.getAttribute && el.getAttribute(name)) || "";
  }

  // A field-local key that is as stable as the page allows: prefer explicit
  // identity (name/id/aria/placeholder), fall back to DOM position.
  function fieldKeyFor(el, kind) {
    const parts = [];
    if (el.name) parts.push("n=" + el.name);
    if (el.id) parts.push("i=" + el.id);
    const aria = attr(el, "aria-label");
    if (aria) parts.push("a=" + aria);
    const ph = el.placeholder || attr(el, "placeholder");
    if (ph) parts.push("p=" + ph);
    if (!parts.length) parts.push("idx=" + domIndex(el, kind));
    return kind + "|" + parts.join("|");
  }

  function clean(str) {
    const s = String(str || "").replace(/\s+/g, " ").trim();
    return s.length > 80 ? s.slice(0, 79) + "…" : s;
  }

  function kindLabel(kind) {
    return kind === "editable" ? "Rich text field" : kind === "textarea" ? "Text area" : "Text field";
  }

  function labelFor(el, kind) {
    try {
      if (el.id && window.CSS && CSS.escape) {
        const lab = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (lab && lab.textContent.trim()) return clean(lab.textContent);
      }
      const wrap = el.closest && el.closest("label");
      if (wrap && wrap.textContent.trim()) return clean(wrap.textContent);
    } catch {
      /* bad selector — ignore */
    }
    const aria = attr(el, "aria-label");
    if (aria) return clean(aria);
    const ph = el.placeholder || attr(el, "placeholder");
    if (ph) return clean(ph);
    if (el.name) return clean(el.name);
    const title = attr(el, "title");
    if (title) return clean(title);
    return kindLabel(kind);
  }

  // --------------------------------------------------------------- capture

  function scheduleCapture(el, kind) {
    const sig = S.fieldSignature(origin, pathKey, fieldKeyFor(el, kind));
    elBySig.set(sig, el);
    clearTimeout(timers.get(sig));
    timers.set(
      sig,
      setTimeout(() => {
        timers.delete(sig);
        capture(el, kind, sig);
      }, DEBOUNCE_MS)
    );
  }

  function capture(el, kind, sig) {
    if (!el || !el.isConnected) return;
    let text = readText(el, kind);
    if (text.length > TEXT_CAP) text = text.slice(0, TEXT_CAP);
    if (text.trim().length < (state.settings.minLen || DEFAULTS.minLen)) return;

    const label = labelFor(el, kind);
    const now = Date.now();
    const cap = Math.max(1, state.settings.retention || DEFAULTS.retention);

    writeChain = writeChain
      .then(
        () =>
          new Promise((resolve) => {
            chrome.storage.local.get({ vault: {} }, (data) => {
              if (chrome.runtime.lastError) return resolve();
              const vault = data.vault || {};
              const field =
                vault[sig] || { origin, host, path: pathKey, label, signature: sig, versions: [], lastEdited: 0 };
              field.label = label; // keep the freshest human label
              const { added } = S.addVersion(field, { text, at: now, len: text.length }, cap);
              if (!added) return resolve();
              vault[sig] = field;
              S.pruneAll(vault, MAX_FIELDS);
              chrome.storage.local.set({ vault }, () => resolve());
            });
          })
      )
      .catch(() => {});
  }

  function onInput(e) {
    if (suppress || !e.isTrusted) return;
    if (sitePaused()) return;
    const target = e.composedPath ? e.composedPath()[0] : e.target;
    const kind = kindOf(target);
    if (!kind) return;
    scheduleCapture(target, kind);
  }

  // --------------------------------------------------------------- restore

  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
  }

  function fireInput(el) {
    suppress = true;
    try {
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText" }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } finally {
      suppress = false;
    }
  }

  function restoreInto(el, text) {
    const kind = kindOf(el);
    if (!kind) return false;
    el.focus();
    if (kind === "editable") {
      suppress = true;
      try {
        el.textContent = text;
      } finally {
        suppress = false;
      }
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText" }));
    } else {
      // Native setter + input event so React/Vue value trackers see the change.
      setNativeValue(el, text);
      try {
        el.setSelectionRange(text.length, text.length);
      } catch {
        /* number inputs disallow selection — fine */
      }
      fireInput(el);
    }
    return true;
  }

  function toast(msg) {
    try {
      const el = document.createElement("div");
      el.textContent = msg;
      el.setAttribute(
        "style",
        "position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483647;" +
          "background:#16182d;color:#fff;padding:10px 16px;border-radius:10px;font:600 13px/1.4 " +
          "-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:80%;"
      );
      document.documentElement.appendChild(el);
      setTimeout(() => el.remove(), 2200);
    } catch {
      /* no DOM — ignore */
    }
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch {
        return false;
      }
    }
  }

  // --------------------------------------------------------------- messaging

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || !msg.type) return;

    if (msg.type === "tv-origin") {
      sendResponse({ ok: true, origin, host, path: pathKey, title: document.title || host });
      return; // sync
    }

    if (msg.type === "tv-ping") {
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "tv-restore") {
      const el = elBySig.get(msg.signature);
      if (el && el.isConnected && restoreInto(el, msg.text)) {
        sendResponse({ ok: true, restored: true });
      } else {
        copyToClipboard(msg.text).then((copied) => {
          toast(copied ? "Field not on this page — draft copied to clipboard" : "Field not found on this page");
          sendResponse({ ok: true, restored: false, copied });
        });
        return true; // async response
      }
      return;
    }
  });

  // --------------------------------------------------------------- boot

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings) loadSettings();
  });

  document.addEventListener("input", onInput, true);
  loadSettings();
})();
