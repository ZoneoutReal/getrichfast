// JSONPeek viewer: parse → lazy collapsible tree, search, paths, raw view,
// and the Pro tools (query, CSV, diff). Runs as an extension page and, with
// a chrome.* stub, directly in the test harness.
const $ = (id) => document.getElementById(id);

const state = {
  text: "",
  data: undefined,
  pro: false,
  selectedPath: "$",
  view: "tree",
  searchTerm: "",
  parsed: false
};

// ---------- helpers --------------------------------------------------------
const isObj = (v) => v !== null && typeof v === "object";

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function countNodes(v) {
  let count = 1;
  if (isObj(v)) for (const k of Object.keys(v)) count += countNodes(v[k]);
  return count;
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlight(text) {
  const t = esc(text);
  if (!state.searchTerm) return t;
  const needle = state.searchTerm.toLowerCase();
  const idx = text.toLowerCase().indexOf(needle);
  if (idx === -1) return t;
  return esc(text.slice(0, idx)) + `<span class="hit">${esc(text.slice(idx, idx + needle.length))}</span>` + esc(text.slice(idx + needle.length));
}

function leafHtml(v) {
  if (typeof v === "string") return `<span class="s">"${highlight(v.length > 300 ? v.slice(0, 300) + "…" : v)}"</span>`;
  if (typeof v === "number") return `<span class="n">${highlight(String(v))}</span>`;
  if (typeof v === "boolean") return `<span class="b">${v}</span>`;
  if (v === null) return `<span class="z">null</span>`;
  return "";
}

// ---------- tree (lazy) ----------------------------------------------------
function nodeFor(key, value, path) {
  const div = document.createElement("div");
  div.className = "node";
  div.dataset.path = path;

  const row = document.createElement("span");
  row.className = "row";
  const keyHtml = key === null ? "" : `<span class="k">${highlight(String(key))}</span>: `;

  if (isObj(value)) {
    const arr = Array.isArray(value);
    const size = arr ? value.length : Object.keys(value).length;
    row.innerHTML = `<span class="caret">▶</span>${keyHtml}<span>${arr ? "[" : "{"}</span> <span class="count">${size} ${arr ? (size === 1 ? "item" : "items") : size === 1 ? "key" : "keys"}</span> <span>${arr ? "]" : "}"}</span>`;
    div.appendChild(row);
    const kids = document.createElement("div");
    kids.className = "kids";
    kids.hidden = true;
    div.appendChild(kids);
    row.addEventListener("click", () => {
      select(div);
      toggle(div, value, path);
    });
  } else {
    row.innerHTML = `<span class="caret"></span>${keyHtml}${leafHtml(value)}`;
    div.appendChild(row);
    row.addEventListener("click", () => select(div));
  }
  return div;
}

function renderKids(container, value, path) {
  const entries = Array.isArray(value) ? value.map((v, i) => [i, v, `${path}[${i}]`]) : Object.keys(value).map((k) => [k, value[k], `${path}.${k}`]);
  const MAX = 2000;
  for (const [k, v, p] of entries.slice(0, MAX)) container.appendChild(nodeFor(k, v, p));
  if (entries.length > MAX) {
    const more = document.createElement("div");
    more.className = "count";
    more.textContent = `… ${entries.length - MAX} more (use search or a query to narrow down)`;
    container.appendChild(more);
  }
}

function toggle(div, value, path, force) {
  const kids = div.querySelector(":scope > .kids");
  const caret = div.querySelector(":scope > .row > .caret");
  const open = force !== undefined ? force : kids.hidden;
  if (open && !kids.childElementCount) renderKids(kids, value, path);
  kids.hidden = !open;
  caret.classList.toggle("open", open);
}

function select(div) {
  document.querySelectorAll("#tree .row.selected").forEach((r) => r.classList.remove("selected"));
  div.querySelector(":scope > .row").classList.add("selected");
  state.selectedPath = div.dataset.path;
  $("crumb").textContent = state.selectedPath;
}

function renderTree() {
  const tree = $("tree");
  tree.textContent = "";
  const root = nodeFor(null, state.data, "$");
  tree.appendChild(root);
  if (isObj(state.data)) toggle(root, state.data, "$", true);
}

// ---------- search ---------------------------------------------------------
function valueAtPath(path) {
  if (path === "$") return state.data;
  const res = JSONPeekQuery.query(state.data, path);
  return res.length ? res[0].value : undefined;
}

function runSearch(term) {
  state.searchTerm = term.trim();
  renderTree();
  if (!state.searchTerm) return;
  // expand paths to every hit (bounded for sanity)
  const needle = state.searchTerm.toLowerCase();
  const hits = [];
  (function walk(v, path) {
    if (hits.length >= 60) return;
    if (isObj(v)) {
      const entries = Array.isArray(v) ? v.map((x, i) => [i, x]) : Object.entries(v);
      for (const [k, x] of entries) {
        const p = Array.isArray(v) ? `${path}[${k}]` : `${path}.${k}`;
        if (String(k).toLowerCase().includes(needle)) hits.push(p);
        walk(x, p);
      }
    } else if (String(v).toLowerCase().includes(needle)) hits.push(path);
  })(state.data, "$");

  for (const hit of hits) {
    // open every ancestor of the hit
    const segments = hit.match(/(\.[\w$-]+|\[\d+\])/g) || [];
    let path = "$";
    let div = document.querySelector(`#tree .node[data-path="$"]`);
    for (const seg of segments) {
      if (!div) break;
      const value = valueAtPath(path);
      if (isObj(value)) toggle(div, value, path, true);
      path += seg;
      div = div.querySelector(`:scope > .kids > .node[data-path="${CSS.escape(path)}"]`);
    }
  }
  return hits.length;
}

// ---------- pro gating -----------------------------------------------------
function requirePro() {
  if (state.pro) return true;
  $("proDialog").showModal();
  return false;
}

// ---------- views ----------------------------------------------------------
function showView(which) {
  state.view = which;
  $("tree").hidden = which !== "tree";
  $("raw").hidden = which !== "raw";
  $("queryResults").hidden = which !== "query";
  $("diffPane").hidden = which !== "diff";
  $("treeTab").classList.toggle("active", which === "tree");
  $("rawTab").classList.toggle("active", which === "raw");
  if (which === "raw" && !$("raw").textContent) $("raw").textContent = JSON.stringify(state.data, null, 2);
}

function loadText(text, sourceNote) {
  const size = new Blob([text]).size;
  if (size > JSONPEEK_CONFIG.FREE_SIZE_LIMIT && !state.pro) {
    $("inputErr").hidden = false;
    $("inputErr").textContent = `This JSON is ${fmtBytes(size)} — the free tier handles up to ${fmtBytes(JSONPEEK_CONFIG.FREE_SIZE_LIMIT)}. Pro removes the limit.`;
    $("proDialog").showModal();
    return false;
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    const m = String(e.message).match(/position (\d+)/);
    let where = "";
    if (m) {
      const pos = Number(m[1]);
      const upto = text.slice(0, pos);
      const line = upto.split("\n").length;
      const col = pos - upto.lastIndexOf("\n");
      where = ` (line ${line}, column ${col})`;
    }
    $("inputErr").hidden = false;
    $("inputErr").textContent = `Not valid JSON${where}: ${e.message.slice(0, 120)}`;
    return false;
  }
  state.text = text;
  state.data = data;
  state.parsed = true;
  $("input").hidden = true;
  $("output").hidden = false;
  $("search").hidden = false;
  $("query").hidden = false;
  $("actions").hidden = false;
  $("raw").textContent = "";
  $("stats").textContent = `${fmtBytes(size)} · ${countNodes(data).toLocaleString()} nodes${sourceNote ? " · " + sourceNote : ""}`;
  state.selectedPath = "$";
  $("crumb").textContent = "$";
  showView("tree");
  renderTree();
  return true;
}

function resetToInput() {
  state.parsed = false;
  $("input").hidden = false;
  $("output").hidden = true;
  $("search").hidden = true;
  $("query").hidden = true;
  $("actions").hidden = true;
  $("inputErr").hidden = true;
  $("pasteBox").value = "";
}

// ---------- pro features ---------------------------------------------------
function runQuery(expr) {
  if (!requirePro()) return;
  let results;
  try {
    results = JSONPeekQuery.query(state.data, expr);
  } catch (e) {
    $("qCount").textContent = `Query error: ${e.message}`;
    $("qList").textContent = "";
    showView("query");
    return;
  }
  $("qCount").textContent = `${results.length} match${results.length === 1 ? "" : "es"} for ${expr}`;
  const list = $("qList");
  list.textContent = "";
  for (const r of results.slice(0, 200)) {
    const row = document.createElement("div");
    row.className = "qrow";
    const val = JSON.stringify(r.value, null, 2);
    row.innerHTML = `<div class="path">${esc(r.path)}</div><pre>${esc(val.length > 1200 ? val.slice(0, 1200) + "…" : val)}</pre>`;
    list.appendChild(row);
  }
  showView("query");
}

function download(name, text, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function runDiff() {
  let other;
  try {
    other = JSON.parse($("diffBox").value);
  } catch (e) {
    $("diffOut").innerHTML = `<span class="err">Second JSON is invalid: ${esc(e.message.slice(0, 120))}</span>`;
    return;
  }
  const changes = JSONPeekDiff.diff(state.data, other);
  const out = $("diffOut");
  out.textContent = "";
  if (!changes.length) {
    out.innerHTML = `<div class="drow">✓ Structurally identical.</div>`;
    return;
  }
  const fmt = (v) => {
    const s = JSON.stringify(v);
    return s && s.length > 100 ? s.slice(0, 100) + "…" : s;
  };
  for (const c of changes.slice(0, 500)) {
    const row = document.createElement("div");
    row.className = `drow ${c.kind}`;
    if (c.kind === "added") row.innerHTML = `<b>+ ${esc(c.path)}</b> ${esc(fmt(c.b))}`;
    else if (c.kind === "removed") row.innerHTML = `<b>− ${esc(c.path)}</b> ${esc(fmt(c.a))}`;
    else row.innerHTML = `<b>~ ${esc(c.path)}</b> ${esc(fmt(c.a))} → ${esc(fmt(c.b))}`;
    out.appendChild(row);
  }
  const summary = document.createElement("div");
  summary.className = "count";
  summary.textContent = `${changes.length} difference${changes.length === 1 ? "" : "s"}${changes.length > 500 ? " (showing first 500)" : ""}`;
  out.prepend(summary);
}

// ---------- boot -----------------------------------------------------------
async function init() {
  $("proPrice").textContent = JSONPEEK_CONFIG.PRO_PRICE_LABEL;

  const params = new URLSearchParams(location.search);
  if (params.get("err") === "restricted") {
    $("notice").hidden = false;
    $("notice").textContent = "Chrome doesn't allow reading that page (chrome:// pages, the Web Store). Paste or drop your JSON instead.";
  }

  const status = await JSONPeekPay.getStatus();
  state.pro = !!status.paid;
  document.body.classList.toggle("is-pro", state.pro);
  $("proBadge").hidden = !state.pro;
  if (!JSONPeekPay.configured) $("proUnavailable").hidden = false;

  // JSON handed over by the background grab?
  const { pendingJSON } = await new Promise((resolve) => chrome.storage.local.get({ pendingJSON: null }, resolve));
  if (params.get("src") === "tab" && pendingJSON && pendingJSON.text) {
    const note = pendingJSON.sourceUrl ? new URL(pendingJSON.sourceUrl).host : "";
    if (!loadText(pendingJSON.text, note)) {
      $("pasteBox").value = pendingJSON.text.slice(0, 200000);
    }
  }

  $("viewBtn").addEventListener("click", () => loadText($("pasteBox").value));
  $("fileBtn").addEventListener("click", () => $("fileInput").click());
  $("fileInput").addEventListener("change", async () => {
    const f = $("fileInput").files[0];
    if (f) loadText(await f.text(), f.name);
  });
  document.addEventListener("dragover", (e) => {
    e.preventDefault();
    document.body.classList.add("dragging");
  });
  document.addEventListener("dragleave", () => document.body.classList.remove("dragging"));
  document.addEventListener("drop", async (e) => {
    e.preventDefault();
    document.body.classList.remove("dragging");
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) {
      resetToInput();
      loadText(await f.text(), f.name);
    }
  });

  $("treeTab").addEventListener("click", () => showView("tree"));
  $("rawTab").addEventListener("click", () => showView("raw"));
  $("newBtn").addEventListener("click", resetToInput);
  $("copyBtn").addEventListener("click", async () => {
    await navigator.clipboard.writeText(JSON.stringify(state.data, null, 2)).catch(() => {});
    $("copyBtn").textContent = "Copied ✓";
    setTimeout(() => ($("copyBtn").textContent = "Copy"), 1200);
  });
  $("downloadBtn").addEventListener("click", () => download(`jsonpeek-${stamp()}.json`, JSON.stringify(state.data, null, 2)));
  $("csvBtn").addEventListener("click", () => {
    if (!requirePro()) return;
    download(`jsonpeek-${stamp()}.csv`, JSONPeekCSV.toCSV(state.data), "text/csv");
  });
  $("diffBtn").addEventListener("click", () => {
    if (!requirePro()) return;
    showView("diff");
  });
  $("diffRun").addEventListener("click", runDiff);
  $("diffClose").addEventListener("click", () => showView("tree"));
  $("qBack").addEventListener("click", () => showView("tree"));

  $("copyPathBtn").addEventListener("click", async () => {
    await navigator.clipboard.writeText(state.selectedPath).catch(() => {});
    $("copyPathBtn").textContent = "copied ✓";
    setTimeout(() => ($("copyPathBtn").textContent = "copy path"), 1200);
  });

  let searchTimer;
  $("search").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch($("search").value), 180);
  });
  $("query").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && $("query").value.trim()) runQuery($("query").value.trim());
  });

  $("proBuyBtn").addEventListener("click", () => {
    if (JSONPeekPay.configured) JSONPeekPay.openPaymentPage();
  });
  $("proRestoreBtn").addEventListener("click", () => {
    if (JSONPeekPay.configured) JSONPeekPay.openLoginPage();
  });
  $("proCloseBtn").addEventListener("click", () => $("proDialog").close());

  // Test hook (same pattern as the rest of the portfolio).
  window.__jsonpeek = {
    state,
    loadText,
    runSearch,
    runQuery,
    runDiff,
    setPro(v) {
      state.pro = v;
      document.body.classList.toggle("is-pro", v);
      $("proBadge").hidden = !v;
    }
  };
  window.__jsonpeekReady = true;
}

init();
