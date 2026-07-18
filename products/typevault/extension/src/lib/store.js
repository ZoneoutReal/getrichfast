// TypeVault versioning logic. Pure functions over plain objects — no chrome.*,
// no DOM — so the content script, the popup/options pages, AND the Node test
// harness all load the same code (the IIFE assigns globalThis.TypeVaultStore).
//
// Shapes:
//   version = { text, at, len }
//   field   = { origin, path, label, signature, versions[], lastEdited }
//   store   = { [signature]: field }
(function () {
  "use strict";

  // Collapse whitespace so caret churn / trailing spaces don't look like edits.
  function normalize(text) {
    return String(text == null ? "" : text).replace(/\s+/g, " ").trim();
  }

  // Is nextText a meaningful change from prevText worth snapshotting? Ignores
  // pure whitespace differences and no-op edits, and never snaps empty content.
  function changedEnough(prevText, nextText) {
    const next = normalize(nextText);
    if (!next) return false;
    return normalize(prevText) !== next;
  }

  // djb2 → unsigned base-36. Small, stable, dependency-free.
  function hashStr(str) {
    let h = 5381;
    const s = String(str == null ? "" : str);
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  // Stable key for a field across reloads: origin + path + a field-local key
  // (name / id / placeholder / DOM position). The same field on the same page
  // always maps to the same signature, so its versions accrete in one place
  // instead of fragmenting into a new entry on every visit.
  function fieldSignature(origin, path, fieldKey) {
    return "f_" + hashStr([origin || "", path || "", fieldKey || ""].join("\n"));
  }

  function latest(field) {
    return field && field.versions && field.versions.length
      ? field.versions[field.versions.length - 1]
      : null;
  }

  // Trim a field's version list to the newest `cap` (in place). Returns field.
  function pruneField(field, cap) {
    const max = Math.max(1, cap | 0);
    if (field && Array.isArray(field.versions) && field.versions.length > max) {
      field.versions.splice(0, field.versions.length - max);
    }
    return field;
  }

  // Append a version to a field, deduping against the latest snapshot and
  // capping the list length. `version` = { text, at, len }.
  // Returns { field, added } — added=false when the edit wasn't meaningful.
  function addVersion(field, version, cap) {
    const f = field || { versions: [] };
    if (!Array.isArray(f.versions)) f.versions = [];
    const prev = latest(f);
    if (prev && !changedEnough(prev.text, version.text)) {
      return { field: f, added: false };
    }
    const text = String(version.text == null ? "" : version.text);
    const at = version.at || Date.now();
    f.versions.push({ text, at, len: version.len != null ? version.len : text.length });
    pruneField(f, cap);
    f.lastEdited = at;
    return { field: f, added: true };
  }

  // Keep the whole store under a field budget by dropping the least-recently
  // edited fields (so active drafts survive and abandoned ones age out).
  // Mutates and returns the store.
  function pruneAll(store, maxFields) {
    const max = Math.max(1, maxFields | 0);
    const keys = Object.keys(store || {});
    if (keys.length <= max) return store;
    keys
      .sort((a, b) => (store[a].lastEdited || 0) - (store[b].lastEdited || 0))
      .slice(0, keys.length - max)
      .forEach((k) => delete store[k]);
    return store;
  }

  const api = {
    normalize,
    changedEnough,
    hashStr,
    fieldSignature,
    latest,
    pruneField,
    addVersion,
    pruneAll
  };
  if (typeof globalThis !== "undefined") globalThis.TypeVaultStore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
