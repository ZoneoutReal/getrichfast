// Generates Chrome Web Store screenshots (1280x800) from the REAL PagePulse
// popup UI. Usage: npm run shots
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

const browser = await chromium.launch(launchOpts);

const chromeStub = (jobs) => `
  const jobs = ${JSON.stringify(jobs)};
  for (const j of Object.values(jobs)) if (j.relNext) j.nextAt = Date.now() + j.relNext;
  const get = (d, cb) => { const out = { ...d, jobs }; return cb ? void setTimeout(() => cb(out), 0) : Promise.resolve(out); };
  const set = (o, cb) => { Object.assign(jobs, (o && o.jobs) || {}); return cb ? void cb() : Promise.resolve(); };
  window.chrome = {
    storage: { local: { get, set }, onChanged: { addListener() {} } },
    runtime: {
      id: "stub", getURL: (p) => p, onMessage: { addListener() {} },
      sendMessage: (msg) => Promise.resolve({ ok: true, jobs })
    },
    tabs: { query: () => Promise.resolve([{ id: 7, url: "https://queue.example.com/tickets/status" }]) },
    permissions: { request: () => Promise.resolve(true) }
  };
`;

async function popupShot(file, { jobs, pro, setup }) {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 500 }, colorScheme: "light", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(chromeStub(jobs));
  await page.goto("file://" + path.join(root, "extension", "src", "popup", "popup.html"));
  await page.waitForFunction(() => window.__ppPopupReady);
  if (pro) await page.evaluate(() => document.body.classList.add("is-pro"));
  if (setup) await setup(page);
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, file) });
  await ctx.close();
  console.log(file);
}

// Raw A: countdown running on the ticket-queue tab + one more job
await popupShot("_running.png", {
  jobs: {
    7: { tabId: 7, host: "queue.example.com", intervalSec: 30, jitterPct: 0, reloads: 14, relNext: 11000, startedAt: 0 },
    9: { tabId: 9, host: "dashboard.example.com", intervalSec: 300, jitterPct: 0, reloads: 3, relNext: 140000, startedAt: 0 }
  },
  pro: false
});

// Raw B: setup view with presets + Pro monitor keyword visible
await popupShot("_setup.png", {
  jobs: {},
  pro: true,
  setup: async (page) => {
    await page.check("#monitorOn");
    await page.fill("#keyword", "in stock");
    await page.check("#jitter");
    await page.fill("#custom", "45s");
  }
});

// Raw C: a Chrome-style notification card (illustrates the Pro monitor alert)
async function notifShot(file) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 130 }, colorScheme: "light", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.setContent(`<!DOCTYPE html><html><head><style>
    * { box-sizing: border-box; margin: 0; }
    body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; background: transparent; padding: 6px; }
    .n { background: #fff; border-radius: 12px; box-shadow: 0 4px 18px rgba(0,0,0,.22); padding: 14px 16px; display: flex; gap: 12px; width: 408px; }
    .ic { width: 40px; height: 40px; border-radius: 10px; flex: none;
          background: linear-gradient(135deg, #0891b2, #2563eb); position: relative; }
    .ic::after { content: "↻"; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
                 color: #fff; font-size: 24px; font-weight: 700; }
    b { font-size: 14px; display: block; margin-bottom: 2px; }
    p { font-size: 13px; color: #444; }
    .app { font-size: 11px; color: #999; margin-top: 4px; }
  </style></head><body>
    <div class="n"><div class="ic"></div><div>
      <b>PagePulse</b>
      <p>queue.example.com: "in stock" appeared</p>
      <div class="app">Google Chrome · now</div>
    </div></div>
  </body></html>`);
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(outDir, file), omitBackground: true });
  await ctx.close();
  console.log(file);
}
await notifShot("_notif.png");

// ---- compositions ---------------------------------------------------------
const baseCSS = `
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1280px; height: 800px; overflow: hidden; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background:
      radial-gradient(1000px 600px at 110% -10%, #cffafe 0%, transparent 60%),
      radial-gradient(900px 500px at -10% 110%, #dbeafe 0%, transparent 55%),
      #f6f7fb;
    color: #16182d; display: flex; align-items: center; padding: 56px;
  }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 26px; }
  .mark { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, #0891b2, #2563eb);
          display: flex; align-items: center; justify-content: center; color: #fff; font-size: 21px; font-weight: 700; }
  .brand b { font-size: 20px; letter-spacing: -0.01em; }
  h1 { font-size: 45px; line-height: 1.12; letter-spacing: -0.022em; font-weight: 760; margin-bottom: 16px; }
  .sub { font-size: 18.5px; line-height: 1.5; color: #5b6070; max-width: 430px; margin-bottom: 24px; }
  .ticks { display: grid; gap: 11px; font-size: 16px; font-weight: 550; }
  .ticks span::before { content: "✓  "; color: #10b981; font-weight: 800; }
  .left { width: 460px; flex: none; }
  .right { flex: 1; display: flex; justify-content: center; align-items: center; position: relative; }
  .shot { border-radius: 16px; box-shadow: 0 2px 6px rgba(22,24,45,.08), 0 30px 70px rgba(8,145,178,.28); border: 1px solid #e3e6ef; overflow: hidden; background: #fff; }
`;
const brand = `<div class="brand"><div class="mark">↻</div><b>PagePulse</b></div>`;
const frame = (inner, extra = "") =>
  `<!DOCTYPE html><html><head><style>${baseCSS}${extra}</style></head><body>${inner}</body></html>`;

const rawRunning = "file://" + path.join(outDir, "_running.png");
const rawSetup = "file://" + path.join(outDir, "_setup.png");
const rawNotif = "file://" + path.join(outDir, "_notif.png");

const SHOTS = [
  {
    file: "1-hero.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>Set it. Forget it. Stay fresh.</h1>
        <div class="sub">Auto-refresh any tab on your schedule — queues, dashboards, drops, scores — with a live countdown on the toolbar badge.</div>
        <div class="ticks">
          <span>Presets from 10s to 30m, per tab</span>
          <span>Live countdown badge</span>
          <span>100% local — no account, no tracking</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="${rawRunning}" width="340" /></div>
    `)
  },
  {
    file: "2-monitor.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>It watches, so you don't.</h1>
        <div class="sub">Pro monitor mode reads the page after each refresh and pings you when it changes — or only when your keyword appears or disappears.</div>
        <div class="ticks">
          <span>"in stock" appeared → notification (Pro)</span>
          <span>Custom intervals down to seconds (Pro)</span>
          <span>±20% jitter for polite polling (Pro)</span>
        </div>
      </div>
      <div class="right">
        <img class="shot" src="${rawSetup}" width="340" />
        <img src="${rawNotif}" width="380" style="position:absolute; right:30px; bottom:90px; filter: drop-shadow(0 18px 30px rgba(8,60,90,.3));" />
      </div>
    `)
  },
  {
    file: "3-jobs.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>Every tab, one pulse.</h1>
        <div class="sub">See all refreshing tabs in one list — intervals, hosts, one-click stop. Close a tab and its job cleans up after itself.</div>
        <div class="ticks">
          <span>Per-tab jobs with independent intervals</span>
          <span>Stop one or stop all</span>
          <span>Survives browser restarts</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="${rawRunning}" width="340" /></div>
    `)
  },
  {
    file: "4-pricing.png",
    html: frame(`
      <div style="width:100%; display:flex; flex-direction:column; align-items:center; gap:36px;">
        <div style="text-align:center">
          ${brand.replace('class="brand"', 'class="brand" style="justify-content:center"')}
          <h1 style="margin-bottom:10px">Pay once. Refresh forever.</h1>
          <div class="sub" style="max-width:560px; margin:0 auto;">No subscription, no account, no data collection — and the free tier has everything most people need.</div>
        </div>
        <div style="display:flex; gap:26px;">
          <div class="plan shot">
            <div class="name">Free</div>
            <div class="price">$0</div>
            <div class="feat">✓ Per-tab auto refresh<br />✓ Presets 10s – 30m<br />✓ Live countdown badge<br />✓ Hard reload (cache bypass)</div>
          </div>
          <div class="plan shot pro">
            <div class="name">Pro</div>
            <div class="price">$9 <small>one-time</small></div>
            <div class="feat">✓ Everything in Free<br />✓ Custom intervals (seconds → hours)<br />✓ Change &amp; keyword alerts<br />✓ ±20% jitter</div>
          </div>
        </div>
      </div>
    `, `
      body { padding: 48px; }
      .plan { width: 330px; padding: 28px; }
      .plan .name { font-weight: 700; font-size: 17px; color:#5b6070; margin-bottom: 6px; }
      .plan .price { font-size: 42px; font-weight: 780; letter-spacing:-0.02em; margin-bottom: 16px; }
      .plan .feat { line-height: 2.05; font-size: 15px; font-weight: 520; }
      .plan .price small { font-size: 16px; color:#5b6070; font-weight: 600; }
      .plan.pro { outline: 3px solid #0891b2; outline-offset: -3px; }
    `)
  }
];

const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: "light" });
const page2 = await ctx2.newPage();
for (const shot of SHOTS) {
  const tmp = path.join(outDir, "_frame.html");
  fs.writeFileSync(tmp, shot.html);
  await page2.goto("file://" + tmp);
  await page2.waitForTimeout(200);
  await page2.screenshot({ path: path.join(outDir, shot.file) });
  fs.unlinkSync(tmp);
  console.log(shot.file);
}
await ctx2.close();
await browser.close();
console.log("done → " + outDir);
