// Generates Chrome Web Store screenshots (1280x800) from the REAL MockFill
// engine + UI. Usage: npm run shots
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const outDir = path.join(root, "store", "screenshots");
fs.mkdirSync(outDir, { recursive: true });

const ENGINE = fs.readFileSync(path.join(root, "extension", "src", "fill", "engine.js"), "utf8");
const PREINSTALLED = "/opt/pw-browsers/chromium";
const launchOpts = fs.existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {};

const browser = await chromium.launch(launchOpts);

// ---- raw A: a realistic signup form, filled by the real engine ------------
const demoFormHTML = `<!DOCTYPE html><html><head><style>
  * { box-sizing: border-box; margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body { background: #eef1f6; padding: 28px; width: 900px; }
  .card { background: #fff; border-radius: 14px; box-shadow: 0 1px 3px rgba(20,24,40,.08), 0 12px 32px rgba(20,24,40,.08); padding: 28px 32px; }
  h1 { font-size: 22px; letter-spacing: -0.01em; margin-bottom: 4px; }
  .sub { color: #6b7280; font-size: 13.5px; margin-bottom: 22px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 18px; }
  .full { grid-column: 1 / -1; }
  label { display: block; font-size: 12.5px; font-weight: 600; color: #374151; margin-bottom: 5px; }
  input, select, textarea { width: 100%; font-size: 14px; padding: 9px 11px; border: 1.5px solid #d7dbe4; border-radius: 8px; background: #fbfcfe; color: #111827; }
  textarea { height: 64px; resize: none; }
  .row { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 13px; color: #374151; }
  .row input { width: auto; }
  button { margin-top: 18px; background: #111827; color: #fff; border: none; border-radius: 9px; padding: 11px 20px; font-size: 14px; font-weight: 650; }
</style></head><body>
  <div class="card">
    <h1>Create your account</h1>
    <div class="sub">Start your 30-day trial. No credit card required.</div>
    <form class="grid">
      <div><label>First name</label><input name="first_name" type="text" /></div>
      <div><label>Last name</label><input name="last_name" type="text" /></div>
      <div><label>Work email</label><input name="email" type="email" /></div>
      <div><label>Phone</label><input name="phone" type="tel" /></div>
      <div><label>Company</label><input name="company" type="text" /></div>
      <div><label>Job title</label><input name="job_title" type="text" /></div>
      <div><label>Street address</label><input autocomplete="street-address" type="text" /></div>
      <div><label>City</label><input name="city" type="text" /></div>
      <div><label>State</label><select name="state"><option value="">Select…</option><option value="CA">California</option><option value="NY">New York</option><option value="TX">Texas</option><option value="WA">Washington</option></select></div>
      <div><label>ZIP</label><input name="zip" maxlength="5" type="text" /></div>
      <div class="full"><label>What are you hoping to build?</label><textarea name="message"></textarea></div>
      <div class="full row"><input id="t" type="checkbox" name="agree_terms" /><span>I agree to the Terms of Service and Privacy Policy</span></div>
    </form>
    <button>Create account</button>
  </div>
</body></html>`;

async function rawFormShot(file) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 660 }, colorScheme: "light", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.setContent(demoFormHTML);
  await page.addScriptTag({ content: ENGINE });
  await page.evaluate(() => {
    MockFillEngine.fillDocument(document, { pro: true, seedEnabled: true, seed: "store-shots-7", emailDomain: "example.com" });
  });
  // the toast the injected runner shows, pinned for the shot
  await page.evaluate(() => {
    const el = document.createElement("div");
    el.textContent = "MockFill: filled 12 fields";
    el.style.cssText =
      "position:fixed;right:16px;bottom:16px;background:#16182d;color:#fff;" +
      "font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;padding:10px 14px;" +
      "border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25)";
    document.body.appendChild(el);
  });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(outDir, file) });
  await ctx.close();
  console.log(file);
}
await rawFormShot("_form-filled.png");

// ---- raw B: the real options page, Pro on, rules seeded -------------------
const chromeStub = () => {
  const seeded = {
    settings: {
      emailDomain: "example.com",
      checkAllBoxes: true,
      cardBrand: "visa",
      fillCards: true,
      seedEnabled: true,
      seed: "sprint-42",
      customRules: [
        { pattern: "coupon|promo", action: "value", value: "TESTCODE50" },
        { pattern: "referral", action: "preset", preset: "username" },
        { pattern: "internal_ref", action: "skip" }
      ],
      pro: true
    }
  };
  const get = (_d, cb) => (cb ? setTimeout(() => cb(seeded), 0) : Promise.resolve(seeded));
  const set = (_o, cb) => (cb ? cb() : Promise.resolve());
  window.chrome = {
    storage: { local: { get, set }, onChanged: { addListener() {} } },
    runtime: { id: "stub", getURL: (p) => p, openOptionsPage() {}, onMessage: { addListener() {} }, sendMessage: () => Promise.resolve({ ok: true, filled: 12 }) },
    tabs: { query: () => Promise.resolve([{ id: 1, url: "https://app.example.com/signup" }]) }
  };
};

async function rawOptionsShot(file) {
  const ctx = await browser.newContext({ viewport: { width: 860, height: 700 }, colorScheme: "light", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(chromeStub);
  await page.goto("file://" + path.join(root, "extension", "src", "options", "options.html"));
  await page.waitForFunction(() => window.__mockfillReady);
  await page.evaluate(() => window.__mockfill.setPro(true));
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(outDir, file) });
  await ctx.close();
  console.log(file);
}
await rawOptionsShot("_options-pro.png");

// ---- raw C: the real popup after a successful fill ------------------------
async function rawPopupShot(file) {
  const ctx = await browser.newContext({ viewport: { width: 300, height: 250 }, colorScheme: "light", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(chromeStub);
  await page.goto("file://" + path.join(root, "extension", "src", "popup", "popup.html"));
  await page.waitForSelector("#fillBtn");
  await page.click("#fillBtn");
  await page.waitForSelector("#result:not([hidden])");
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(outDir, file) });
  await ctx.close();
  console.log(file);
}
await rawPopupShot("_popup.png");

// ---- compositions (portfolio frame language) ------------------------------
const baseCSS = `
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1280px; height: 800px; overflow: hidden; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background:
      radial-gradient(1000px 600px at 110% -10%, #d8f5ec 0%, transparent 60%),
      radial-gradient(900px 500px at -10% 110%, #d9f2f1 0%, transparent 55%),
      #f6f7fb;
    color: #16182d; display: flex; align-items: center; padding: 56px;
  }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 26px; }
  .mark { width: 34px; height: 34px; border-radius: 10px; position: relative; background: linear-gradient(135deg, #0ea5a3, #10b981); overflow: hidden; }
  .mark s { position: absolute; left: 8px; height: 3px; border-radius: 3px; background: rgba(255,255,255,.94); }
  .mark .s1 { top: 8px; width: 18px; } .mark .s2 { top: 14px; width: 12px; } .mark .s3 { top: 20px; width: 8px; }
  .mark u { position: absolute; right: 4px; bottom: 3px; width: 11px; height: 13px; background: #fde047; clip-path: polygon(56% 0, 12% 56%, 40% 56%, 30% 100%, 88% 40%, 55% 40%); }
  .brand b { font-size: 20px; letter-spacing: -0.01em; }
  h1 { font-size: 45px; line-height: 1.12; letter-spacing: -0.022em; font-weight: 760; margin-bottom: 16px; }
  .sub { font-size: 18.5px; line-height: 1.5; color: #5b6070; max-width: 430px; margin-bottom: 24px; }
  .ticks { display: grid; gap: 11px; font-size: 16px; font-weight: 550; }
  .ticks span::before { content: "✓  "; color: #10b981; font-weight: 800; }
  .left { width: 460px; flex: none; }
  .right { flex: 1; display: flex; justify-content: center; align-items: center; }
  .shot { border-radius: 16px; box-shadow: 0 2px 6px rgba(22,24,45,.08), 0 30px 70px rgba(14,116,110,.28); border: 1px solid #e3e6ef; overflow: hidden; background: #fff; }
`;
const brand = `<div class="brand"><div class="mark"><s class="s1"></s><s class="s2"></s><s class="s3"></s><u></u></div><b>MockFill</b></div>`;
const frame = (inner, extra = "") =>
  `<!DOCTYPE html><html><head><style>${baseCSS}${extra}</style></head><body>${inner}</body></html>`;

const rawForm = "file://" + path.join(outDir, "_form-filled.png");
const rawOptions = "file://" + path.join(outDir, "_options-pro.png");
const rawPopup = "file://" + path.join(outDir, "_popup.png");

const SHOTS = [
  {
    file: "1-hero.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>Every form.<br />One keystroke.<br />Filled.</h1>
        <div class="sub">Realistic fake data for testing signup flows, checkouts, and admin forms — names, emails, phones, addresses, dates. Built for developers &amp; QA.</div>
        <div class="ticks">
          <span>Alt+Shift+F, right-click, or one click</span>
          <span>Smart field detection (autocomplete, labels, names)</span>
          <span>Works with React, Vue &amp; Angular forms</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="${rawForm}" width="700" /></div>
    `)
  },
  {
    file: "2-rules.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>Your forms have quirks. Teach it once.</h1>
        <div class="sub">Pro custom rules match your field names and fill exactly what your app expects — fixed values, presets, or skip. Plus official test cards and seeded, reproducible runs.</div>
        <div class="ticks">
          <span>Custom field rules (regex → value)</span>
          <span>Official test cards — Luhn-valid, never chargeable</span>
          <span>Deterministic seed mode for repeatable bugs</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="${rawOptions}" width="640" /></div>
    `)
  },
  {
    file: "3-fill.png",
    html: `<!DOCTYPE html><html><head><style>
      * { margin: 0; } html, body { width: 1280px; height: 800px; overflow: hidden; position: relative; }
      .bg { width: 1280px; height: 800px; object-fit: cover; object-position: top; display: block; filter: saturate(1.02); }
      .pop { position: absolute; right: 48px; bottom: 48px; width: 300px; border-radius: 14px;
             box-shadow: 0 12px 48px rgba(10,20,30,.4); border: 1px solid #e3e6ef; }
    </style></head><body><img class="bg" src="${rawForm}" /><img class="pop" src="${rawPopup}" /></body></html>`
  },
  {
    file: "4-pricing.png",
    html: frame(`
      <div style="width:100%; display:flex; flex-direction:column; align-items:center; gap:36px;">
        <div style="text-align:center">
          ${brand.replace('class="brand"', 'class="brand" style="justify-content:center"')}
          <h1 style="margin-bottom:10px">Pay once. Test forever.</h1>
          <div class="sub" style="max-width:560px; margin:0 auto;">The incumbent charges $3.99/month. MockFill Pro is $15, once. No account, no subscription, no data collection.</div>
        </div>
        <div style="display:flex; gap:26px;">
          <div class="plan shot">
            <div class="name">Free</div>
            <div class="price">$0</div>
            <div class="feat">✓ Unlimited smart form filling<br />✓ All field types &amp; frameworks<br />✓ Keyboard shortcut + context menu<br />✓ Safe fake data (reserved domains/numbers)</div>
          </div>
          <div class="plan shot pro">
            <div class="name">Pro</div>
            <div class="price">$15 <small>one-time</small></div>
            <div class="feat">✓ Everything in Free<br />✓ Custom field rules for your app<br />✓ Official test credit cards<br />✓ Deterministic seed mode</div>
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
      .plan.pro { outline: 3px solid #10b981; outline-offset: -3px; }
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
