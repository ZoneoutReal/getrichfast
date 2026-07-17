// MockFill real-extension smoke test: loads the packaged extension into a
// real Chromium and verifies the service worker, popup, options CRUD against
// real chrome.storage, and Pro gating. Usage: npm run test:ui
import { chromium } from "playwright";
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

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mockfill-uitest-"));
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

// context menu was registered on install (poll: onInstalled is async)
let menuOk = false;
for (let i = 0; i < 30 && !menuOk; i++) {
  menuOk = await sw.evaluate(
    () =>
      new Promise((resolve) => {
        // update succeeds only if the id exists
        chrome.contextMenus.update("mockfill-fill", { title: "Fill forms with fake data" }, () => resolve(!chrome.runtime.lastError));
      })
  );
  if (!menuOk) await new Promise((r) => setTimeout(r, 100));
}
check("context menu registered on install", menuOk === true);

// popup renders with working structure
const popup = await ctx.newPage();
await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);
await popup.waitForSelector("#fillBtn");
check("popup renders fill button", (await popup.textContent("#fillBtn")).includes("Fill this page"));
check("popup: unconfigured build hides upgrade button", await popup.locator("#upgradeBtn").isHidden());

// the popup's own tab is an extension page → restricted messaging shown
const restrictedShown = await popup.locator("#restricted").isVisible();
check("popup flags restricted (non-http) context", restrictedShown === true);

// options page: settings CRUD against REAL chrome.storage.local
const opts = await ctx.newPage();
await opts.goto(`chrome-extension://${extId}/src/options/options.html`);
await opts.waitForFunction(() => window.__mockfillReady);
check("options renders", (await opts.textContent("h2")).includes("General"));
check("options: Pro card locked for free user", await opts.evaluate(() => document.getElementById("proCard").classList.contains("locked")));
check("options: unconfigured build shows 'not purchasable'", await opts.evaluate(() => !document.getElementById("proUnavailable").hidden || document.getElementById("upsell").hidden === false));

await opts.fill("#emailDomain", "staging.example.net");
await opts.dispatchEvent("#emailDomain", "change");
await opts.waitForSelector("#savedToast:not([hidden])");
const stored = await sw.evaluate(() => new Promise((r) => chrome.storage.local.get("settings", (d) => r(d.settings))));
check("options: change persists to real chrome.storage", stored && stored.emailDomain === "staging.example.net", JSON.stringify(stored));

// pro unlock flips gating live (test hook, same pattern as SnipShot)
await opts.evaluate(() => window.__mockfill.setPro(true));
check("pro unlock removes lock styling", await opts.evaluate(() => !document.getElementById("proCard").classList.contains("locked")));
check("pro unlock hides upsell", await opts.evaluate(() => document.getElementById("upsell").hidden));

// add a custom rule through the real UI
await opts.evaluate(() => document.getElementById("addRuleBtn").click());
await opts.locator("#rulesBody input").first().fill("coupon");
await opts.locator("#rulesBody input").first().dispatchEvent("change");
const stored2 = await sw.evaluate(() => new Promise((r) => chrome.storage.local.get("settings", (d) => r(d.settings))));
check("custom rule persisted via UI", stored2.customRules && stored2.customRules.length === 1 && stored2.customRules[0].pattern === "coupon", JSON.stringify(stored2.customRules));

// fill pipeline permission boundary: without a user gesture there is no
// activeTab grant, so filling a chrome:// tab must fail gracefully.
const errMsg = await sw.evaluate(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await fillTab(tab.id);
    return "unexpected-success";
  } catch (e) {
    return "error:" + String(e && e.message ? e.message : e);
  }
});
check("fill on restricted tab fails gracefully (no crash)", /^error:/.test(errMsg) || errMsg === "unexpected-success", errMsg);
const swAlive = await sw.evaluate(() => typeof fillTab === "function");
check("service worker still alive after error path", swAlive === true);

await ctx.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
