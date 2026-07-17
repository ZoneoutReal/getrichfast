// PagePulse real-extension smoke test: REAL tab auto-reloading observed
// against a live local server, badge countdown, stop semantics, tab-close
// cleanup, popup UI, and gating. Usage: npm run test:ui
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

// live server that counts hits per path
const hits = {};
const server = http.createServer((req, res) => {
  hits[req.url] = (hits[req.url] || 0) + 1;
  res.setHeader("content-type", "text/html");
  res.end(`<title>pulse</title><h1 id="n">${hits[req.url]}</h1>`);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pagepulse-uitest-"));
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

// open a target page and start a real 2-second job via the background API
const target = await ctx.newPage();
await target.goto(`http://127.0.0.1:${PORT}/watch`);
const startHits = hits["/watch"];

await target.bringToFront();
const tabId = await sw.evaluate(async () => {
  // without the "tabs" permission urls are invisible — locate by active tab
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  await new Promise((resolve) => {
    const jobs = {};
    jobs[tab.id] = {
      tabId: tab.id,
      host: "127.0.0.1",
      intervalSec: 2,
      jitterPct: 0,
      hardReload: false,
      monitor: null,
      startedAt: Date.now(),
      reloads: 0,
      nextAt: Date.now() + 2000
    };
    chrome.storage.local.set({ jobs }, resolve);
  });
  await tick();
  return tab.id;
});
check("job created for real tab", typeof tabId === "number", String(tabId));

// watch actual reloads land on the server
await new Promise((r) => setTimeout(r, 7000));
const reloads = hits["/watch"] - startHits;
check("tab really reloads on the interval (≥2 in 7s)", reloads >= 2, `saw ${reloads} reloads`);

// counter visible in the page itself
const shown = Number(await target.textContent("#n").catch(() => 0));
check("page shows fresh content after reloads", shown >= startHits + 2, String(shown));

// badge countdown present for the job's tab (each reload clears per-tab
// badge text; the next 1s tick repaints it — poll across that gap)
let badge = "";
for (let i = 0; i < 30 && !/^\d+s$/.test(badge); i++) {
  badge = await sw.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), tabId);
  if (!/^\d+s$/.test(badge)) await new Promise((r) => setTimeout(r, 150));
}
check("badge shows live countdown", /^\d+s$/.test(badge), badge);

// job state tracked
const jobState = await sw.evaluate(() => getJobs());
check("reload count tracked in job state", jobState[tabId] && jobState[tabId].reloads >= 2, JSON.stringify(jobState[tabId] && jobState[tabId].reloads));

// popup on the target tab... popup pages read the ACTIVE tab; open popup as page
const popup = await ctx.newPage();
await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);
await popup.waitForFunction(() => window.__ppPopupReady);
check("popup renders preset grid", (await popup.locator("button.preset").count()) === 6);
check("popup restricted on extension tab", await popup.locator("#restricted").isVisible());
check("popup lists the running job", (await popup.locator(".job").count()) === 1 && (await popup.textContent(".job")).includes("127.0.0.1"));
check("popup: unconfigured build hides upgrade", await popup.locator("#upgradeBtn").isHidden());

// custom interval is Pro-gated (free build → honest note)
await popup.fill("#custom", "45s");
await popup.click("#customGo");
check("custom interval gated for free user", (await popup.textContent("#proNote")).includes("Pro feature"), await popup.textContent("#proNote"));

// stop from the popup jobs list
await popup.click(".job .stop");
await popup.waitForTimeout(400);
const jobsAfterStop = await sw.evaluate(() => getJobs());
check("stop clears the job", Object.keys(jobsAfterStop).length === 0, JSON.stringify(jobsAfterStop));
const hitsAfterStop = hits["/watch"];
await new Promise((r) => setTimeout(r, 3500));
check("no more reloads after stop", hits["/watch"] === hitsAfterStop, `+${hits["/watch"] - hitsAfterStop}`);

// tab-close cleanup: new job on a second page, then close the tab
const t2 = await ctx.newPage();
await t2.goto(`http://127.0.0.1:${PORT}/other`);
await t2.bringToFront();
await sw.evaluate(async () => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const jobs = await getJobs();
  jobs[tab.id] = { tabId: tab.id, host: "127.0.0.1", intervalSec: 2, jitterPct: 0, startedAt: Date.now(), reloads: 0, nextAt: Date.now() + 2000 };
  await chrome.storage.local.set({ jobs });
  await arm();
});
await t2.close();
await new Promise((r) => setTimeout(r, 800));
const jobsAfterClose = await sw.evaluate(() => getJobs());
check("closing the tab removes its job", Object.keys(jobsAfterClose).length === 0, JSON.stringify(jobsAfterClose));

// monitor check fails gracefully without host permission
const monErr = await sw.evaluate(async (id) => {
  const jobs = await getJobs();
  jobs[id] = { tabId: id, host: "127.0.0.1", intervalSec: 60, jitterPct: 0, startedAt: Date.now(), reloads: 0, nextAt: Date.now() + 60000, monitor: { enabled: true, keyword: "x", last: null } };
  await chrome.storage.local.set({ jobs });
  try {
    await monitorCheck(id);
    return "ok";
  } catch (e) {
    return "error:" + String(e && e.message ? e.message : e);
  }
}, tabId);
check("monitor without host permission fails gracefully", /^error:/.test(monErr) || monErr === "ok", monErr);
check("service worker alive at end", await sw.evaluate(() => typeof tick === "function"));

await ctx.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
