// JSONPeek diff: structural comparison of two JSON values. Pure functions.
// Produces a flat list of { path, kind: added|removed|changed, a, b }.
(() => {
  function isObj(v) {
    return v !== null && typeof v === "object";
  }

  function diff(a, b, path = "$", out = []) {
    if (a === b) return out;
    const aObj = isObj(a);
    const bObj = isObj(b);
    if (!aObj || !bObj || Array.isArray(a) !== Array.isArray(b)) {
      // primitive change or type change
      if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ path, kind: "changed", a, b });
      return out;
    }
    if (Array.isArray(a)) {
      const len = Math.max(a.length, b.length);
      for (let i = 0; i < len; i++) {
        const p = `${path}[${i}]`;
        if (i >= a.length) out.push({ path: p, kind: "added", b: b[i] });
        else if (i >= b.length) out.push({ path: p, kind: "removed", a: a[i] });
        else diff(a[i], b[i], p, out);
      }
      return out;
    }
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const p = `${path}.${k}`;
      if (!(k in a)) out.push({ path: p, kind: "added", b: b[k] });
      else if (!(k in b)) out.push({ path: p, kind: "removed", a: a[k] });
      else diff(a[k], b[k], p, out);
    }
    return out;
  }

  globalThis.JSONPeekDiff = { diff };
})();
