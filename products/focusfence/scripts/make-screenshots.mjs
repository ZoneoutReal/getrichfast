// Generates Chrome Web Store screenshots (1280x800) from the REAL FocusFence
// UI. Usage: npm run shots
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

const SEED = {
  sites: ["youtube.com", "twitter.com", "*.tiktok.com", "reddit.com/r/all", "news.ycombinator.com"],
  alwaysOn: false,
  schedules: [
    { days: [1, 2, 3, 4, 5], start: "09:00", end: "17:30" },
    { days: [0, 6], start: "22:00", end: "06:00" }
  ],
  strict: true,
  blockMessage: "Back to the thesis. It'll still be there at 5.",
  session: null,
  pro: true
};

const chromeStub = (seed, sessionMins) => `
  const state = ${JSON.stringify(seed)};
  if (${sessionMins} > 0) state.session = { startedAt: Date.now(), endsAt: Date.now() + ${sessionMins} * 60000 + 12000 };
  const get = (d, cb) => { const out = { ...d, state }; return cb ? void setTimeout(() => cb(out), 0) : Promise.resolve(out); };
  const set = (o, cb) => { Object.assign(state, (o && o.state) || {}); return cb ? void cb() : Promise.resolve(); };
  window.chrome = {
    storage: { local: { get, set }, onChanged: { addListener() {} } },
    runtime: {
      id: "stub", getURL: (p) => p, openOptionsPage() {}, onMessage: { addListener() {} },
      sendMessage: (msg) => {
        if (msg.type === "get-state") return Promise.resolve({ ok: true, state, active: !!state.session || state.alwaysOn });
        if (msg.type === "start-session") { state.session = { startedAt: Date.now(), endsAt: Date.now() + msg.minutes * 60000 }; return Promise.resolve({ ok: true, state }); }
        return Promise.resolve({ ok: true, state });
      }
    },
    tabs: { query: () => Promise.resolve([{ id: 1, url: "https://twitter.com/home" }]) }
  };
`;

async function uiShot(file, { pageFile, width, height, seed = SEED, sessionMins = 0, urlQuery = "", setup }) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: "light", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(chromeStub(seed, sessionMins));
  await page.goto("file://" + path.join(root, "extension", pageFile) + urlQuery);
  if (setup) await setup(page);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, file) });
  await ctx.close();
  console.log(file);
}

// Raw A: the fence page mid-session
await uiShot("_blocked.png", {
  pageFile: "src/blocked/blocked.html",
  width: 900,
  height: 620,
  sessionMins: 18,
  urlQuery: "?from=youtube.com"
});

// Raw B: popup with a running session
await uiShot("_popup.png", {
  pageFile: "src/popup/popup.html",
  width: 320,
  height: 480,
  sessionMins: 24,
  setup: (p) => p.waitForFunction(() => window.__ffPopupReady)
});

// Raw C: options with schedules, Pro on
await uiShot("_options.png", {
  pageFile: "src/options/options.html",
  width: 860,
  height: 760,
  setup: async (p) => {
    await p.waitForFunction(() => window.__ffReady);
    await p.evaluate(() => window.__focusfence.setPro(true));
  }
});

// ---- compositions ---------------------------------------------------------
const baseCSS = `
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1280px; height: 800px; overflow: hidden; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background:
      radial-gradient(1000px 600px at 110% -10%, #fee2e2 0%, transparent 60%),
      radial-gradient(900px 500px at -10% 110%, #ffedd5 0%, transparent 55%),
      #f6f7fb;
    color: #16182d; display: flex; align-items: center; padding: 56px;
  }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 26px; }
  .mark { width: 34px; height: 34px; border-radius: 10px; position: relative; background: linear-gradient(135deg, #dc2626, #ea580c); overflow: hidden; }
  .mark s { position: absolute; top: 9px; width: 4px; border-radius: 3px; background: rgba(255,255,255,.95); }
  .mark .k1 { left: 9px; height: 12px; } .mark .k2 { left: 15px; height: 17px; } .mark .k3 { left: 21px; height: 12px; }
  .mark u { position: absolute; left: 6px; right: 6px; top: 18px; height: 2.5px; border-radius: 3px; background: rgba(255,255,255,.6); }
  .brand b { font-size: 20px; letter-spacing: -0.01em; }
  h1 { font-size: 45px; line-height: 1.12; letter-spacing: -0.022em; font-weight: 760; margin-bottom: 16px; }
  .sub { font-size: 18.5px; line-height: 1.5; color: #5b6070; max-width: 430px; margin-bottom: 24px; }
  .ticks { display: grid; gap: 11px; font-size: 16px; font-weight: 550; }
  .ticks span::before { content: "✓  "; color: #10b981; font-weight: 800; }
  .left { width: 460px; flex: none; }
  .right { flex: 1; display: flex; justify-content: center; align-items: center; }
  .shot { border-radius: 16px; box-shadow: 0 2px 6px rgba(22,24,45,.08), 0 30px 70px rgba(220,38,38,.22); border: 1px solid #e3e6ef; overflow: hidden; background: #fff; }
`;
const brand = `<div class="brand"><div class="mark"><s class="k1"></s><s class="k2"></s><s class="k3"></s><u></u></div><b>FocusFence</b></div>`;
const frame = (inner, extra = "") =>
  `<!DOCTYPE html><html><head><style>${baseCSS}${extra}</style></head><body>${inner}</body></html>`;

const rawBlocked = "file://" + path.join(outDir, "_blocked.png");
const rawPopup = "file://" + path.join(outDir, "_popup.png");
const rawOptions = "file://" + path.join(outDir, "_options.png");

const SHOTS = [
  {
    file: "1-hero.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>Your time.<br />Fenced off.</h1>
        <div class="sub">Block distracting sites with focus sessions, always-on mode, or schedules — enforced by Chrome's blocking engine, entirely on your device.</div>
        <div class="ticks">
          <span>25 / 50 / 90-minute focus sessions</span>
          <span>Live countdown on the toolbar badge</span>
          <span>100% local — your browsing stays yours</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="${rawBlocked}" width="680" /></div>
    `)
  },
  {
    file: "2-schedules.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>Set the hours. It holds the line.</h1>
        <div class="sub">Pro schedules block your list automatically — workdays 9:00–17:30, overnight doom-scroll hours, whatever you choose. Strict mode freezes everything until the session ends.</div>
        <div class="ticks">
          <span>Weekly schedules, overnight spans included (Pro)</span>
          <span>Strict mode — no early exits (Pro)</span>
          <span>Wildcards &amp; path patterns like reddit.com/r/all (Pro)</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="${rawOptions}" width="640" /></div>
    `)
  },
  {
    file: "3-popup.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>One click to focus.</h1>
        <div class="sub">Start a session from the toolbar, add the site you're currently doom-scrolling with one click, and watch the countdown hold you to it.</div>
        <div class="ticks">
          <span>"Block this site" from any tab</span>
          <span>7 sites free — Pro is unlimited</span>
          <span>Custom message on the block page (Pro)</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="${rawPopup}" width="330" /></div>
    `)
  },
  {
    file: "4-pricing.png",
    html: frame(`
      <div style="width:100%; display:flex; flex-direction:column; align-items:center; gap:36px;">
        <div style="text-align:center">
          ${brand.replace('class="brand"', 'class="brand" style="justify-content:center"')}
          <h1 style="margin-bottom:10px">Pay once. Focus forever.</h1>
          <div class="sub" style="max-width:620px; margin:0 auto;">The big-name blocker charges $10.99/month and has a history of privacy scandals. FocusFence is $15 once — and it can't sell your data, because it never sees it.</div>
        </div>
        <div style="display:flex; gap:26px;">
          <div class="plan shot">
            <div class="name">Free</div>
            <div class="price">$0</div>
            <div class="feat">✓ Block up to 7 sites<br />✓ Focus sessions with countdown<br />✓ Always-on mode<br />✓ Wildcard subdomains</div>
          </div>
          <div class="plan shot pro">
            <div class="name">Pro</div>
            <div class="price">$15 <small>one-time</small></div>
            <div class="feat">✓ Unlimited sites<br />✓ Weekly schedules<br />✓ Strict mode<br />✓ Path patterns + custom block message</div>
          </div>
        </div>
      </div>
    `, `
      body { padding: 48px; }
      .plan { width: 330px; padding: 28px; }
      .plan .name { font-weight: 700; font-size: 17px; color:#5b6070; margin-bottom: 6px; }
      .plan .price { font-size: 42px; font-weight: 780; letter-spacing:-0.02em; margin-bottom: 16px; }
      .plan .price small { font-size: 16px; color:#5b6070; font-weight: 600; }
      .plan .feat { line-height: 2.05; font-size: 15px; font-weight: 520; }
      .plan.pro { outline: 3px solid #dc2626; outline-offset: -3px; }
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
