// Generates Chrome Web Store screenshots (1280x800) from the REAL JSONPeek
// viewer. Usage: npm run shots
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const outDir = path.join(root, "store", "screenshots");
fs.mkdirSync(outDir, { recursive: true });

const VIEWER = "file://" + path.join(root, "extension", "src", "viewer", "viewer.html");
const PREINSTALLED = "/opt/pw-browsers/chromium";
const launchOpts = fs.existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {};

const SAMPLE = {
  service: "orders-api",
  version: 2,
  live: true,
  region: "us-east-1",
  endpoints: ["/orders", "/orders/{id}", "/health"],
  config: { retries: 3, timeoutMs: 2500, flags: { beta: false, tracing: true } },
  users: [
    { id: 1, name: "Ada Lovelace", email: "ada@example.com", roles: ["admin"], lastSeen: "2026-07-16T09:14:00Z" },
    { id: 2, name: "Linus Chen", email: "linus@example.com", roles: ["dev", "ops"], lastSeen: "2026-07-17T07:41:00Z" },
    { id: 3, name: "Grace Okoro", email: "grace@example.com", roles: ["dev"], lastSeen: "2026-07-15T22:03:00Z" }
  ],
  metrics: { rpm: 1240, p50Ms: 38, p99Ms: 212, errorRate: 0.0021 }
};

const chromeStub = () => {
  const store = { pendingJSON: null };
  const get = (defaults, cb) => {
    const out = { ...defaults, ...store };
    if (cb) return void setTimeout(() => cb(out), 0);
    return Promise.resolve(out);
  };
  const set = (obj, cb) => {
    Object.assign(store, obj);
    if (cb) return void cb();
    return Promise.resolve();
  };
  window.chrome = {
    storage: { local: { get, set }, onChanged: { addListener() {} } },
    runtime: { id: "stub", getURL: (p) => p, onMessage: { addListener() {} } }
  };
};

const browser = await chromium.launch(launchOpts);

async function viewerShot(file, { pro, setupFn, width = 1100, height = 720 }) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: "light", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(chromeStub);
  await page.goto(VIEWER);
  await page.waitForFunction(() => window.__jsonpeekReady);
  await page.evaluate(
    ({ pro, sample }) => {
      if (pro) window.__jsonpeek.setPro(true);
      window.__jsonpeek.loadText(JSON.stringify(sample), "api.example.com");
    },
    { pro, sample: SAMPLE }
  );
  if (setupFn) await setupFn(page);
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(outDir, file) });
  await ctx.close();
  console.log(file);
}

// Raw A: tree with users expanded, a path selected
await viewerShot("_tree.png", {
  pro: false,
  setupFn: async (page) => {
    await page.click('#tree .node[data-path="$.users"] > .row');
    await page.click('#tree .node[data-path="$.users[0]"] > .row');
    await page.click('#tree .node[data-path="$.config"] > .row');
    await page.click('#tree .node[data-path="$.users[0].email"] > .row');
  }
});

// Raw B: Pro query results
await viewerShot("_query.png", {
  pro: true,
  setupFn: async (page) => {
    await page.fill("#query", "$..email");
    await page.press("#query", "Enter");
    await page.waitForSelector("#queryResults:not([hidden])");
  }
});

// Raw C: Pro diff view
await viewerShot("_diff.png", {
  pro: true,
  setupFn: async (page) => {
    await page.click("#diffBtn");
    await page.fill(
      "#diffBox",
      JSON.stringify({ ...SAMPLE, version: 3, metrics: { ...SAMPLE.metrics, p99Ms: 187 }, users: SAMPLE.users.slice(0, 2) })
    );
    await page.click("#diffRun");
  }
});

// ---- compositions ---------------------------------------------------------
const baseCSS = `
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1280px; height: 800px; overflow: hidden; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background:
      radial-gradient(1000px 600px at 110% -10%, #fef3c7 0%, transparent 60%),
      radial-gradient(900px 500px at -10% 110%, #ffedd5 0%, transparent 55%),
      #f6f7fb;
    color: #16182d; display: flex; align-items: center; padding: 56px;
  }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 26px; }
  .mark { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, #f59e0b, #f97316);
          display:flex; align-items:center; justify-content:center; gap:3px; color:#fff; font-weight:700;
          font-family: ui-monospace, Menlo, monospace; font-size: 17px; }
  .mark i { width: 5px; height: 5px; border-radius: 50%; background: #fff; }
  .brand b { font-size: 20px; letter-spacing: -0.01em; }
  h1 { font-size: 45px; line-height: 1.12; letter-spacing: -0.022em; font-weight: 760; margin-bottom: 16px; }
  .sub { font-size: 18.5px; line-height: 1.5; color: #5b6070; max-width: 430px; margin-bottom: 24px; }
  .ticks { display: grid; gap: 11px; font-size: 16px; font-weight: 550; }
  .ticks span::before { content: "✓  "; color: #10b981; font-weight: 800; }
  .left { width: 460px; flex: none; }
  .right { flex: 1; display: flex; justify-content: center; align-items: center; }
  .shot { border-radius: 16px; box-shadow: 0 2px 6px rgba(22,24,45,.08), 0 30px 70px rgba(217,119,6,.25); border: 1px solid #e3e6ef; overflow: hidden; background: #fff; }
`;
const brand = `<div class="brand"><div class="mark">{<i></i>}</div><b>JSONPeek</b></div>`;
const frame = (inner, extra = "") =>
  `<!DOCTYPE html><html><head><style>${baseCSS}${extra}</style></head><body>${inner}</body></html>`;

const rawTree = "file://" + path.join(outDir, "_tree.png");
const rawQuery = "file://" + path.join(outDir, "_query.png");
const rawDiff = "file://" + path.join(outDir, "_diff.png");

const SHOTS = [
  {
    file: "1-hero.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>JSON you can actually read.</h1>
        <div class="sub">One click on any API tab — or paste and drop files — and get a fast collapsible tree with search, paths, and copy-ready output.</div>
        <div class="ticks">
          <span>Collapsible tree with counts &amp; types</span>
          <span>Search that expands to every hit</span>
          <span>Click any node → its exact path</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="${rawTree}" width="712" /></div>
    `)
  },
  {
    file: "2-query.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>Query it like a pro.</h1>
        <div class="sub">$.users[*].name, $..email, negative indexes — JSONPeek Pro answers questions your eyes can't scan for. Plus CSV export and structural diff.</div>
        <div class="ticks">
          <span>JSONPath queries (Pro)</span>
          <span>Flatten to CSV for spreadsheets (Pro)</span>
          <span>No size limit (Pro) — free handles 2 MB</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="${rawQuery}" width="712" /></div>
    `)
  },
  {
    file: "3-diff.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>Spot what changed.</h1>
        <div class="sub">Paste two payloads and see every added, removed, and changed path — perfect for API version bumps, staging vs prod, and "what broke?" moments.</div>
        <div class="ticks">
          <span>Structural diff by path (Pro)</span>
          <span>Added / removed / changed, color-coded</span>
          <span>All local — payloads never leave the tab</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="${rawDiff}" width="712" /></div>
    `)
  },
  {
    file: "4-pricing.png",
    html: frame(`
      <div style="width:100%; display:flex; flex-direction:column; align-items:center; gap:36px;">
        <div style="text-align:center">
          ${brand.replace('class="brand"', 'class="brand" style="justify-content:center"')}
          <h1 style="margin-bottom:10px">Pay once. Peek forever.</h1>
          <div class="sub" style="max-width:600px; margin:0 auto;">The subscription incumbent charges $4.99/month. JSONPeek Pro is $12 once — less than three months of that, forever.</div>
        </div>
        <div style="display:flex; gap:26px;">
          <div class="plan shot">
            <div class="name">Free</div>
            <div class="price">$0</div>
            <div class="feat">✓ Tree view, search, paths<br />✓ One-click grab from API tabs<br />✓ Copy &amp; download formatted JSON<br />✓ Files up to 2 MB</div>
          </div>
          <div class="plan shot pro">
            <div class="name">Pro</div>
            <div class="price">$12 <small>one-time</small></div>
            <div class="feat">✓ Everything in Free<br />✓ No size limit<br />✓ JSONPath queries<br />✓ CSV export + structural diff</div>
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
      .plan.pro { outline: 3px solid #f59e0b; outline-offset: -3px; }
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
