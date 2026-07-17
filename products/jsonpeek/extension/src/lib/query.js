// JSONPeek query engine: a JSONPath-lite. Pure functions, no chrome.* APIs.
// Supported: $.a.b, $["key with spaces"], [0], [*], wildcard .*, and
// recursive descent ..key — enough for real API-response spelunking.
(() => {
  // "$.users[0].name" | "$.users[*].id" | "$..email" | '$["odd key"].x'
  function tokenize(expr) {
    const src = String(expr || "").trim();
    if (!src || src[0] !== "$") throw new Error("Query must start with $");
    const tokens = [];
    let i = 1;
    while (i < src.length) {
      const ch = src[i];
      if (ch === ".") {
        if (src[i + 1] === ".") {
          // ..key (recursive descent)
          i += 2;
          let key = "";
          while (i < src.length && /[\w$-]/.test(src[i])) key += src[i++];
          if (!key) throw new Error("Expected key after ..");
          tokens.push({ type: "recurse", key });
        } else {
          i += 1;
          if (src[i] === "*") {
            tokens.push({ type: "wild" });
            i += 1;
            continue;
          }
          let key = "";
          while (i < src.length && /[\w$-]/.test(src[i])) key += src[i++];
          if (!key) throw new Error("Expected key after .");
          tokens.push({ type: "key", key });
        }
      } else if (ch === "[") {
        const end = findBracketEnd(src, i);
        const inner = src.slice(i + 1, end).trim();
        if (inner === "*") tokens.push({ type: "wild" });
        else if (/^-?\d+$/.test(inner)) tokens.push({ type: "index", n: parseInt(inner, 10) });
        else if (/^(['"]).*\1$/.test(inner)) tokens.push({ type: "key", key: inner.slice(1, -1) });
        else throw new Error(`Unsupported selector [${inner}]`);
        i = end + 1;
      } else {
        throw new Error(`Unexpected character "${ch}" at ${i}`);
      }
    }
    return tokens;
  }

  function findBracketEnd(src, start) {
    let quote = null;
    for (let i = start + 1; i < src.length; i++) {
      const c = src[i];
      if (quote) {
        if (c === quote && src[i - 1] !== "\\") quote = null;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === "]") return i;
    }
    throw new Error("Unclosed [");
  }

  function isObj(v) {
    return v !== null && typeof v === "object";
  }

  // Returns [{ path, value }] for all matches.
  function query(data, expr) {
    const tokens = tokenize(expr);
    let current = [{ path: "$", value: data }];
    for (const tok of tokens) {
      const next = [];
      for (const { path, value } of current) {
        if (tok.type === "key") {
          if (isObj(value) && !Array.isArray(value) && tok.key in value) {
            next.push({ path: `${path}.${tok.key}`, value: value[tok.key] });
          }
        } else if (tok.type === "index") {
          if (Array.isArray(value)) {
            const n = tok.n < 0 ? value.length + tok.n : tok.n;
            if (n >= 0 && n < value.length) next.push({ path: `${path}[${n}]`, value: value[n] });
          }
        } else if (tok.type === "wild") {
          if (Array.isArray(value)) value.forEach((v, idx) => next.push({ path: `${path}[${idx}]`, value: v }));
          else if (isObj(value)) for (const k of Object.keys(value)) next.push({ path: `${path}.${k}`, value: value[k] });
        } else if (tok.type === "recurse") {
          const stack = [{ path, value }];
          while (stack.length) {
            const cur = stack.pop();
            if (!isObj(cur.value)) continue;
            if (Array.isArray(cur.value)) {
              cur.value.forEach((v, idx) => stack.push({ path: `${cur.path}[${idx}]`, value: v }));
            } else {
              for (const k of Object.keys(cur.value)) {
                const childPath = `${cur.path}.${k}`;
                if (k === tok.key) next.push({ path: childPath, value: cur.value[k] });
                stack.push({ path: childPath, value: cur.value[k] });
              }
            }
          }
        }
      }
      current = next;
      if (!current.length) break;
    }
    return current;
  }

  globalThis.JSONPeekQuery = { query, tokenize };
})();
