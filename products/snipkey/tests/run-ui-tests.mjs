// SnipKey deep smoke test: loads the REAL extension into a real Chromium
// (service worker, storage, content-script injection on a live http page)
// and drives the actual user flows — popup, options, expansion, settings.
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

async function waitFor(fn, { timeout = 5000, step = 100 } = {}) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, step));
  }
  return last;
}

// ---- tiny local http server (content scripts don't run on file:// by default)
const PAGE_HTML = `<!DOCTYPE html><html><body>
  <input type="text" id="plain" />
  <input type="text" id="plain2" />
  <textarea id="ta"></textarea>
  <div id="ce" contenteditable="true"></div>
</body></html>`;
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(PAGE_HTML);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PAGE_URL = `http://127.0.0.1:${server.address().port}/`;

// ---- launch with the real extension --------------------------------------
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "snipkey-uitest-"));
const extArgs = [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`];

async function launch() {
  try {
    const ctx = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      executablePath,
      args: extArgs
    });
    let sw = ctx.serviceWorkers()[0];
    if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 8000 });
    return { ctx, sw };
  } catch {
    // Older headless can't load extensions — retry via --headless=new.
    const ctx = await chromium.launchPersistentContext(userDataDir + "-2", {
      headless: false,
      executablePath,
      args: [...extArgs, "--headless=new"]
    });
    let sw = ctx.serviceWorkers()[0];
    if (!sw) sw = await ctx.waitForEvent("serviceworker", { timeout: 8000 });
    return { ctx, sw };
  }
}

const { ctx, sw } = await launch();
const extId = new URL(sw.url()).host;
check("service worker registered (background boots)", !!extId, sw.url());

const popupURL = `chrome-extension://${extId}/src/popup/popup.html`;
const optionsURL = `chrome-extension://${extId}/src/options/options.html`;

// One extension page just for storage access.
const storePage = await ctx.newPage();
await storePage.goto(popupURL);
const storage = (keys = null) =>
  storePage.evaluate((k) => new Promise((res) => chrome.storage.local.get(k, res)), keys);

// ---- first-run behavior ----------------------------------------------------
const seeded = await waitFor(async () => {
  const { snippets } = await storage({ snippets: [] });
  return snippets.length >= 4 ? snippets : null;
});
check("first run seeds starter snippets", seeded && seeded.length === 4, JSON.stringify(seeded?.map?.((s) => s.shortcut)));

const welcomeOpened = await waitFor(async () =>
  ctx.pages().some((p) => p.url().includes("options.html") && p.url().includes("welcome=1"))
);
check("welcome tab opens on install", !!welcomeOpened);

// ---- content-script expansion on a real page -------------------------------
const web = await ctx.newPage();
await web.goto(PAGE_URL);
await web.waitForTimeout(400); // content script boot + storage load

await web.click("#plain");
await web.keyboard.type("hi /ty", { delay: 10 });
await web.waitForTimeout(120);
const v1 = await web.inputValue("#plain");
check("starter /ty expands on a real page", v1 === "hi Thank you so much — I really appreciate it!", JSON.stringify(v1));

await web.click("#ce");
await web.keyboard.type("/now", { delay: 10 });
await web.waitForTimeout(120);
const ceText = await web.evaluate(() => document.getElementById("ce").innerText.trim());
check("{datetime} starter expands in contenteditable", /\d/.test(ceText) && !ceText.includes("/now"), JSON.stringify(ceText));

// ---- popup ------------------------------------------------------------------
const popup = await ctx.newPage();
await popup.goto(popupURL);
await popup.waitForSelector("#list li");

const count = async () => (await popup.locator("#list li").count());
check("popup lists the 4 starters", (await count()) === 4, String(await count()));

await popup.fill("#search", "/ty");
check("search with visible prefix (/ty) finds the snippet", (await count()) === 1, String(await count()));
await popup.fill("#search", "ty");
check("search without prefix still works", (await count()) >= 1, String(await count()));
await popup.fill("#search", "/intro");
check("search /intro finds it", (await count()) === 1, String(await count()));
await popup.fill("#search", "zzz-nope");
check("search with no match shows none", (await count()) === 0, String(await count()));
await popup.fill("#search", "");

// add flow — user types the prefix into the shortcut field on purpose
await popup.click("#newBtn");
await popup.fill("#newShortcut", "/new1");
await popup.fill("#newText", "Hello from the smoke test");
await popup.click('#addForm button[type="submit"]');
await popup.waitForTimeout(200);
const afterAdd = await storage({ snippets: [] });
const added = afterAdd.snippets.find((s) => s.text === "Hello from the smoke test");
check("popup add saves snippet", !!added);
check("typed prefix is stripped on save (new1, not /new1)", added && added.shortcut === "new1", JSON.stringify(added?.shortcut));
check("popup list refreshes after add", (await count()) === 5, String(await count()));

// kill switch
await popup.click(".switch");
await popup.waitForTimeout(200);
await web.click("#plain2");
await web.keyboard.type("/ty", { delay: 10 });
await web.waitForTimeout(120);
const disabledVal = await web.inputValue("#plain2");
check("popup toggle disables expansion live", disabledVal === "/ty", JSON.stringify(disabledVal));
await popup.click(".switch");
await popup.waitForTimeout(200);
await web.fill("#plain2", "");

// ---- options ----------------------------------------------------------------
const opts = await ctx.newPage();
await opts.goto(optionsURL);
await opts.waitForSelector("#rows tr");

await opts.fill("#search", "/tmrw");
check("options search with prefix works", (await opts.locator("#rows tr").count()) === 1, String(await opts.locator("#rows tr").count()));
await opts.fill("#search", "");

// create → edit → delete via the dialog
await opts.click("#newBtn");
await opts.fill("#editShortcut", "/temp1");
await opts.fill("#editText", "Ping me on {date+2}");
await opts.click("#saveBtn");
await opts.waitForTimeout(200);
let store2 = await storage({ snippets: [] });
const temp = store2.snippets.find((s) => s.shortcut === "temp1");
check("options dialog creates snippet (prefix stripped)", !!temp);

await opts.fill("#search", "temp1");
await opts.click("#rows tr");
await opts.fill("#editText", "Edited text");
await opts.click("#saveBtn");
await opts.waitForTimeout(200);
store2 = await storage({ snippets: [] });
check("options dialog edits snippet", store2.snippets.find((s) => s.shortcut === "temp1")?.text === "Edited text");

await opts.click("#rows tr");
await opts.click("#deleteBtn");
await opts.waitForTimeout(200);
store2 = await storage({ snippets: [] });
check("options dialog deletes snippet", !store2.snippets.some((s) => s.shortcut === "temp1"));
await opts.fill("#search", "");

// prefix change end-to-end
await opts.selectOption("#prefixSelect", ";");
await opts.waitForTimeout(250);
const firstChip = await opts.locator("#rows tr .chip").first().textContent();
check("chips re-render with new prefix", firstChip.startsWith(";"), firstChip);

await web.click("#ta");
await web.keyboard.type("/ty ", { delay: 10 });
await web.waitForTimeout(120);
const oldPrefixVal = await web.inputValue("#ta");
check("old prefix no longer triggers", oldPrefixVal === "/ty ", JSON.stringify(oldPrefixVal));
await web.keyboard.type(";ty", { delay: 10 });
await web.waitForTimeout(120);
const newPrefixVal = await web.inputValue("#ta");
check("new prefix triggers expansion", newPrefixVal.includes("Thank you so much"), JSON.stringify(newPrefixVal));
await opts.selectOption("#prefixSelect", "/");
await opts.waitForTimeout(250);

// payments UI state (offline here: configured but unpaid → upsell visible)
const proHidden = await opts.evaluate(() => document.getElementById("proCard").hidden);
check("Pro card visible when ExtPay configured & unpaid", proHidden === false, String(proHidden));
const badge = await opts.locator("#planBadge").textContent();
check("plan badge shows Free until purchase", badge === "Free", badge);

// import/export round-trip (via the real store lib on the options page)
const exported = await opts.evaluate(() => SnipKeyStore.exportJSON());
const parsed = JSON.parse(exported);
check("export produces valid JSON with snippets", parsed.app === "snipkey" && Array.isArray(parsed.snippets) && parsed.snippets.length >= 5);
const importResult = await opts.evaluate(
  (payload) => SnipKeyStore.importJSON(payload, true),
  JSON.stringify({ snippets: [{ shortcut: "imp1", text: "imported!" }, { shortcut: "ty", text: "duplicate should skip" }] })
);
check("import adds new + skips duplicates", importResult.imported === 1 && importResult.skipped === 1, JSON.stringify(importResult));

// usage stats recorded (debounced flush)
await web.waitForTimeout(900);
const { stats } = await storage({ stats: { total: 0 } });
check("expansion stats recorded locally", stats.total >= 3, JSON.stringify(stats));

await ctx.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
