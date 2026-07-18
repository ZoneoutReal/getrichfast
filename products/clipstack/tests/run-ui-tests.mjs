// ClipStack real-extension smoke test: loads the REAL extension into Chromium
// (service worker, content script on a live http page, storage) and drives the
// actual capture + popup + options flows. Copies are triggered by real DOM
// `copy` events so the content-script capturer runs exactly as it does in the
// wild — we never touch the OS clipboard. Usage: npm run test:ui
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

// Realistic clipboard fodder: an address, a tracking number, a code snippet, a
// URL, a paragraph — plus a few extra clips to force cap eviction later.
const SNIPPETS = [
  "221B Baker Street, London NW1 6XE",
  "1Z999AA10123456784",
  "const total = items.reduce((a, b) => a + b.price, 0);",
  "https://github.com/zoneoutreal/getrichfast/releases/tag/v1.0.0",
  "Thanks for the update — I reviewed the draft and it looks great. Let's ship Monday.",
  "sk-example-EVICT-11111",
  "sk-example-EVICT-22222",
  "sk-example-EVICT-33333",
  "sk-example-EVICT-44444"
];
const PAGE_HTML =
  `<!DOCTYPE html><html><body><h1>ClipStack test page</h1>` +
  SNIPPETS.map((s, i) => `<p id="s${i}">${s.replace(/</g, "&lt;")}</p>`).join("") +
  `</body></html>`;

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(PAGE_HTML);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PAGE_URL = `http://127.0.0.1:${server.address().port}/`;

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "clipstack-uitest-"));
const extArgs = [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`];

async function launch() {
  try {
    const ctx = await chromium.launchPersistentContext(userDataDir, { headless: true, executablePath, args: extArgs });
    const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 8000 }));
    return { ctx, sw };
  } catch {
    const ctx = await chromium.launchPersistentContext(userDataDir + "-2", {
      headless: false,
      executablePath,
      args: [...extArgs, "--headless=new"]
    });
    const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 8000 }));
    return { ctx, sw };
  }
}

const { ctx, sw } = await launch();
const extId = new URL(sw.url()).host;
check("service worker registered (background boots)", !!extId, sw.url());

const popupURL = `chrome-extension://${extId}/src/popup/popup.html`;
const optionsURL = `chrome-extension://${extId}/src/options/options.html`;

// A dedicated extension page just for reading/writing storage in assertions.
const storePage = await ctx.newPage();
await storePage.goto(popupURL);
await storePage.waitForFunction(() => window.__csReady);
const getClips = () => storePage.evaluate(() => new Promise((res) => chrome.storage.local.get({ clips: [] }, (d) => res(d.clips))));
const setSettings = (s) => storePage.evaluate((v) => new Promise((res) => chrome.storage.local.set({ settings: v }, res)), s);

// Open the live web page and let the content script attach.
const web = await ctx.newPage();
await web.goto(PAGE_URL);
await web.waitForTimeout(500);

// Select an element's text and fire a real `copy` event on it.
async function copyEl(id) {
  await web.evaluate((elId) => {
    const el = document.getElementById(elId);
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    el.dispatchEvent(new ClipboardEvent("copy", { bubbles: true, cancelable: true }));
  }, id);
  await web.waitForTimeout(120);
}

// ---- capture the first five snippets --------------------------------------
for (let i = 0; i < 5; i++) await copyEl("s" + i);
const captured = await waitFor(async () => {
  const clips = await getClips();
  return clips.length >= 5 ? clips : null;
});
check("content script captured every copy event", captured && captured.length === 5, `len=${captured && captured.length}`);
check("all five distinct snippets are stored", SNIPPETS.slice(0, 5).every((t) => captured.some((c) => c.text === t)));
check("stored newest-first (last copy on top)", captured[0].text === SNIPPETS[4], captured[0] && captured[0].text);
check("captured clips carry the source host", captured.every((c) => c.host === "127.0.0.1"), JSON.stringify(captured.map((c) => c.host)));

// ---- re-copy = dedupe + bump, not duplicate --------------------------------
await copyEl("s0");
const afterDup = await waitFor(async () => {
  const clips = await getClips();
  return clips[0] && clips[0].text === SNIPPETS[0] ? clips : null;
});
check("re-copying an existing clip does not duplicate", afterDup.length === 5, `len=${afterDup.length}`);
check("re-copied clip jumps back to the top", afterDup[0].text === SNIPPETS[0], afterDup[0].text);

// ---- popup -----------------------------------------------------------------
const popup = await ctx.newPage();
await popup.goto(popupURL);
await popup.waitForFunction(() => window.__csReady);
check("popup lists all captured clips", (await popup.locator(".clip").count()) === 5, String(await popup.locator(".clip").count()));
check("popup shows the most-recent clip first", (await popup.locator(".clip").first().textContent()).includes("Baker Street"), await popup.locator(".clip").first().textContent());
check("popup hides upgrade when ExtPay unconfigured", await popup.locator("#upgradeBtn").isHidden());
check("popup hides the PRO badge when unpaid", await popup.locator("#proBadge").isHidden());

// search filters
await popup.fill("#search", "reduce");
check("search filters to the code snippet", (await popup.locator(".clip").count()) === 1, String(await popup.locator(".clip").count()));
await popup.fill("#search", "github");
check("search matches a different clip", (await popup.locator(".clip").count()) === 1 && (await popup.locator(".clip").first().textContent()).includes("github"));
await popup.fill("#search", "zzz-none");
check("search with no match shows nothing", (await popup.locator(".clip").count()) === 0);
await popup.fill("#search", "");

// pin moves the github clip to the very top
const ghClip = popup.locator(".clip", { hasText: "github" });
await ghClip.locator(".pin").click();
await popup.waitForTimeout(200);
check("pinning moves the clip to the top", (await popup.locator(".clip").first().textContent()).includes("github"), await popup.locator(".clip").first().textContent());
check("pinned clip is marked pinned", (await popup.locator(".clip").first().getAttribute("class")).includes("pinned"));

// clicking a clip calls the copy-back path (observed via an overridden writeText)
await popup.evaluate(() => {
  window.__writes = [];
  navigator.clipboard.writeText = (t) => {
    window.__writes.push(t);
    return Promise.resolve();
  };
});
await popup.locator(".clip").first().locator(".body").click();
const writes = await popup.evaluate(() => window.__writes);
check("clicking a clip writes it back to the clipboard", writes.length === 1 && writes[0].includes("github"), JSON.stringify(writes));
check("clicking shows the Copied toast", await popup.locator("#toast.show").count() === 1);

// ---- pin protects from cap eviction (end-to-end capture) -------------------
await setSettings({ paused: false, ignore: [], max: 3, pro: false });
for (let i = 5; i < 9; i++) await copyEl("s" + i);
const evicted = await waitFor(async () => {
  const clips = await getClips();
  const unpinned = clips.filter((c) => !c.pinned).length;
  return unpinned <= 3 && clips.some((c) => c.pinned) ? clips : null;
});
check("cap evicts oldest unpinned once the limit is hit", evicted && evicted.filter((c) => !c.pinned).length === 3, `unpinned=${evicted && evicted.filter((c) => !c.pinned).length}`);
check("pinned clip survives eviction", evicted.some((c) => c.pinned && c.text.includes("github")));
check("newest eviction-test clip is present", evicted.some((c) => c.text === SNIPPETS[8]));

// ---- options / manager gating ---------------------------------------------
const opts = await ctx.newPage();
await opts.goto(optionsURL);
await opts.waitForFunction(() => window.__csOptReady);
check("options manager lists clips", (await opts.locator(".item").count()) >= 1, String(await opts.locator(".item").count()));
check("options shows the upsell when unconfigured", await opts.locator("#upsell").isVisible());
await opts.click("#exportBtn");
check("JSON export is Pro-gated in this build", (await opts.locator("#proNote").textContent()).includes("Pro feature"), await opts.locator("#proNote").textContent());
check("options hides the PRO badge when unpaid", await opts.locator("#proBadge").isHidden());

await ctx.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
