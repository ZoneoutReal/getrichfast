// JSONPeek viewer + engine tests: run the real viewer page with a chrome.*
// stub and drive it with real input. Usage: npm run test:viewer
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const VIEWER = "file://" + path.join(here, "..", "extension", "src", "viewer", "viewer.html");

const PREINSTALLED = "/opt/pw-browsers/chromium";
const launchOpts = fs.existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {};

const results = [];
function check(name, cond, extra = "") {
  results.push({ ok: !!cond, name });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  → " + extra}`);
}

const SAMPLE = {
  service: "orders-api",
  version: 2,
  live: true,
  owner: null,
  endpoints: ["/orders", "/orders/{id}", "/health"],
  config: { retries: 3, timeoutMs: 2500, flags: { beta: false, tracing: true } },
  users: [
    { id: 1, name: "Ada", email: "ada@example.com", roles: ["admin"] },
    { id: 2, name: "Linus", email: "linus@example.com", roles: ["dev", "ops"] },
    { id: 3, name: "Grace", email: "grace@example.com", roles: [] }
  ]
};

const browser = await chromium.launch(launchOpts);
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(() => {
  const store = { pendingJSON: null };
  const get = (defaults, cb) => {
    const out = typeof defaults === "object" && !Array.isArray(defaults) ? { ...defaults, ...store } : store;
    if (cb) return void setTimeout(() => cb(out), 0);
    return Promise.resolve(out);
  };
  const set = (obj, cb) => {
    Object.assign(store, obj);
    if (cb) return void cb();
    return Promise.resolve();
  };
  window.chrome = {
    storage: { local: { get, set }, onChanged: { addListener() {} } },
    runtime: { id: "stub", getURL: (p) => p, onMessage: { addListener() {} } }
  };
});
await page.goto(VIEWER);
await page.waitForFunction(() => window.__jsonpeekReady);

// ---- input & parse --------------------------------------------------------
await page.fill("#pasteBox", "{ this is not json ");
await page.click("#viewBtn");
check("invalid JSON shows error with location", await page.evaluate(() => !document.getElementById("inputErr").hidden && /line \d+, column \d+/.test(document.getElementById("inputErr").textContent)), await page.textContent("#inputErr"));

await page.fill("#pasteBox", JSON.stringify(SAMPLE));
await page.click("#viewBtn");
check("valid JSON switches to tree view", await page.evaluate(() => document.getElementById("input").hidden && !document.getElementById("output").hidden));
check("stats show size and node count", /B · .+ nodes/.test(await page.textContent("#stats")), await page.textContent("#stats"));

// ---- tree -----------------------------------------------------------------
check("root expanded with top-level keys", (await page.locator('#tree .node[data-path="$.service"]').count()) === 1);
check("leaf renders typed value", (await page.locator('#tree .node[data-path="$.version"] .n').textContent()) === "2");
check("null renders as null", (await page.locator('#tree .node[data-path="$.owner"] .z').textContent()) === "null");
check("collapsed children not rendered yet (lazy)", (await page.locator('#tree .node[data-path="$.users[0].name"]').count()) === 0);

await page.click('#tree .node[data-path="$.users"] > .row');
await page.click('#tree .node[data-path="$.users[1]"] > .row');
check("expanding renders nested nodes", (await page.locator('#tree .node[data-path="$.users[1].name"]').count()) === 1);
check("array count badge correct", (await page.locator('#tree .node[data-path="$.users"] > .row .count').textContent()).includes("3 items"));

await page.click('#tree .node[data-path="$.users[1].email"] > .row');
check("clicking a node sets the breadcrumb path", (await page.textContent("#crumb")) === "$.users[1].email");

// ---- search ---------------------------------------------------------------
await page.fill("#search", "grace");
await page.waitForTimeout(350);
check("search auto-expands to matches", (await page.locator('#tree .node[data-path="$.users[2].email"]').count()) === 1);
check("search highlights hits", (await page.locator("#tree .hit").count()) > 0);
await page.fill("#search", "");
await page.waitForTimeout(350);

// ---- raw view -------------------------------------------------------------
await page.click("#rawTab");
const raw = await page.textContent("#raw");
check("raw view is pretty-printed JSON", raw.includes('"service": "orders-api"') && raw.split("\n").length > 10);
await page.click("#treeTab");

// ---- pro gating -----------------------------------------------------------
await page.click("#csvBtn");
check("CSV is Pro-locked (dialog opens)", await page.evaluate(() => document.getElementById("proDialog").open));
check("unconfigured build shows 'not purchasable'", await page.evaluate(() => !document.getElementById("proUnavailable").hidden));
await page.click("#proCloseBtn");

await page.fill("#query", "$.users[*].name");
await page.press("#query", "Enter");
check("query is Pro-locked (dialog opens)", await page.evaluate(() => document.getElementById("proDialog").open));
await page.click("#proCloseBtn");

// free size limit
const big = '{"pad":"' + "x".repeat(2 * 1024 * 1024) + '"}';
await page.click("#newBtn");
await page.evaluate((t) => {
  document.getElementById("pasteBox").value = t;
}, big);
await page.click("#viewBtn");
check("free tier blocks >2MB with honest message", await page.evaluate(() => document.getElementById("proDialog").open && /free tier handles up to 2\.0 MB/.test(document.getElementById("inputErr").textContent)), await page.textContent("#inputErr"));
await page.click("#proCloseBtn");

// ---- pro features (unlocked) ----------------------------------------------
await page.evaluate(() => window.__jsonpeek.setPro(true));
await page.evaluate((t) => {
  document.getElementById("pasteBox").value = t;
}, big);
await page.click("#viewBtn");
check("Pro loads >2MB file", await page.evaluate(() => !document.getElementById("output").hidden), await page.textContent("#inputErr").catch(() => ""));

await page.click("#newBtn");
await page.fill("#pasteBox", JSON.stringify(SAMPLE));
await page.click("#viewBtn");

await page.fill("#query", "$.users[*].name");
await page.press("#query", "Enter");
check("query [*] returns all names", (await page.textContent("#qCount")).startsWith("3 matches"), await page.textContent("#qCount"));
check("query result shows path + value", (await page.textContent("#qList")).includes("$.users[0].name") && (await page.textContent("#qList")).includes('"Ada"'));

await page.fill("#query", "$..email");
await page.press("#query", "Enter");
check("recursive ..email finds all three", (await page.textContent("#qCount")).startsWith("3 matches"), await page.textContent("#qCount"));

await page.fill("#query", "$.users[-1].name");
await page.press("#query", "Enter");
check("negative index works", (await page.textContent("#qList")).includes('"Grace"'));

await page.fill("#query", "$.nope.deeper");
await page.press("#query", "Enter");
check("no-match query reports 0", (await page.textContent("#qCount")).startsWith("0 matches"));

await page.fill("#query", "users.name");
await page.press("#query", "Enter");
check("bad query surfaces error", (await page.textContent("#qCount")).includes("Query error"), await page.textContent("#qCount"));

// engine units via page evaluate
const csv = await page.evaluate(() => JSONPeekCSV.toCSV([{ a: 1, b: { c: "x,y" } }, { a: 2, d: true }]));
check("CSV: union columns + escaping", csv === 'a,b.c,d\r\n1,"x,y",\r\n2,,true\r\n', JSON.stringify(csv));
const csvFlat = await page.evaluate(() => JSONPeekCSV.flatten({ list: [1, 2], empty: {} }));
check("CSV: flatten arrays and empty objects", csvFlat["list[0]"] === 1 && csvFlat["list[1]"] === 2 && csvFlat.empty === "{}", JSON.stringify(csvFlat));

const diffs = await page.evaluate(() =>
  JSONPeekDiff.diff({ a: 1, b: [1, 2], gone: true, same: "s" }, { a: 2, b: [1, 2, 3], fresh: null, same: "s" })
);
check(
  "diff: changed/added/removed detected",
  diffs.length === 4 &&
    diffs.some((d) => d.path === "$.a" && d.kind === "changed") &&
    diffs.some((d) => d.path === "$.b[2]" && d.kind === "added") &&
    diffs.some((d) => d.path === "$.gone" && d.kind === "removed") &&
    diffs.some((d) => d.path === "$.fresh" && d.kind === "added"),
  JSON.stringify(diffs)
);

// diff through the UI
await page.click("#diffBtn");
await page.fill("#diffBox", JSON.stringify({ ...SAMPLE, version: 3 }));
await page.click("#diffRun");
check("diff UI shows the changed path", (await page.textContent("#diffOut")).includes("$.version"), (await page.textContent("#diffOut")).slice(0, 120));
await page.fill("#diffBox", JSON.stringify(SAMPLE));
await page.click("#diffRun");
check("identical JSONs report identical", (await page.textContent("#diffOut")).includes("Structurally identical"));

// download produces a real .json file
await page.click("#diffClose");
const [download] = await Promise.all([page.waitForEvent("download"), page.click("#downloadBtn")]);
const buf = fs.readFileSync(await download.path());
check("download is pretty JSON", buf.toString().startsWith("{\n "), buf.slice(0, 20).toString());
check("download filename stamped", /^jsonpeek-\d{8}-\d{6}\.json$/.test(download.suggestedFilename()), download.suggestedFilename());

// CSV download for pro
const [csvDl] = await Promise.all([page.waitForEvent("download"), page.click("#csvBtn")]);
check("CSV download for Pro user", /\.csv$/.test(csvDl.suggestedFilename()), csvDl.suggestedFilename());

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
