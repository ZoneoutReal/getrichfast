// SnipShot real-extension smoke test: loads the packaged extension into a
// real Chromium and verifies the background pipeline, first-run flow, and
// editor working inside the actual extension context.
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

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "snipshot-uitest-"));
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

// first run opens the demo editor
const demoPage = await waitFor(async () =>
  ctx.pages().find((p) => p.url().includes("editor.html") && p.url().includes("demo=1"))
);
check("first run opens editor in demo mode", !!demoPage);

await demoPage.waitForFunction(() => window.__snipshot && window.__snipshot.state.img);
const noticeShown = await demoPage.evaluate(() => !document.getElementById("notice").hidden);
check("welcome notice visible in demo", noticeShown === true);

// draw on the real extension page
const box = await demoPage.locator("#canvas").boundingBox();
const scale = box.width / (await demoPage.evaluate(() => document.getElementById("canvas").width));
await demoPage.mouse.move(box.x + 100 * scale, box.y + 150 * scale);
await demoPage.mouse.down();
await demoPage.mouse.move(box.x + 400 * scale, box.y + 300 * scale, { steps: 5 });
await demoPage.mouse.up();
const shapeCount = await demoPage.evaluate(() => window.__snipshot.state.shapes.length);
check("drawing works in real extension context", shapeCount === 1, String(shapeCount));

// export from the real extension page
const [download] = await Promise.all([demoPage.waitForEvent("download"), demoPage.click("#downloadBtn")]);
const buf = fs.readFileSync(await download.path());
check("download from extension page is a PNG", buf[0] === 0x89 && buf[1] === 0x50, buf.slice(0, 2).toString("hex"));

// capture pipeline: without a user gesture activeTab isn't granted, so the
// background's error path must open the editor with the restricted notice.
await sw.evaluate(() => capture(null));
const errPage = await waitFor(async () =>
  ctx.pages().find((p) => p.url().includes("err=restricted"))
);
check("background error path opens editor with notice", !!errPage);
if (errPage) {
  await errPage.waitForFunction(() => window.__snipshot && window.__snipshot.state.img);
  const msg = await errPage.evaluate(() => document.getElementById("notice").textContent);
  check("restricted notice explains the limitation", /doesn't allow capturing/.test(msg), msg);
}

// pro tools stay locked (EXTPAY unconfigured in dev build)
await demoPage.bringToFront();
await demoPage.click('[data-tool="blur"]');
const dialogOpen = await demoPage.evaluate(() => document.getElementById("proDialog").open);
check("Pro tool locked in real context", dialogOpen === true);

await ctx.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
