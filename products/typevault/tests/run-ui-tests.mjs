// TypeVault deep smoke test: loads the REAL extension into a real Chromium
// (service worker, storage, content-script capture on a live http page) and
// drives the actual flows — typing real keystrokes, debounced versioned
// snapshots, password fields ignored, the popup's current-site drafts list,
// live restore back into the field, and Pro gating when unconfigured.
// The whole run retries once if it times out. Usage: npm run test:ui
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

// distinctive content so we can find fields + prove the password never lands
const SUBJECT = "Re: March invoice discrepancy";
const BODY_1 = "Hi Dana, thanks for flagging the mismatch on invoice 4021.";
const BODY_2 = " I've reviewed it and will send a corrected copy tomorrow morning.";
const BODY_FULL = BODY_1 + BODY_2;
const NOTE = "Remember to attach the revised PDF before hitting send.";
const SECRET = "S3cretP@ssw0rd!";

const PAGE_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Support console</title></head>
<body>
  <label for="subject">Subject</label>
  <input type="text" id="subject" name="subject" />
  <label for="body">Your reply</label>
  <textarea id="body" name="message" rows="6"></textarea>
  <label for="note">Internal note</label>
  <div id="note" contenteditable="true" aria-label="Internal note"></div>
  <label for="pw">Password</label>
  <input type="password" id="pw" name="password" autocomplete="off" />
</body></html>`;

async function runOnce() {
  const results = [];
  const check = (name, cond, extra = "") => {
    results.push({ ok: !!cond, name });
    console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  → " + extra}`);
  };
  const waitFor = async (fn, { timeout = 6000, step = 150 } = {}) => {
    const end = Date.now() + timeout;
    let last;
    while (Date.now() < end) {
      last = await fn();
      if (last) return last;
      await new Promise((r) => setTimeout(r, step));
    }
    return last;
  };

  // ---- local http server (content scripts don't run on file:// by default) --
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(PAGE_HTML);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const PORT = server.address().port;
  const PAGE_URL = `http://127.0.0.1:${PORT}/support`;

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "typevault-uitest-"));
  const extArgs = [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`];

  // ---- launch with the real extension (pagepulse bootstrapping) -------------
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

  try {
    const extId = new URL(sw.url()).host;
    check("service worker registered", !!extId, sw.url());

    const optionsURL = `chrome-extension://${extId}/src/options/options.html`;
    const popupURL = `chrome-extension://${extId}/src/popup/popup.html`;

    // extension page used purely to read chrome.storage.local
    const storePage = await ctx.newPage();
    await storePage.goto(optionsURL);
    const storage = (keys = { vault: {}, settings: {} }) =>
      storePage.evaluate((k) => new Promise((res) => chrome.storage.local.get(k, res)), keys);

    // ---- type real keystrokes on a live page --------------------------------
    const web = await ctx.newPage();
    await web.goto(PAGE_URL);
    await web.waitForTimeout(500); // content script boot + settings load

    // content script reachable?
    await web.bringToFront();
    const webTabId = await sw.evaluate(async () => {
      const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return t ? t.id : null;
    });
    const ping = await sw.evaluate(
      (id) => chrome.tabs.sendMessage(id, { type: "tv-ping" }).then((r) => !!(r && r.ok)).catch(() => false),
      webTabId
    );
    check("content script injected & responding", ping === true, String(ping));

    await web.click("#subject");
    await web.keyboard.type(SUBJECT, { delay: 8 });
    await web.waitForTimeout(950); // debounce → version

    // two bursts on the body → two versions for a real timeline + diff
    await web.click("#body");
    await web.keyboard.type(BODY_1, { delay: 6 });
    await web.waitForTimeout(950);
    await web.keyboard.type(BODY_2, { delay: 6 });
    await web.waitForTimeout(950);

    await web.click("#note");
    await web.keyboard.type(NOTE, { delay: 6 });
    await web.waitForTimeout(950);

    // secret typed into a password field — must never be captured
    await web.click("#pw");
    await web.keyboard.type(SECRET, { delay: 6 });
    await web.waitForTimeout(950);

    // ---- assert snapshots landed in storage ---------------------------------
    const vault = await waitFor(async () => {
      const { vault } = await storage({ vault: {} });
      return Object.keys(vault || {}).length >= 3 ? vault : null;
    });
    const fields = Object.values(vault || {});
    const byText = (needle) => fields.find((f) => f.versions.some((v) => v.text.includes(needle)));

    check("captured exactly 3 fields (password excluded)", fields.length === 3, String(fields.length));
    check("subject field captured", !!byText("March invoice discrepancy"));
    const bodyField = byText("invoice 4021");
    check("body (textarea) field captured", !!bodyField);
    check("contenteditable note captured", !!byText("revised PDF"));

    check(
      "body field kept 2 versions (debounced bursts)",
      bodyField && bodyField.versions.length === 2,
      JSON.stringify(bodyField && bodyField.versions.map((v) => v.len))
    );
    check(
      "latest body version holds the full text",
      bodyField && bodyField.versions[bodyField.versions.length - 1].text === BODY_FULL
    );
    check("field records origin + label", bodyField && bodyField.origin.startsWith("http://127.0.0.1") && !!bodyField.label, JSON.stringify(bodyField && { o: bodyField.origin, l: bodyField.label }));

    // the single strongest privacy assertion: the secret is nowhere in storage
    check("password text never stored anywhere in the vault", !JSON.stringify(vault).includes("S3cretP"), "secret leaked!");

    // ---- popup: current-site drafts list ------------------------------------
    const popup = await ctx.newPage();
    // pin the popup's notion of the active tab to the page under test (exactly
    // what a real toolbar popup resolves to); everything else is the real path.
    await popup.addInitScript((tabId) => {
      chrome.tabs.query = () => Promise.resolve([{ id: tabId, active: true, currentWindow: true }]);
    }, webTabId);
    await popup.goto(popupURL);
    await popup.waitForFunction(() => window.__tvReady);
    await popup.waitForSelector(".draft");

    const draftCount = await popup.locator(".draft").count();
    check("popup lists the 3 current-site drafts", draftCount === 3, String(draftCount));
    const popupText = await popup.textContent("#listView");
    check("popup never shows the password draft", !popupText.includes("S3cretP"));
    check("popup upgrade button hidden when unconfigured", await popup.locator("#upgradeBtn").isHidden());

    // ---- live restore back into the field via the popup ---------------------
    await web.fill("#body", ""); // simulate an accidental clear
    check("body field really cleared", (await web.inputValue("#body")) === "");

    await popup.locator(".draft", { hasText: "invoice 4021" }).click();
    await popup.waitForSelector(".ver");
    const marks = await popup.locator(".ver .d-add, .ver .d-del").count();
    // reveal the diff on the newest version to confirm the diff renders
    await popup.locator(".ver .ver-actions .btn-ghost", { hasText: "Diff" }).first().click();
    const marksShown = await popup.locator(".ver .ver-diff .d-add, .ver .ver-diff .d-del").count();
    check("timeline shows a word-level diff (add/del marks)", marks + marksShown > 0, `${marks}/${marksShown}`);

    await popup.locator(".ver .ver-actions .btn-primary", { hasText: "Restore" }).first().click();
    const restored = await waitFor(async () => ((await web.inputValue("#body")) === BODY_FULL ? true : null), { timeout: 4000 });
    check("restore re-injects the draft into the live field", restored === true, await web.inputValue("#body"));

    // ---- Pro gating when unconfigured ---------------------------------------
    const opts = await ctx.newPage();
    await opts.goto(optionsURL);
    await opts.waitForFunction(() => window.__tvReady);
    check("options: Pro card hidden when unconfigured", await opts.locator("#proCard").isHidden());
    await opts.click("#exportBtn");
    await opts.waitForTimeout(200);
    const toast = await opts.textContent("#toast");
    check("options: JSON export gated with an honest Pro note", /Pro feature/i.test(toast), toast);
  } finally {
    await ctx.close();
    server.close();
  }

  return results;
}

// retry the whole run once if it times out / throws
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error("ui run timed out")), ms))
  ]);
}

let results;
try {
  results = await withTimeout(runOnce(), 120000);
} catch (e) {
  console.log(`\n↻ retrying UI run once (${e && e.message ? e.message : e})\n`);
  results = await withTimeout(runOnce(), 120000);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
