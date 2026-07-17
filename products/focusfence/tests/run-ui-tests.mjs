// FocusFence real-extension smoke test: REAL blocking via declarativeNetRequest
// — navigate to a blocked domain and land on the blocked page — plus session
// lifecycle, strict mode, popup/options state, and gating.
// Usage: npm run test:ui
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

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "focusfence-uitest-"));
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

// seed a block list + always-on through the background's own state pipeline
const seeded = await sw.evaluate(async () => {
  await setState({ sites: ["blockme.example", "*.social.example"], alwaysOn: true });
  return sync();
});
check("sync installs dNR rules when active", seeded && seeded.active === true && seeded.ruleCount === 2, JSON.stringify(seeded));

const dynRules = await sw.evaluate(() => chrome.declarativeNetRequest.getDynamicRules());
check("dynamic rules present in real dNR", dynRules.length === 2 && dynRules.every((r) => r.action.type === "redirect"), JSON.stringify(dynRules.map((r) => r.condition.urlFilter)));

// THE REAL TEST: navigating to a blocked domain lands on the blocked page.
// dNR intercepts before any network request, so no connectivity is needed.
const page = await ctx.newPage();
await page.goto("http://blockme.example/some/path").catch(() => {});
await page.waitForURL((u) => String(u).includes("blocked.html"), { timeout: 5000 }).catch(() => {});
check("navigation to blocked domain redirects to blocked page", page.url().startsWith(`chrome-extension://${extId}/src/blocked/blocked.html`), page.url());
check("blocked page names the fenced site", page.url().includes("from=blockme.example"), page.url());
await page.waitForFunction(() => window.__ffBlockedReady).catch(() => {});
check("blocked page renders the site name", (await page.textContent("#site")) === "blockme.example");

// subdomain of wildcard entry is fenced too
const page2 = await ctx.newPage();
await page2.goto("http://feed.social.example/").catch(() => {});
await page2.waitForURL((u) => String(u).includes("blocked.html"), { timeout: 5000 }).catch(() => {});
check("wildcard entry blocks subdomains", page2.url().includes("blocked.html"), page2.url());

// a non-listed domain is NOT redirected (nav may fail networkless — fine)
const page3 = await ctx.newPage();
await page3.goto("http://allowed.example/", { timeout: 4000 }).catch(() => {});
check("non-listed domain not redirected", !page3.url().includes("blocked.html"), page3.url());

// turning blocking off removes the fence
await sw.evaluate(() => setState({ alwaysOn: false }));
const rulesOff = await sw.evaluate(() => chrome.declarativeNetRequest.getDynamicRules());
check("always-on off → rules removed", rulesOff.length === 0, String(rulesOff.length));

// focus session lifecycle through the real message API
const afterStart = await sw.evaluate(async () => {
  await setState({ session: { startedAt: Date.now(), endsAt: Date.now() + 25 * 60000 } });
  const rules = await chrome.declarativeNetRequest.getDynamicRules();
  const badge = await chrome.action.getBadgeText({});
  return { rules: rules.length, badge };
});
check("session start restores rules", afterStart.rules === 2, JSON.stringify(afterStart));
check("badge shows minutes remaining", /^\d+$/.test(afterStart.badge) && Number(afterStart.badge) >= 24, afterStart.badge);

// strict mode freezes edits while the session runs. sendMessage must come
// from an extension PAGE (the SW's own messages don't loop back to itself) —
// the blocked page opened above is exactly that.
await sw.evaluate(() => setState({ strict: true }));
const strictErr = await page.evaluate(() => chrome.runtime.sendMessage({ type: "set-state", patch: { sites: [] } }));
check("strict mode rejects list edits during session", strictErr && strictErr.ok === false && strictErr.error === "strict-mode", JSON.stringify(strictErr));
const strictEnd = await page.evaluate(() => chrome.runtime.sendMessage({ type: "end-session" }));
check("strict mode rejects ending the session early", strictEnd && strictEnd.ok === false && strictEnd.error === "strict-mode", JSON.stringify(strictEnd));

// sites survived the strict-mode attempts
const stateNow = await sw.evaluate(() => getState());
check("block list unchanged after strict rejections", stateNow.sites.length === 2, JSON.stringify(stateNow.sites));

// clean up session for UI checks (allowed path: turn strict off via background fn, then end)
await sw.evaluate(() => setState({ strict: false, session: null }));

// popup renders real state
const popup = await ctx.newPage();
await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);
await popup.waitForFunction(() => window.__ffPopupReady);
check("popup lists the fenced sites", (await popup.locator(".siteitem").count()) === 2);
check("popup shows free count", (await popup.textContent("#count")).includes("2/7 free"), await popup.textContent("#count"));
check("popup: unconfigured build hides upgrade button", await popup.locator("#upgradeBtn").isHidden());

// start a session from the real popup UI
await popup.click('.sess[data-mins="25"]');
await popup.waitForSelector("#sessionBox:not([hidden])");
check("popup session UI shows countdown", /^2[45]:\d{2}$/.test(await popup.textContent("#countdown")), await popup.textContent("#countdown"));
const badgeNow = await sw.evaluate(() => chrome.action.getBadgeText({}));
check("badge live after popup-started session", /^\d+$/.test(badgeNow), badgeNow);
await popup.click("#endBtn");
await popup.waitForSelector("#startBox:not([hidden])");
check("end early returns to start UI", await popup.locator("#sessionBox").isHidden());

// options: real CRUD + gating
const opts = await ctx.newPage();
await opts.goto(`chrome-extension://${extId}/src/options/options.html`);
await opts.waitForFunction(() => window.__ffReady);
check("options: Pro card locked for free user", await opts.evaluate(() => document.getElementById("proCard").classList.contains("locked")));
await opts.fill("#siteInput", "reddit.com/r/all");
await opts.click("#addBtn");
check("options: path pattern rejected for free user", (await opts.textContent("#addErr")).includes("Pro feature"), await opts.textContent("#addErr"));
await opts.fill("#siteInput", "news.social");
await opts.click("#addBtn");
await opts.waitForSelector("#savedToast:not([hidden])");
check("options: valid site added via UI", (await opts.locator(".siteitem").count()) === 3);
const persisted = await sw.evaluate(() => getState());
check("options add persisted through background", persisted.sites.includes("news.social"), JSON.stringify(persisted.sites));

await opts.evaluate(() => window.__focusfence.setPro(true));
check("pro unlock removes lock styling", await opts.evaluate(() => !document.getElementById("proCard").classList.contains("locked")));
await opts.click("#addSchedBtn");
await opts.waitForSelector(".schedrow");
const schedPersisted = await sw.evaluate(() => getState());
check("schedule added + persisted", schedPersisted.schedules.length === 1 && schedPersisted.schedules[0].start === "09:00", JSON.stringify(schedPersisted.schedules));

check("service worker alive at end", await sw.evaluate(() => typeof sync === "function"));

await ctx.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
