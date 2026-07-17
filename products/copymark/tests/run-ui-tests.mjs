// CopyMark real-extension smoke test: loads the packaged extension into a
// real Chromium and verifies the service worker, context menus, popup, real
// chrome.tabs listing, real clipboard writes, storage CRUD, and gating.
// Usage: npm run test:ui
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const EXT_PATH = path.join(here, "..", "extension");

const PREINSTALLED = "/opt/pw-browsers/chromium";
const executablePath = fs.existsSync(PREINSTALLED) ? PREINSTALLED : undefined;

const results = [];
function check(name, cond, extra = "") {
  results.push({ ok: !!cond, name });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  → " + extra}`);
}

// tiny local server so real http:// tabs exist for chrome.tabs tests
const server = http.createServer((req, res) => {
  res.setHeader("content-type", "text/html");
  if (req.url === "/one") res.end("<title>Widget Docs [v2]</title><h1>One</h1>");
  else res.end("<title>Widget Blog</title><h1>Two</h1>");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "copymark-uitest-"));
const extArgs = [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`];

let ctx, sw;
try {
  ctx = await chromium.launchPersistentContext(userDataDir, { headless: true, executablePath, args: extArgs });
  sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 8000 }));
} catch {
  ctx = await chromium.launchPersistentContext(userDataDir + "-2", {
    headless: false,
    executablePath,
    args: [...extArgs, "--headless=new"]
  });
  sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 8000 }));
}

const extId = new URL(sw.url()).host;
check("service worker registered", !!extId, sw.url());

// all three context menus registered (poll: onInstalled is async)
async function menuExists(id) {
  return sw.evaluate(
    (menuId) =>
      new Promise((resolve) => {
        chrome.contextMenus.update(menuId, {}, () => resolve(!chrome.runtime.lastError));
      }),
    id
  );
}
let menusOk = false;
for (let i = 0; i < 30 && !menusOk; i++) {
  menusOk = (await menuExists("copymark-selection")) && (await menuExists("copymark-link")) && (await menuExists("copymark-page"));
  if (!menusOk) await new Promise((r) => setTimeout(r, 100));
}
check("all three context menus registered", menusOk === true);

// open two real http tabs
const p1 = await ctx.newPage();
await p1.goto(`http://127.0.0.1:${PORT}/one`);
const p2 = await ctx.newPage();
await p2.goto(`http://127.0.0.1:${PORT}/two`);

// REAL tabs → markdown pipeline (chrome.tabs.query with "tabs" permission)
const tabsRes = await sw.evaluate(() => tabsMarkdown());
check("all-tabs markdown lists real open tabs", tabsRes.includes(`](http://127.0.0.1:${PORT}/one)`) && tabsRes.includes(`](http://127.0.0.1:${PORT}/two)`), tabsRes);
check("tab titles escaped for markdown", tabsRes.includes("Widget Docs \\[v2\\]"), tabsRes);

// capture without activeTab must fail gracefully (permission boundary)
const capErr = await sw.evaluate(async (port) => {
  const tabs = await chrome.tabs.query({ url: `http://127.0.0.1:${port}/one` });
  try {
    const r = await capture(tabs[0].id, "link", { writeInPage: true });
    return "ok:" + JSON.stringify(r);
  } catch (e) {
    return "error:" + String(e && e.message ? e.message : e);
  }
}, PORT);
check("capture without activeTab fails gracefully", /^error:/.test(capErr), capErr);
const swAlive = await sw.evaluate(() => typeof capture === "function");
check("service worker alive after error path", swAlive === true);

// popup renders; on its own (extension) tab the page actions are disabled
const popup = await ctx.newPage();
await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);
await popup.waitForFunction(() => window.__copymarkReady);
check("popup renders all four actions", (await popup.locator("button.action").count()) === 4);
check("popup: page actions disabled on restricted tab", await popup.locator("#selBtn").isDisabled());
check("popup: tabs action stays enabled", !(await popup.locator("#tabsBtn").isDisabled()));
check("popup: unconfigured build hides upgrade button", await popup.locator("#upgradeBtn").isHidden());

// free user clicking a Pro action → honest "not purchasable" message
await popup.click("#tabsBtn");
await popup.waitForSelector("#result:not([hidden])");
const gateMsg = await popup.textContent("#result");
check("Pro action gated for free user", /Pro feature/.test(gateMsg), gateMsg);

// REAL clipboard round-trip via the real message pipeline
await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
const clipRes = await popup.evaluate(async () => {
  const res = await chrome.runtime.sendMessage({ type: "tabs-markdown" });
  if (!res || !res.ok) return "message-failed";
  await navigator.clipboard.writeText(res.md);
  return navigator.clipboard.readText();
});
check("real clipboard write+read of tabs markdown", typeof clipRes === "string" && clipRes.includes("](http://127.0.0.1:"), String(clipRes).slice(0, 80));

// options: CRUD against real chrome.storage + Pro gating
const opts = await ctx.newPage();
await opts.goto(`chrome-extension://${extId}/src/options/options.html`);
await opts.waitForFunction(() => window.__copymarkReady);
check("options: Pro card locked for free user", await opts.evaluate(() => document.getElementById("proCard").classList.contains("locked")));
await opts.selectOption("#bullet", "*");
await opts.waitForSelector("#savedToast:not([hidden])");
const stored = await sw.evaluate(() => new Promise((r) => chrome.storage.local.get("settings", (d) => r(d.settings))));
check("options: bullet choice persists to real storage", stored && stored.bullet === "*", JSON.stringify(stored));

await opts.evaluate(() => window.__copymark.setPro(true));
check("pro unlock removes lock styling", await opts.evaluate(() => !document.getElementById("proCard").classList.contains("locked")));
await opts.click("#obsidianPreset");
const stored2 = await sw.evaluate(() => new Promise((r) => chrome.storage.local.get("settings", (d) => r(d.settings))));
check("Obsidian preset persists front-matter template", stored2.frontMatter && stored2.frontMatter.includes('title: "{{title}}"'), JSON.stringify(stored2.frontMatter));

await ctx.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
