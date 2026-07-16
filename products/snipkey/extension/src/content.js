// SnipKey expansion engine.
// Watches typing in inputs, textareas, and contenteditable surfaces and
// replaces "/shortcut" triggers with their snippet text. Everything runs
// against chrome.storage.local — no network, no telemetry.
(() => {
  "use strict";

  const DELIMS = [" ", "\n"];
  const FIELD_TYPES = ["text", "search", "email", "url", "tel"];

  const state = {
    settings: { prefix: "/", expandMode: "instant", enabled: true },
    triggers: new Map(), // "/shortcut" -> snippet
    pendingStats: { total: 0, byId: {} },
    statsTimer: null
  };

  // Set while we programmatically mutate a field so our own synthetic (or
  // execCommand-generated) input events don't re-enter the handler.
  let suppress = false;

  function rebuild(snippets) {
    state.triggers.clear();
    for (const sn of snippets) {
      if (sn && sn.shortcut && sn.text) state.triggers.set(state.settings.prefix + sn.shortcut, sn);
    }
  }

  function load() {
    chrome.storage.local.get({ snippets: [], settings: state.settings }, (data) => {
      state.settings = Object.assign({}, state.settings, data.settings);
      rebuild(data.snippets || []);
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.settings || changes.snippets) load();
  });

  // ---------------------------------------------------------------------
  // Matching

  function boundaryOk(text, triggerStart) {
    // Only expand at start-of-text or after whitespace, so "http://sig"
    // never fires the "/sig" trigger.
    return triggerStart === 0 || /\s/.test(text[triggerStart - 1]);
  }

  function otherTriggerExtends(trigger) {
    for (const key of state.triggers.keys()) {
      if (key !== trigger && key.startsWith(trigger)) return true;
    }
    return false;
  }

  // Returns { snippet, trigger, delim } or null. `textBefore` is everything
  // up to the caret in the current text node/field.
  function findMatch(textBefore) {
    let best = null;
    const consider = (trigger, snippet, delim) => {
      const len = trigger.length + delim.length;
      if (!best || len > best.len) best = { trigger, snippet, delim, len };
    };
    const last = textBefore.slice(-1);
    for (const [trigger, snippet] of state.triggers) {
      if (
        state.settings.expandMode === "instant" &&
        textBefore.endsWith(trigger) &&
        boundaryOk(textBefore, textBefore.length - trigger.length) &&
        !otherTriggerExtends(trigger) // "/ad" defers to "/addr" until a delimiter resolves it
      ) {
        consider(trigger, snippet, "");
      }
      if (DELIMS.includes(last)) {
        const beforeDelim = textBefore.slice(0, -1);
        if (
          beforeDelim.endsWith(trigger) &&
          boundaryOk(beforeDelim, beforeDelim.length - trigger.length)
        ) {
          consider(trigger, snippet, last);
        }
      }
    }
    return best;
  }

  // ---------------------------------------------------------------------
  // Rendering: dynamic placeholders

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function fmtDate(d) {
    return d.toLocaleDateString();
  }

  function fmtTime(d) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Supported: {date}, {date+N}, {date-N}, {time}, {datetime}, {cursor}
  function render(snippet) {
    const now = new Date();
    let text = snippet.text
      .replace(/\{date([+-]\d{1,3})?\}/g, (_, off) => {
        const d = new Date(now);
        if (off) d.setDate(d.getDate() + parseInt(off, 10));
        return fmtDate(d);
      })
      .replace(/\{datetime\}/g, () => `${fmtDate(now)} ${fmtTime(now)}`)
      .replace(/\{time\}/g, () => fmtTime(now));
    let cursorOffset = text.indexOf("{cursor}");
    if (cursorOffset !== -1) {
      text = text.slice(0, cursorOffset) + text.slice(cursorOffset + "{cursor}".length);
    }
    return { text, cursorOffset };
  }

  // ---------------------------------------------------------------------
  // Replacement

  function setNativeValue(el, value) {
    // Go through the prototype setter so frameworks with instance-level
    // value trackers (React) see the change when the input event fires.
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  }

  function fireInput(el) {
    suppress = true;
    try {
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    } finally {
      suppress = false;
    }
  }

  function replaceInField(el, match) {
    const caret = el.selectionStart;
    const consumed = match.trigger.length + match.delim.length;
    const start = caret - consumed;
    if (start < 0) return;
    const { text, cursorOffset } = render(match.snippet);
    const insert = text + match.delim;
    setNativeValue(el, el.value.slice(0, start) + insert + el.value.slice(caret));
    const pos = cursorOffset >= 0 ? start + cursorOffset : start + insert.length;
    el.setSelectionRange(pos, pos);
    fireInput(el);
    // A framework re-render can move the caret; put it back.
    el.setSelectionRange(pos, pos);
    recordUse(match.snippet);
  }

  function replaceInEditable(match) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const consumed = match.trigger.length + match.delim.length;
    if (range.startOffset < consumed) return;
    const target = document.createRange();
    target.setStart(node, range.startOffset - consumed);
    target.setEnd(node, range.startOffset);
    sel.removeAllRanges();
    sel.addRange(target);
    const { text } = render(match.snippet);
    suppress = true;
    try {
      // execCommand emits the composed input events rich editors
      // (Gmail, ProseMirror, Slate) rely on to sync their models.
      document.execCommand("insertText", false, text + match.delim);
    } finally {
      suppress = false;
    }
    recordUse(match.snippet);
  }

  // ---------------------------------------------------------------------
  // Usage stats (local only), debounced

  function recordUse(snippet) {
    state.pendingStats.total++;
    state.pendingStats.byId[snippet.id] = (state.pendingStats.byId[snippet.id] || 0) + 1;
    clearTimeout(state.statsTimer);
    state.statsTimer = setTimeout(flushStats, 500);
  }

  function flushStats() {
    const pending = state.pendingStats;
    state.pendingStats = { total: 0, byId: {} };
    chrome.storage.local.get({ stats: { total: 0, byId: {} } }, ({ stats }) => {
      stats.total += pending.total;
      for (const [id, n] of Object.entries(pending.byId)) {
        stats.byId[id] = (stats.byId[id] || 0) + n;
      }
      chrome.storage.local.set({ stats });
    });
  }

  // ---------------------------------------------------------------------
  // Event wiring

  function isTextField(el) {
    if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
    if (el instanceof HTMLInputElement) {
      return FIELD_TYPES.includes(el.type) && !el.readOnly && !el.disabled;
    }
    return false;
  }

  function onInput(e) {
    if (suppress || e.isComposing || !e.isTrusted) return;
    if (!state.settings.enabled || state.triggers.size === 0) return;
    const target = e.composedPath ? e.composedPath()[0] : e.target;
    if (!(target instanceof Element)) return;

    if (isTextField(target)) {
      if (target.selectionStart === null || target.selectionStart !== target.selectionEnd) return;
      const match = findMatch(target.value.slice(0, target.selectionStart));
      if (match) replaceInField(target, match);
      return;
    }

    if (target.isContentEditable) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      if (range.startContainer.nodeType !== Node.TEXT_NODE) return;
      const textBefore = range.startContainer.textContent.slice(0, range.startOffset);
      const match = findMatch(textBefore);
      if (match) replaceInEditable(match);
    }
  }

  document.addEventListener("input", onInput, true);
  load();
})();
