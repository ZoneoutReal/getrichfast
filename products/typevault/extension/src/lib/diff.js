// TypeVault word-level diff (LCS-based). Pure logic — no chrome.*, no DOM —
// so it runs in the content script, the popup/options pages, AND in Node for
// the test harness (the IIFE assigns globalThis.TypeVaultDiff on load).
(function () {
  "use strict";

  // Split into word + whitespace tokens, preserving both so a diff's tokens
  // concatenate back into the exact original text (lossless).
  function tokenize(text) {
    const s = String(text == null ? "" : text);
    if (!s) return [];
    return s.match(/\s+|\S+/g) || [];
  }

  // Longest-common-subsequence length table over two token arrays, filled
  // bottom-up so we can backtrack from the front. Word counts per field are
  // small (a version is a single field's text), so the full O(n·m) table is
  // fine and keeps the walk simple.
  function lcsTable(a, b) {
    const n = a.length;
    const m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    return dp;
  }

  // Word-level diff between two strings. Returns a compact op list:
  //   { type: "same" | "add" | "del", text }
  // Adjacent ops of the same type are merged. Deletes are emitted before adds
  // at a divergence so a replacement reads "old → new".
  function diffWords(oldText, newText) {
    const a = tokenize(oldText);
    const b = tokenize(newText);
    const dp = lcsTable(a, b);
    const ops = [];
    const push = (type, text) => {
      const last = ops[ops.length - 1];
      if (last && last.type === type) last.text += text;
      else ops.push({ type, text });
    };
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        push("same", a[i]);
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        push("del", a[i]);
        i++;
      } else {
        push("add", b[j]);
        j++;
      }
    }
    while (i < a.length) push("del", a[i++]);
    while (j < b.length) push("add", b[j++]);
    return ops;
  }

  // Count changed *words* (whitespace-only tokens don't count) for a summary
  // like "+8 −3".
  function diffStats(ops) {
    let added = 0;
    let removed = 0;
    for (const op of ops) {
      if (op.type === "same") continue;
      const words = (op.text.match(/\S+/g) || []).length;
      if (op.type === "add") added += words;
      else removed += words;
    }
    return { added, removed, changed: added + removed };
  }

  const api = { tokenize, diffWords, diffStats };
  if (typeof globalThis !== "undefined") globalThis.TypeVaultDiff = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
