// ClipStack capturer.
// Listens for the browser's own copy/cut events and reads what was copied
// from the selection (or the focused field). The captured text is handed to
// the background service worker, which stores it in chrome.storage.local.
// We deliberately do NOT read the system clipboard (navigator.clipboard.
// readText) — capturing the copy EVENT is permission-light and reliable, and
// it's exactly what happens when the user presses Ctrl/Cmd+C.
(() => {
  "use strict";

  const MAX_TEXT = 100000;
  const IMG_MAX = 512 * 1024; // matches store.MAX_IMAGE_BYTES

  // Suppress duplicate captures from the same keystroke (some pages fire copy
  // more than once, and cut+input can double up).
  let last = { text: "", at: 0 };

  function host() {
    try {
      return location.hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  // The text that's actually being copied, in priority order:
  //  1) an explicit selection inside an <input>/<textarea>
  //  2) the page's DOM selection
  //  3) whatever the page put on the event's clipboardData
  function readCopiedText(e) {
    const el = e && e.target;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA") && typeof el.selectionStart === "number") {
      if (el.type === "password") return "";
      const val = el.value || "";
      const sel = val.slice(el.selectionStart, el.selectionEnd);
      if (sel) return sel;
    }
    const domSel = window.getSelection ? String(window.getSelection()) : "";
    if (domSel) return domSel;
    try {
      const cd = e && e.clipboardData;
      if (cd) return cd.getData("text/plain") || cd.getData("text") || "";
    } catch {
      /* clipboardData not readable here */
    }
    return "";
  }

  // Best-effort image clip (a Pro touch): only for inline data: images, so we
  // never taint a canvas or trip CORS. Cross-origin images are simply skipped.
  function readCopiedImage() {
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
      const frag = sel.getRangeAt(0).cloneContents();
      const img = frag.querySelector && frag.querySelector("img");
      const src = img && (img.currentSrc || img.src);
      if (src && src.startsWith("data:image/") && src.length <= IMG_MAX) {
        return { image: src, w: img.naturalWidth || 0, h: img.naturalHeight || 0 };
      }
    } catch {
      /* ignore — image capture is opportunistic */
    }
    return null;
  }

  function send(payload) {
    try {
      chrome.runtime.sendMessage(Object.assign({ type: "clip", host: host() }, payload), () => void chrome.runtime.lastError);
    } catch {
      /* extension context invalidated (reload) — ignore */
    }
  }

  function onCopy(e) {
    let text = "";
    try {
      text = readCopiedText(e);
    } catch {
      text = "";
    }
    text = (text || "").slice(0, MAX_TEXT);
    const trimmed = text.replace(/\s+/g, " ").trim();

    if (trimmed) {
      const now = Date.now();
      if (trimmed === last.text && now - last.at < 800) return; // de-dupe the same keystroke
      last = { text: trimmed, at: now };
      send({ text });
      return;
    }

    const img = readCopiedImage();
    if (img) send({ kind: "image", text: `Image ${img.w || "?"}×${img.h || "?"}`, image: img.image, w: img.w, h: img.h });
  }

  document.addEventListener("copy", onCopy, true);
  document.addEventListener("cut", onCopy, true);

  // Manual "add current selection" from the popup: it can't read the page
  // itself with our minimal permissions, so it asks the already-injected
  // content script for the live selection.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "grab-selection") {
      const text = window.getSelection ? String(window.getSelection()) : "";
      sendResponse({ ok: true, text, host: host() });
    }
  });
})();
