// JSONPeek real-extension smoke test: loads the packaged extension into a
// real Chromium and verifies the background grab pipeline, storage handoff,
// viewer in real extension context, and Pro gating. Usage: npm run test:ui
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

async function waitFor(fn, { timeout = 6000, step = 100 } = {}) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, step));
  }
  return last;
}

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "jsonpeek-uitest-"));
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

// background error path: no activeTab grant → viewer opens with notice
await sw.evaluate(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await grabAndOpen(tab);
});
const errPage = await waitFor(async () => ctx.pages().find((p) => p.url().includes("err=restricted")));
check("restricted grab opens viewer with paste UI", !!errPage);
if (errPage) {
  await errPage.waitForFunction(() => window.__jsonpeekReady);
  check("restricted notice explains the limitation", /doesn't allow reading/.test(await errPage.textContent("#notice")));
  check("paste UI visible on restricted path", await errPage.evaluate(() => !document.getElementById("input").hidden));
}

// storage handoff: pendingJSON set by background → viewer?src=tab loads it
await sw.evaluate(() =>
  chrome.storage.local.set({
    pendingJSON: { text: JSON.stringify({ orders: [{ id: 7, total: 42.5 }], ok: true }), sourceUrl: "https://api.example.com/orders", at: 1 }
  })
);
const viewer = await ctx.newPage();
await viewer.goto(`chrome-extension://${extId}/src/viewer/viewer.html?src=tab`);
await viewer.waitForFunction(() => window.__jsonpeekReady);
check("handed-over JSON renders as tree", await viewer.evaluate(() => !document.getElementById("output").hidden && !!document.querySelector('#tree .node[data-path="$.orders"]')));
check("stats show source host", (await viewer.textContent("#stats")).includes("api.example.com"), await viewer.textContent("#stats"));

// interact with the real page: expand + breadcrumb
await viewer.click('#tree .node[data-path="$.orders"] > .row');
await viewer.click('#tree .node[data-path="$.orders[0]"] > .row');
await viewer.click('#tree .node[data-path="$.orders[0].total"] > .row');
check("real-page expand + path selection", (await viewer.textContent("#crumb")) === "$.orders[0].total");

// pro gating in real context (EXTPAY unconfigured)
await viewer.click("#csvBtn");
check("Pro tool locked in real context", await viewer.evaluate(() => document.getElementById("proDialog").open));
check("real context shows 'not purchasable'", await viewer.evaluate(() => !document.getElementById("proUnavailable").hidden));
await viewer.click("#proCloseBtn");

// paste flow end-to-end in real context
await viewer.click("#newBtn");
await viewer.fill("#pasteBox", '{"fresh": [1, 2, 3]}');
await viewer.click("#viewBtn");
check("paste flow works in real context", await viewer.evaluate(() => !!document.querySelector('#tree .node[data-path="$.fresh"]')));

// real download from extension page
const [dl] = await Promise.all([viewer.waitForEvent("download"), viewer.click("#downloadBtn")]);
const body = fs.readFileSync(await dl.path()).toString();
check("download from real extension page", body.includes('"fresh"'), body.slice(0, 40));

// SW still healthy
check("service worker alive at end", await sw.evaluate(() => typeof grabAndOpen === "function"));

await ctx.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
