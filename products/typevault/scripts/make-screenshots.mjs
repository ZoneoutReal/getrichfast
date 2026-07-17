// Generates Chrome Web Store screenshots (1280x800) from the REAL TypeVault
// popup + options UI, seeded via a chrome.* stub with a believable half-written
// email and a real version history, then composed into marketing frames.
// Usage: npm run shots
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const outDir = path.join(root, "store", "screenshots");
fs.mkdirSync(outDir, { recursive: true });
const iconPath = "file://" + path.join(root, "extension", "icons", "icon128.png");

const PREINSTALLED = "/opt/pw-browsers/chromium";
const launchOpts = fs.existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {};

// The active site the popup "sees" (matches the gmail drafts below).
const ACTIVE = { origin: "https://mail.google.com", host: "mail.google.com", path: "/mail/u/0/" };

// Seeds chrome.storage.local + the tab/messaging surface the popup queries.
function chromeStub(active) {
  const now = Date.now();
  const M = 60000;
  const H = 3600000;
  const v = (text, ago) => ({ text, at: now - ago, len: text.length });
  let n = 0;
  const field = (origin, host, p, label, versions) => {
    const signature = "f_seed" + ++n;
    return [signature, { origin, host, path: p, label, signature, versions, lastEdited: versions[versions.length - 1].at }];
  };

  const vault = Object.fromEntries([
    field("https://mail.google.com", "mail.google.com", "/mail/u/0/", "Message body", [
      v("Hi Priya, thanks so much for the quick turnaround on the Q3 board deck.", 3 * H),
      v("Hi Priya, thanks so much for the quick turnaround on the Q3 board deck. I have a couple of small notes before we share it with the exec team.", 52 * M),
      v("Hi Priya, thanks so much for the fast turnaround on the Q3 board deck. I have a few small notes before we share it with the exec team — mostly on slide 4.", 9 * M)
    ]),
    field("https://mail.google.com", "mail.google.com", "/mail/u/0/", "Subject", [
      v("Re: Q3 board deck — a couple of notes", 55 * M),
      v("Re: Q3 board deck — a few quick notes", 9 * M)
    ]),
    field("https://github.com", "github.com", "/acme/api/pull/482", "Pull request description", [
      v("Refactors the auth middleware to short-circuit expired tokens before hitting the DB.", 6 * H),
      v("Refactors the auth middleware to short-circuit expired tokens before hitting the DB. Adds a regression test for the refresh path and updates the changelog.", 40 * M)
    ]),
    field("https://www.notion.so", "notion.so", "/Weekly-update", "Weekly update", [
      v("This week we shipped the export flow and cut onboarding drop-off by roughly a third.", 5 * H),
      v("This week we shipped the export flow and cut onboarding drop-off by nearly 40%. Next: polish the empty states and start the mobile pass.", 22 * M)
    ]),
    field("https://www.reddit.com", "reddit.com", "/r/webdev/comments", "Comment", [
      v("Honestly the biggest win was moving everything to local-first storage — no backend to babysit.", 2 * H),
      v("Honestly the biggest win was going local-first — zero backend to babysit, and it works offline too.", 18 * M)
    ]),
    field("https://stackoverflow.com", "stackoverflow.com", "/questions/ask", "Your Answer", [
      v("You can dispatch a native input event after setting .value through the prototype setter so React notices the change.", 30 * M)
    ])
  ]);

  window.__data = { vault, settings: { retention: 20, minLen: 15, pausedSites: [], globalPause: false } };
  const get = (defaults, cb) => {
    const out = {};
    for (const k of Object.keys(defaults)) out[k] = k in window.__data ? window.__data[k] : defaults[k];
    return cb ? void setTimeout(() => cb(out), 0) : Promise.resolve(out);
  };
  const set = (obj, cb) => {
    Object.assign(window.__data, obj);
    return cb ? void cb() : Promise.resolve();
  };
  window.chrome = {
    runtime: { id: "stub", getURL: (p) => p, onMessage: { addListener() {} }, sendMessage: () => Promise.resolve({ ok: true }) },
    tabs: {
      query: () => Promise.resolve([{ id: 1, url: active.origin + active.path }]),
      sendMessage: (_id, msg) =>
        Promise.resolve(
          msg && msg.type === "tv-origin"
            ? { ok: true, origin: active.origin, host: active.host, path: active.path, title: active.host }
            : { ok: true, restored: true }
        ),
      create() {}
    },
    storage: { local: { get, set }, onChanged: { addListener() {} } }
  };
}

const browser = await chromium.launch(launchOpts);

async function captureRaw() {
  // --- popup: list view (hero)
  const c1 = await browser.newContext({ viewport: { width: 360, height: 588 }, colorScheme: "light", deviceScaleFactor: 2 });
  const p1 = await c1.newPage();
  await p1.addInitScript(chromeStub, ACTIVE);
  await p1.goto("file://" + path.join(root, "extension", "src", "popup", "popup.html"));
  await p1.waitForFunction(() => window.__tvReady);
  await p1.waitForSelector(".draft");
  await p1.locator("body").screenshot({ path: path.join(outDir, "_popup-list.png") });
  await c1.close();

  // --- popup: version timeline + diff
  const c2 = await browser.newContext({ viewport: { width: 360, height: 588 }, colorScheme: "light", deviceScaleFactor: 2 });
  const p2 = await c2.newPage();
  await p2.addInitScript(chromeStub, ACTIVE);
  await p2.goto("file://" + path.join(root, "extension", "src", "popup", "popup.html"));
  await p2.waitForFunction(() => window.__tvReady);
  await p2.locator(".draft", { hasText: "Message body" }).click();
  await p2.waitForSelector(".ver");
  // reveal the diff on the two newest versions
  const diffBtns = p2.locator(".ver .ver-actions .btn-ghost", { hasText: "Diff" });
  await diffBtns.nth(0).click();
  await diffBtns.nth(1).click();
  await p2.waitForTimeout(150);
  await p2.locator("body").screenshot({ path: path.join(outDir, "_popup-timeline.png") });
  await c2.close();

  // --- options: cross-site manager
  const c3 = await browser.newContext({ viewport: { width: 1180, height: 760 }, colorScheme: "light", deviceScaleFactor: 2 });
  const p3 = await c3.newPage();
  await p3.addInitScript(chromeStub, ACTIVE);
  await p3.goto("file://" + path.join(root, "extension", "src", "options", "options.html"));
  await p3.waitForFunction(() => window.__tvReady);
  await p3.waitForSelector(".drow");
  await p3.screenshot({ path: path.join(outDir, "_options.png") });
  await c3.close();
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
  .brand { display: flex; align-items: center; gap: 11px; margin-bottom: 26px; }
  .brand img { width: 36px; height: 36px; border-radius: 10px; }
  .brand b { font-size: 20px; letter-spacing: -0.01em; }
  h1 { font-size: 45px; line-height: 1.12; letter-spacing: -0.022em; font-weight: 760; margin-bottom: 16px; }
  h1 .hl { background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .sub { font-size: 18.5px; line-height: 1.5; color: #5b6070; max-width: 440px; margin-bottom: 24px; }
  .ticks { display: grid; gap: 11px; font-size: 16px; font-weight: 550; }
  .ticks span::before { content: "✓  "; color: #10b981; font-weight: 800; }
  .left { width: 500px; flex: none; }
  .right { flex: 1; display: flex; justify-content: center; align-items: center; }
  .shot { border-radius: 18px; box-shadow: 0 2px 6px rgba(22,24,45,.08), 0 30px 70px rgba(99,102,241,.28); border: 1px solid #e3e6ef; overflow: hidden; background: #fff; }
`;
const frame = (inner, extra = "") => `<!DOCTYPE html><html><head><style>${baseCSS}${extra}</style></head><body>${inner}</body></html>`;
const brand = `<div class="brand"><img src="${iconPath}" /><b>TypeVault</b></div>`;

const SHOTS = [
  {
    file: "1-hero.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>Never lose <span class="hl">what you typed.</span></h1>
        <div class="sub">TypeVault quietly saves versioned snapshots of every field you type into — email, forms, editors, comments. Clear a form or crash a tab, and your draft is right here.</div>
        <div class="ticks">
          <span>Auto-saves as you type — every field, every site</span>
          <span>Restore any version back into the live field</span>
          <span>100% on-device — passwords always ignored</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="_popup-list.png" width="360" /></div>
    `)
  },
  {
    file: "2-timeline.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>Rewind any field.<br /><span class="hl">See what changed.</span></h1>
        <div class="sub">Scrub the full version timeline for a field and get a word-level diff between any two versions — additions in green, removals struck through. One click restores.</div>
        <div class="ticks">
          <span>Per-field version timeline with timestamps</span>
          <span>Word-level diff vs the previous version</span>
          <span>Restore or copy any snapshot instantly</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="_popup-timeline.png" width="360" /></div>
    `)
  },
  {
    file: "3-manager.png",
    html: frame(`
      <div class="left" style="width:430px">
        ${brand}
        <h1>Every draft, every site, <span class="hl">one vault.</span></h1>
        <div class="sub">The manager gathers your drafts across every site into one searchable, per-site history. Tune retention, pause sites, export as JSON — all on your device.</div>
        <div class="ticks">
          <span>Cross-site history, grouped &amp; searchable</span>
          <span>Retention, per-site pause &amp; global pause</span>
          <span>Export to JSON · clear anytime</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="_options.png" width="700" /></div>
    `)
  },
  {
    file: "4-pricing.png",
    html: frame(`
      <div style="width:100%; display:flex; flex-direction:column; align-items:center; gap:36px;">
        <div style="text-align:center">
          ${brand.replace('class="brand"', 'class="brand" style="justify-content:center"')}
          <h1 style="margin-bottom:10px">Pay once. <span class="hl">Own it forever.</span></h1>
          <div class="sub" style="max-width:600px; margin:0 auto;">No subscription, no account, no cloud. The free tier recovers what most people need — Pro unlocks the full history.</div>
        </div>
        <div style="display:flex; gap:26px;">
          <div class="plan shot">
            <div class="name">Free</div>
            <div class="price">$0</div>
            <div class="feat">✓ Auto-save drafts on every site<br />✓ Restore the last 24h<br />✓ Up to 5 versions per field<br />✓ Current-site timeline &amp; diff</div>
          </div>
          <div class="plan shot pro">
            <div class="name">Pro</div>
            <div class="price">$12 <small>one-time</small></div>
            <div class="feat">✓ Everything in Free<br />✓ Full cross-site history<br />✓ Unlimited versions &amp; retention<br />✓ JSON export</div>
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
      .plan.pro { outline: 3px solid #6366f1; outline-offset: -3px; }
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
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(outDir, shot.file) });
  fs.unlinkSync(tmp);
  console.log(shot.file);
}
await ctx.close();
await browser.close();
console.log("done → " + outDir);
