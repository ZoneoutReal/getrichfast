// Generates Chrome Web Store screenshots (1280x800) from the REAL ClipStack
// popup and options UI, seeded with a believable clipboard history via a
// chrome.* stub. Usage: npm run shots
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const outDir = path.join(root, "store", "screenshots");
fs.mkdirSync(outDir, { recursive: true });

const PREINSTALLED = "/opt/pw-browsers/chromium";
const launchOpts = fs.existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {};

const MIN = 60000, HOUR = 3600000, DAY = 86400000;
// A realistic, slightly messy clipboard history: address, tracking number,
// code, URLs, a paragraph, a color, an email, a command, a phone number.
const SEED = [
  { text: "221B Baker Street, London NW1 6XE", host: "maps.google.com", ago: 40000, pinned: true },
  { text: "1Z999AA10123456784", host: "ups.com", ago: 6 * MIN, pinned: true },
  { text: "Hi Sarah — thanks for the quick turnaround. I've attached the revised deck; the Q3 numbers on slide 6 are the ones to review before Thursday.", host: "mail.google.com", ago: 18 * MIN },
  { text: "const total = items.reduce((a, b) => a + b.price, 0);", host: "github.com", ago: 42 * MIN },
  { text: "https://news.ycombinator.com/item?id=39250142", host: "news.ycombinator.com", ago: 1 * HOUR },
  { text: "jordan.lee@example.com", host: "linkedin.com", ago: 2 * HOUR },
  { text: "#f59e0b", host: "coolors.co", ago: 3 * HOUR },
  { text: "git rebase -i HEAD~3", host: "stackoverflow.com", ago: 5 * HOUR },
  { text: "Guest Wi-Fi — network: Lantern, password: sunflower-42-lake", host: "notion.so", ago: 1 * DAY },
  { text: "+1 (415) 555-0132", host: "contacts.google.com", ago: 2 * DAY }
];
const SETTINGS = { paused: false, ignore: ["mybank.com"], max: 50, pro: false };

const chromeStub = (seed, settings) => `
  const now = Date.now();
  const clips = ${JSON.stringify(seed)}.map((c, i) => ({
    id: "seed-" + i, kind: c.kind || "text", text: c.text, host: c.host,
    at: now - c.ago, pinned: !!c.pinned, ...(c.image ? { image: c.image } : {})
  }));
  const local = { clips, settings: ${JSON.stringify(settings)} };
  const get = (defs, cb) => {
    const out = {};
    for (const k in defs) out[k] = k in local ? local[k] : defs[k];
    const r = JSON.parse(JSON.stringify(out));
    return cb ? void setTimeout(() => cb(r), 0) : Promise.resolve(r);
  };
  const set = (obj, cb) => { Object.assign(local, obj); return cb ? void setTimeout(cb, 0) : Promise.resolve(); };
  window.chrome = {
    storage: { local: { get, set }, onChanged: { addListener() {} } },
    runtime: { id: "stub", getURL: (p) => p, sendMessage: () => Promise.resolve({ ok: true }), onMessage: { addListener() {} } },
    tabs: { query: () => Promise.resolve([{ id: 1, url: "https://example.com" }]) }
  };
`;

const browser = await chromium.launch(launchOpts);

async function popupShot(file, { pro, search }) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 620 }, colorScheme: "light", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(chromeStub(SEED, SETTINGS));
  await page.goto("file://" + path.join(root, "extension", "src", "popup", "popup.html"));
  await page.waitForFunction(() => window.__csReady);
  if (pro) await page.evaluate(() => { document.body.classList.add("is-pro"); document.getElementById("proBadge").hidden = false; });
  if (search) await page.fill("#search", search);
  await page.waitForTimeout(200);
  await page.locator("body").screenshot({ path: path.join(outDir, file) });
  await ctx.close();
  console.log(file);
}

async function optionsShot(file, { pro }) {
  const ctx = await browser.newContext({ viewport: { width: 880, height: 840 }, colorScheme: "light", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(chromeStub(SEED, SETTINGS));
  await page.goto("file://" + path.join(root, "extension", "src", "options", "options.html"));
  await page.waitForFunction(() => window.__csOptReady);
  if (pro) await page.evaluate(() => window.__clipstackOpt.setPro(true));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, file) });
  await ctx.close();
  console.log(file);
}

await popupShot("_hist.png", { pro: false });
await popupShot("_search.png", { pro: true, search: "git" });
await optionsShot("_manager.png", { pro: true });

// ---- marketing compositions ------------------------------------------------
const baseCSS = `
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1280px; height: 800px; overflow: hidden; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background:
      radial-gradient(1000px 600px at 110% -10%, #fde68a 0%, transparent 60%),
      radial-gradient(900px 500px at -10% 110%, #fbcfe8 0%, transparent 55%),
      #fdf6f8;
    color: #1a1420; display: flex; align-items: center; padding: 56px;
  }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 26px; }
  .mark { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, #f59e0b, #ec4899);
          display: flex; align-items: center; justify-content: center; color: #fff; font-size: 19px; font-weight: 700; }
  .brand b { font-size: 20px; letter-spacing: -0.01em; }
  h1 { font-size: 45px; line-height: 1.12; letter-spacing: -0.022em; font-weight: 760; margin-bottom: 16px; }
  .sub { font-size: 18.5px; line-height: 1.5; color: #5b5560; max-width: 440px; margin-bottom: 24px; }
  .ticks { display: grid; gap: 11px; font-size: 16px; font-weight: 550; }
  .ticks span::before { content: "✓  "; color: #db2777; font-weight: 800; }
  .left { width: 470px; flex: none; }
  .right { flex: 1; display: flex; justify-content: center; align-items: center; position: relative; }
  .shot { border-radius: 16px; box-shadow: 0 2px 6px rgba(26,20,32,.08), 0 30px 70px rgba(236,72,153,.28); border: 1px solid #f0d9e4; overflow: hidden; background: #fff; }
`;
const brand = `<div class="brand"><div class="mark">❐</div><b>ClipStack</b></div>`;
const frame = (inner, extra = "") => `<!DOCTYPE html><html><head><style>${baseCSS}${extra}</style></head><body>${inner}</body></html>`;

const rawHist = "file://" + path.join(outDir, "_hist.png");
const rawSearch = "file://" + path.join(outDir, "_search.png");
const rawManager = "file://" + path.join(outDir, "_manager.png");

const SHOTS = [
  {
    file: "1-hero.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>Never lose what you copied.</h1>
        <div class="sub">ClipStack quietly keeps a searchable history of everything you copy — so you can paste something from 20 copies ago, in one click.</div>
        <div class="ticks">
          <span>Every copy captured automatically</span>
          <span>Search, pin, and paste back instantly</span>
          <span>100% local — no cloud, no account</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="${rawHist}" width="330" /></div>
    `)
  },
  {
    file: "2-search.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>Search 500 copies in a keystroke.</h1>
        <div class="sub">That address, tracking number, or snippet you copied this morning is one search away. Pin the ones you reuse so they always stay on top.</div>
        <div class="ticks">
          <span>Fuzzy search across text &amp; source site</span>
          <span>Pin favorites — never auto-evicted</span>
          <span>↑ ↓ to move, Enter to copy back</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="${rawSearch}" width="330" /></div>
    `)
  },
  {
    file: "3-manager.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>Your whole history, managed.</h1>
        <div class="sub">Browse and search everything you've copied, pause capture when you need to, and keep sensitive sites out with an ignore list. Clear it all in one click.</div>
        <div class="ticks">
          <span>Pause capture any time</span>
          <span>Ignore-list for banks &amp; secrets</span>
          <span>Export your history as JSON (Pro)</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="${rawManager}" width="540" style="max-height:660px" /></div>
    `)
  },
  {
    file: "4-pricing.png",
    html: frame(`
      <div style="width:100%; display:flex; flex-direction:column; align-items:center; gap:36px;">
        <div style="text-align:center">
          ${brand.replace('class="brand"', 'class="brand" style="justify-content:center"')}
          <h1 style="margin-bottom:10px">Pay once. Remember forever.</h1>
          <div class="sub" style="max-width:560px; margin:0 auto;">No subscription, no account, no data collection — and the free tier already keeps your last 50 copies.</div>
        </div>
        <div style="display:flex; gap:26px;">
          <div class="plan shot">
            <div class="name">Free</div>
            <div class="price">$0</div>
            <div class="feat">✓ Automatic copy history<br />✓ Last 50 text clips<br />✓ Search, pin &amp; paste back<br />✓ Pause &amp; ignore-list</div>
          </div>
          <div class="plan shot pro">
            <div class="name">Pro</div>
            <div class="price">$9 <small>one-time</small></div>
            <div class="feat">✓ Everything in Free<br />✓ Unlimited history<br />✓ Image clips<br />✓ JSON export</div>
          </div>
        </div>
      </div>
    `, `
      body { padding: 48px; }
      .plan { width: 330px; padding: 28px; }
      .plan .name { font-weight: 700; font-size: 17px; color:#5b5560; margin-bottom: 6px; }
      .plan .price { font-size: 42px; font-weight: 780; letter-spacing:-0.02em; margin-bottom: 16px; }
      .plan .feat { line-height: 2.05; font-size: 15px; font-weight: 520; }
      .plan .price small { font-size: 16px; color:#5b5560; font-weight: 600; }
      .plan.pro { outline: 3px solid #ec4899; outline-offset: -3px; }
    `)
  }
];

const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: "light" });
const page2 = await ctx2.newPage();
for (const shot of SHOTS) {
  const tmp = path.join(outDir, "_frame.html");
  fs.writeFileSync(tmp, shot.html);
  await page2.goto("file://" + tmp);
  await page2.waitForTimeout(250);
  await page2.screenshot({ path: path.join(outDir, shot.file) });
  fs.unlinkSync(tmp);
  console.log(shot.file);
}
await ctx2.close();
await browser.close();
console.log("done → " + outDir);
