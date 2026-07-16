// Generates Chrome Web Store screenshots (1280x800) from the real extension
// UI plus composed marketing frames. Usage: npm run shots
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

const DEMO = {
  snippets: [
    { id: "1", shortcut: "addr", text: "428 Fairview Ave, Suite 210\nPortland, OR 97210", createdAt: 1 },
    { id: "2", shortcut: "sig", text: "Best,\nJordan Reyes\nCustomer Success — Brightline", createdAt: 2 },
    { id: "3", shortcut: "ty", text: "Thank you so much — really appreciate your patience!", createdAt: 3 },
    { id: "4", shortcut: "meet", text: "Would {date+1} at {time} work for a quick call?", createdAt: 4 },
    { id: "5", shortcut: "refund", text: "I've processed that refund — you'll see it back on your card in 3–5 business days. Anything else I can help with?", createdAt: 5 },
    { id: "6", shortcut: "follow", text: "Just floating this to the top of your inbox — any thoughts?", createdAt: 6 },
    { id: "7", shortcut: "inv", text: "Hi! Attaching invoice #{cursor} — due {date+14}. Thanks!", createdAt: 7 }
  ],
  settings: { prefix: "/", expandMode: "instant", enabled: true },
  stats: {
    total: 1284,
    byId: { 1: 214, 2: 371, 3: 298, 4: 117, 5: 164, 6: 89, 7: 31 }
  }
};

const chromeStub = (seed) => {
  window.__data = seed;
  window.chrome = {
    runtime: {
      id: "stub",
      getURL: (p) => p,
      onMessage: { addListener() {} },
      sendMessage() {}
    },
    tabs: { create() {} },
    storage: {
      local: {
        get(defaults, cb) {
          const out = {};
          for (const k of Object.keys(defaults)) {
            out[k] = k in window.__data ? window.__data[k] : defaults[k];
          }
          setTimeout(() => cb(out), 0);
        },
        set(obj, cb) {
          Object.assign(window.__data, obj);
          if (cb) cb();
        }
      },
      onChanged: { addListener() {} }
    }
  };
};

const browser = await chromium.launch(launchOpts);

// ---- capture raw UI shots -------------------------------------------------
async function captureRaw() {
  const popupCtx = await browser.newContext({ viewport: { width: 360, height: 560 }, colorScheme: "light" });
  const popupPage = await popupCtx.newPage();
  await popupPage.addInitScript(chromeStub, DEMO);
  await popupPage.goto("file://" + path.join(root, "extension", "src", "popup", "popup.html"));
  await popupPage.waitForSelector("#list li");
  await popupPage.locator("body").screenshot({ path: path.join(outDir, "_popup-raw.png") });
  await popupCtx.close();

  const optCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "light" });
  const optPage = await optCtx.newPage();
  await optPage.addInitScript(chromeStub, DEMO);
  await optPage.goto("file://" + path.join(root, "extension", "src", "options", "options.html"));
  await optPage.waitForSelector("#rows tr");
  await optPage.screenshot({ path: path.join(outDir, "_options-raw.png") });
  await optCtx.close();
}

// ---- composition template ---------------------------------------------------
const baseCSS = `
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1280px; height: 800px; overflow: hidden; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background:
      radial-gradient(1000px 600px at 110% -10%, #ede9fe 0%, transparent 60%),
      radial-gradient(900px 500px at -10% 110%, #e0e7ff 0%, transparent 55%),
      #f6f7fb;
    color: #16182d; display: flex; align-items: center; padding: 64px;
  }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
  .mark {
    width: 34px; height: 34px; border-radius: 10px; color: #fff;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex; align-items: center; justify-content: center;
    font-family: ui-monospace, Menlo, monospace; font-weight: 800; font-size: 20px;
  }
  .brand b { font-size: 20px; letter-spacing: -0.01em; }
  h1 { font-size: 46px; line-height: 1.12; letter-spacing: -0.022em; font-weight: 760; margin-bottom: 18px; }
  h1 .hl { background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .sub { font-size: 19px; line-height: 1.5; color: #5b6070; max-width: 440px; margin-bottom: 26px; }
  .ticks { display: grid; gap: 12px; font-size: 16.5px; font-weight: 550; }
  .ticks span::before { content: "✓  "; color: #10b981; font-weight: 800; }
  .left { width: 500px; flex: none; }
  .right { flex: 1; display: flex; justify-content: center; align-items: center; }
  .shot {
    border-radius: 18px;
    box-shadow: 0 2px 6px rgba(22,24,45,.08), 0 30px 70px rgba(78, 70, 180, .28);
    border: 1px solid #e3e6ef; overflow: hidden; background: #fff;
  }
  .chip {
    font-family: ui-monospace, Menlo, monospace; font-weight: 700; font-size: 15px;
    background: #eef0ff; color: #6366f1; border-radius: 7px; padding: 2px 9px;
  }
`;

function frame(inner, extraCSS = "") {
  return `<!DOCTYPE html><html><head><style>${baseCSS}${extraCSS}</style></head><body>${inner}</body></html>`;
}

const brand = `<div class="brand"><div class="mark">/</div><b>SnipKey</b></div>`;

const SHOTS = [
  {
    file: "1-hero.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>Type it once.<br /><span class="hl">/snip</span> it forever.</h1>
        <div class="sub">Create text snippets that expand the instant you type their shortcut — in email, CRMs, support desks, forms. Anywhere.</div>
        <div class="ticks">
          <span>Instant expansion as you type</span>
          <span>Dynamic dates, times &amp; cursor position</span>
          <span>100% local — nothing ever leaves your browser</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="_popup-raw.png" width="384" /></div>
    `)
  },
  {
    file: "2-manager.png",
    html: frame(`
      <div class="left" style="width:420px">
        ${brand}
        <h1>Every snippet, one clean dashboard.</h1>
        <div class="sub">Search, edit and organize your library. See what actually saves you time with local usage stats.</div>
        <div class="ticks">
          <span>Live usage counts per snippet</span>
          <span>Import / export as JSON</span>
          <span>Custom trigger prefix &amp; expand mode</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="_options-raw.png" width="700" /></div>
    `)
  },
  {
    file: "3-everywhere.png",
    html: frame(`
      <div style="width:100%; display:flex; flex-direction:column; align-items:center; gap:34px;">
        <div style="text-align:center">
          ${brand.replace('class="brand"', 'class="brand" style="justify-content:center"')}
          <h1 style="margin-bottom:10px">Works everywhere you type.</h1>
          <div class="sub" style="max-width:640px; margin:0 auto;">If it has a text box, SnipKey works in it — rich editors included.</div>
        </div>
        <div class="compose shot" style="width:680px">
          <div class="bar"><i></i><i></i><i></i><span>New message</span></div>
          <div class="line"><b>To:</b> sam@acme.com</div>
          <div class="line"><b>Subject:</b> Following up</div>
          <div class="body">
            Hi Sam,<br /><br />
            Great chatting today. Our office address is
            <span class="typed">/addr</span><span class="expanded">428 Fairview Ave, Suite 210, Portland, OR 97210</span> —
            stop by any time.
          </div>
          <div class="hint"><span class="chip">/addr</span> → expanded instantly ⚡</div>
        </div>
        <div class="apps">Email &nbsp;·&nbsp; CRM &nbsp;·&nbsp; Support desk &nbsp;·&nbsp; Docs &amp; wikis &nbsp;·&nbsp; Social &nbsp;·&nbsp; Any web form</div>
      </div>
    `, `
      body { padding: 48px; }
      .compose { font-size: 15.5px; }
      .bar { display:flex; align-items:center; gap:7px; background:#f1f2f8; padding:12px 16px; border-bottom:1px solid #e3e6ef; font-weight:600; color:#5b6070; }
      .bar i { width:11px; height:11px; border-radius:50%; background:#d6d9e6; display:inline-block; }
      .bar span { margin-left: 8px; }
      .line { padding: 11px 18px; border-bottom: 1px solid #eef0f6; color:#5b6070; }
      .line b { color:#16182d; font-weight:600; }
      .body { padding: 18px; line-height: 1.65; }
      .typed { text-decoration: line-through; color: #a7abbd; font-family: ui-monospace, Menlo, monospace; margin-right: 8px; }
      .expanded { background: linear-gradient(135deg,#eef0ff,#f5f0ff); border-radius: 6px; padding: 2px 7px; font-weight: 600; }
      .hint { padding: 12px 18px 16px; color:#5b6070; font-size: 14px; }
      .apps { color:#5b6070; font-weight:550; font-size:16px; }
    `)
  },
  {
    file: "4-pricing.png",
    html: frame(`
      <div style="width:100%; display:flex; flex-direction:column; align-items:center; gap:38px;">
        <div style="text-align:center">
          ${brand.replace('class="brand"', 'class="brand" style="justify-content:center"')}
          <h1 style="margin-bottom:10px">Pay once. Own it forever.</h1>
          <div class="sub" style="max-width:560px; margin:0 auto;">No subscription. No account. No cloud. Your snippets never leave your device.</div>
        </div>
        <div style="display:flex; gap:26px;">
          <div class="plan shot">
            <div class="name">Free</div>
            <div class="price">$0</div>
            <div class="feat">✓ 10 snippets<br />✓ Instant expansion everywhere<br />✓ Dynamic dates &amp; {cursor}<br />✓ Import &amp; export</div>
          </div>
          <div class="plan shot pro">
            <div class="name">Pro</div>
            <div class="price">$15 <small>one-time</small></div>
            <div class="feat">✓ Everything in Free<br />✓ Unlimited snippets<br />✓ Every future update included<br />✓ Yours forever</div>
          </div>
        </div>
      </div>
    `, `
      body { padding: 48px; }
      .plan { width: 300px; padding: 28px; }
      .plan .name { font-weight: 700; font-size: 17px; color:#5b6070; margin-bottom: 6px; }
      .plan .price { font-size: 42px; font-weight: 780; letter-spacing:-0.02em; margin-bottom: 16px; }
      .plan .price small { font-size: 16px; color:#5b6070; font-weight: 600; }
      .plan .feat { line-height: 2.05; font-size: 15.5px; font-weight: 520; }
      .plan.pro { outline: 3px solid #6366f1; outline-offset: -3px; position: relative; }
    `)
  }
];

await captureRaw();

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: "light" });
const page = await ctx.newPage();
for (const shot of SHOTS) {
  const tmp = path.join(outDir, "_frame.html");
  fs.writeFileSync(tmp, shot.html);
  await page.goto("file://" + tmp);
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(outDir, shot.file) });
  console.log(shot.file);
  fs.unlinkSync(tmp);
}
await ctx.close();
await browser.close();
console.log("done → " + outDir);
