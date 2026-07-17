// JSONPeek CSV export: flattens an array of objects (or a single object)
// into RFC-4180 CSV. Pure functions, no chrome.* APIs.
(() => {
  function isObj(v) {
    return v !== null && typeof v === "object";
  }

  // {a: {b: 1}, c: [1,2]} → { "a.b": 1, "c[0]": 1, "c[1]": 2 }
  function flatten(value, prefix = "", out = {}) {
    if (!isObj(value)) {
      out[prefix || "value"] = value;
      return out;
    }
    if (Array.isArray(value)) {
      if (!value.length) out[prefix || "value"] = "[]";
      value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
      return out;
    }
    const keys = Object.keys(value);
    if (!keys.length) out[prefix || "value"] = "{}";
    for (const k of keys) flatten(value[k], prefix ? `${prefix}.${k}` : k, out);
    return out;
  }

  function cell(v) {
    if (v === null) return "null";
    if (v === undefined) return "";
    let s = typeof v === "string" ? v : JSON.stringify(v);
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  // Array of objects → one row per element, union of flattened columns in
  // first-seen order. Any other JSON → single-row CSV of its flattening.
  function toCSV(data) {
    const rows = Array.isArray(data) && data.length && data.every(isObj) && !data.some(Array.isArray) ? data.map((r) => flatten(r)) : [flatten(data)];
    const columns = [];
    for (const row of rows) for (const k of Object.keys(row)) if (!columns.includes(k)) columns.push(k);
    const lines = [columns.map(cell).join(",")];
    for (const row of rows) lines.push(columns.map((c) => cell(row[c])).join(","));
    return lines.join("\r\n") + "\r\n";
  }

  globalThis.JSONPeekCSV = { toCSV, flatten };
})();
