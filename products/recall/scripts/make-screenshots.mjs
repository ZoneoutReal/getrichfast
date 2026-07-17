// Generates Chrome Web Store screenshots (1280×800) from the REAL Recall popup
// and options UIs, seeded with a believable demo index built by the actual
// RecallIndex engine (imported here in Node). Usage: npm run shots
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const outDir = path.join(root, "store", "screenshots");
fs.mkdirSync(outDir, { recursive: true });

const PREINSTALLED = "/opt/pw-browsers/chromium";
const launchOpts = fs.existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {};

// ---- build a realistic demo index with the real engine --------------------
await import(pathToFileURL(path.join(root, "extension", "src", "lib", "index.js")).href);
const RI = globalThis.RecallIndex;
const now = Date.now();
const H = 3600e3;
const D = 24 * H;
const DEMO = [
  ["https://www.quantamagazine.org/the-physics-of-quantum-entanglement", "The Physics of Quantum Entanglement",
    "Two particles can become entangled so that measuring one instantly shapes the other. This quantum correlation underlies teleportation experiments and the long race to build a fault tolerant quantum computer with stable qubits.", 2 * D],
  ["https://www.wired.com/story/the-future-of-computing-is-weird", "The Future of Computing Is Weird",
    "Beyond silicon, researchers chase quantum machines and neuromorphic chips. A quantum processor exploits superposition to explore many states at once, promising breakthroughs in chemistry, materials and cryptography.", 3 * D],
  ["https://baristahustle.com/espresso-extraction-science", "Espresso Extraction Science",
    "Great espresso balances pressure, grind size and water temperature. Under extraction tastes sour while over extraction turns bitter, so dialing in the grinder is the barista's daily morning ritual.", 8 * H],
  ["https://www.nasa.gov/webb-telescope-first-images", "Webb Telescope's First Images",
    "The James Webb Space Telescope peers into infrared light to reveal galaxies that formed shortly after the big bang. Its segmented golden mirror gathers faint light from the earliest cosmic history.", 12 * H],
  ["https://doc.rust-lang.org/book/ownership", "Understanding Rust Ownership",
    "Rust's borrow checker enforces ownership and lifetimes at compile time. Every value has a single owner and references must not outlive the data they point to, which eliminates whole classes of memory bugs.", 1 * D],
  ["https://www.nature.com/articles/crispr-gene-editing-primer", "A Primer on CRISPR Gene Editing",
    "CRISPR Cas9 lets scientists cut DNA at a precise location guided by a short RNA sequence. The genome can then be edited to disable a gene or insert new code, a tool now transforming modern biology.", 4 * D],
  ["https://www.seriouseats.com/how-sourdough-fermentation-works", "How Sourdough Fermentation Works",
    "A sourdough starter is a living culture of wild yeast and bacteria. During a long slow fermentation the dough develops its tang and an open crumb before it bakes into crusty, chewy bread.", 5 * D],
  ["https://colah.github.io/posts/neural-networks-visually", "Neural Networks, Visually",
    "A neural network learns by adjusting weights through gradient descent. Backpropagation sends the error backward layer by layer, gently nudging each parameter until the model's predictions improve.", 6 * D]
];
const demoIndex = RI.emptyIndex();
for (const [url, title, body, ago] of DEMO) RI.addDoc(demoIndex, { url, title, body, visitedAt: now - ago });

// ---- chrome stub that serves the seeded index to the real pages -----------
const chromeStub = (index, pro) => `
  const index = ${JSON.stringify(index)};
  const settings = { paused: false, ignore: [] };
  const merge = (defaults) => {
    const out = Object.assign({}, defaults);
    if ('recall_index' in out) out.recall_index = index;
    if ('recall_settings' in out) out.recall_settings = settings;
    return out;
  };
  window.__DEMO_PRO = ${pro ? "true" : "false"};
  window.chrome = {
    storage: {
      local: {
        get: (d, cb) => { const o = merge(d); return cb ? void cb(o) : Promise.resolve(o); },
        set: (o, cb) => { if (o && o.recall_settings) Object.assign(settings, o.recall_settings); return cb ? void cb() : Promise.resolve(); }
      },
      onChanged: { addListener() {} }
    },
    runtime: { id: "demo", getURL: (p) => p, onMessage: { addListener() {} }, sendMessage: () => Promise.resolve({ ok: true }) },
    tabs: { create() {} }
  };
`;

const browser = await chromium.launch(launchOpts);

async function popupShot(file, { query, pro = false, height = 600 }) {
  const ctx = await browser.newContext({ viewport: { width: 380, height }, colorScheme: "light", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(chromeStub(demoIndex, pro));
  await page.goto("file://" + path.join(root, "extension", "src", "popup", "popup.html"));
  await page.waitForFunction(() => window.__recallPopupReady);
  if (query) {
    await page.fill("#q", query);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(150);
  const buf = await page.locator("body").screenshot({ path: path.join(outDir, file) });
  await ctx.close();
  console.log(file);
  return buf;
}

async function optionsShot(file, { query = "", pro = true }) {
  const ctx = await browser.newContext({ viewport: { width: 1060, height: 780 }, colorScheme: "light", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(chromeStub(demoIndex, pro));
  await page.goto("file://" + path.join(root, "extension", "src", "options", "options.html"));
  await page.waitForFunction(() => window.__recallOptionsReady);
  if (pro) await page.evaluate(() => window.__recallOptions.setPro(true));
  if (query) {
    await page.fill("#q", query);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(outDir, file) });
  await ctx.close();
  console.log(file);
}

// raw UI shots
await popupShot("_popup_hero.png", { query: "quantum", height: 470 });
await popupShot("_popup_aha.png", { query: "teleportation", height: 360 });
// Authentic free state: "Free" badge, free retention line, filters carry a
// PRO tag, and the Pro upsell card is visible — coherent and self-marketing.
await optionsShot("_options.png", { query: "", pro: false });

// ---- marketing compositions -----------------------------------------------
const baseCSS = `
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1280px; height: 800px; overflow: hidden; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background:
      radial-gradient(1000px 600px at 110% -10%, #ccfbf1 0%, transparent 60%),
      radial-gradient(900px 500px at -10% 110%, #dbeafe 0%, transparent 55%),
      #f6f7fb;
    color: #16182d; display: flex; align-items: center; padding: 56px;
  }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
  .mark { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, #0ea5a3, #2563eb);
          display: flex; align-items: center; justify-content: center; color: #fff; font-size: 19px; font-weight: 800; font-family: ui-monospace, Menlo, monospace; }
  .brand b { font-size: 20px; letter-spacing: -0.01em; }
  h1 { font-size: 44px; line-height: 1.12; letter-spacing: -0.022em; font-weight: 760; margin-bottom: 16px; }
  .sub { font-size: 18.5px; line-height: 1.5; color: #5b6070; max-width: 440px; margin-bottom: 24px; }
  .ticks { display: grid; gap: 11px; font-size: 16px; font-weight: 550; }
  .ticks span::before { content: "✓  "; color: #0ea5a3; font-weight: 800; }
  .left { width: 470px; flex: none; }
  .right { flex: 1; display: flex; justify-content: center; align-items: center; position: relative; }
  .shot { border-radius: 16px; box-shadow: 0 2px 6px rgba(22,24,45,.08), 0 30px 70px rgba(14,165,163,.28); border: 1px solid #e3e6ef; overflow: hidden; background: #fff; }
`;
const brand = `<div class="brand"><div class="mark">R</div><b>Recall</b></div>`;
const frame = (inner, extra = "") => `<!DOCTYPE html><html><head><style>${baseCSS}${extra}</style></head><body>${inner}</body></html>`;

const heroImg = "file://" + path.join(outDir, "_popup_hero.png");
const ahaImg = "file://" + path.join(outDir, "_popup_aha.png");
const optImg = "file://" + path.join(outDir, "_options.png");

const SHOTS = [
  {
    file: "1-hero.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>Search your browsing by what was <span style="color:#0ea5a3">on the page</span>.</h1>
        <div class="sub">Chrome only matches titles and URLs. Recall indexes the words in the body of every page you read — so you can find “that article about quantum teleportation” a week later.</div>
        <div class="ticks">
          <span>Full-text search of pages you've actually read</span>
          <span>Ranked results with a matching snippet</span>
          <span>100% local — nothing ever leaves your device</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="${heroImg}" width="360" /></div>
    `)
  },
  {
    file: "2-aha.png",
    html: frame(`
      <div style="width:100%; display:flex; flex-direction:column; align-items:center; text-align:center; gap:8px;">
        ${brand.replace('class="brand"', 'class="brand" style="justify-content:center"')}
        <h1 style="max-width:900px">Your history knows the title.<br/>Recall knows the whole page.</h1>
        <div class="sub" style="max-width:680px; text-align:center;">You remembered a word from the article — not its title. That's exactly the search Chrome can't do, and Recall can.</div>
        <div style="display:flex; gap:26px; align-items:stretch; margin-top:14px;">
          <div class="compare shot bad">
            <div class="ct"><b>Chrome history</b> · search “teleportation”</div>
            <div class="cbody"><div class="none">🚫 No results<br/><span>“teleportation” isn't in any title or URL</span></div></div>
          </div>
          <div class="compare shot good">
            <div class="ct"><b>Recall</b> · search “teleportation”</div>
            <div class="cbody"><img src="${ahaImg}" width="360" /></div>
          </div>
        </div>
      </div>
    `, `
      body { padding: 46px; }
      .compare { width: 420px; text-align: left; display: flex; flex-direction: column; }
      .compare .ct { font-size: 13.5px; padding: 12px 16px; border-bottom: 1px solid #e3e6ef; color: #5b6070; }
      .compare .ct b { color: #16182d; }
      .compare .cbody { padding: 16px; display: flex; justify-content: center; align-items: center; flex: 1; background: #f6f7fb; }
      .compare.good .cbody { background: #fff; }
      .none { text-align: center; color: #9aa1b5; font-size: 15px; line-height: 1.7; }
      .none span { font-size: 12.5px; }
      .compare.bad { outline: 2px solid #fecaca; outline-offset: -2px; }
      .compare.good { outline: 3px solid #0ea5a3; outline-offset: -3px; }
    `)
  },
  {
    file: "3-manager.png",
    html: frame(`
      <div class="left" style="width:420px">
        ${brand}
        <h1>A private index of everything you read.</h1>
        <div class="sub">The full-search page browses your reading memory, filters by site and date, shows what's indexed, and exports to JSON. Pause anytime, ignore any site, clear it all in one click.</div>
        <div class="ticks">
          <span>Filter by site &amp; date range (Pro)</span>
          <span>Ignore-list &amp; one-click pause</span>
          <span>Export your index · clear it instantly</span>
        </div>
      </div>
      <div class="right" style="flex:none; width:660px;"><img class="shot" src="${optImg}" width="660" /></div>
    `, `body { padding: 48px 40px; }`)
  },
  {
    file: "4-pricing.png",
    html: frame(`
      <div style="width:100%; display:flex; flex-direction:column; align-items:center; gap:34px;">
        <div style="text-align:center">
          ${brand.replace('class="brand"', 'class="brand" style="justify-content:center"')}
          <h1 style="margin-bottom:10px">Pay once. Remember forever.</h1>
          <div class="sub" style="max-width:580px; margin:0 auto;">No subscription, no account, no data collection — and the free tier already searches two weeks of your reading.</div>
        </div>
        <div style="display:flex; gap:26px;">
          <div class="plan shot">
            <div class="name">Free</div>
            <div class="price">$0</div>
            <div class="feat">✓ Full-text content search<br />✓ Last 14 days · up to 2,000 pages<br />✓ Ranked results &amp; snippets<br />✓ 100% local &amp; private</div>
          </div>
          <div class="plan shot pro">
            <div class="name">Pro</div>
            <div class="price">$15 <small>one-time</small></div>
            <div class="feat">✓ Everything in Free<br />✓ Unlimited history &amp; page count<br />✓ Filter by site &amp; date range<br />✓ Export your index as JSON</div>
          </div>
        </div>
      </div>
    `, `
      body { padding: 48px; }
      .plan { width: 340px; padding: 28px; }
      .plan .name { font-weight: 700; font-size: 17px; color:#5b6070; margin-bottom: 6px; }
      .plan .price { font-size: 42px; font-weight: 780; letter-spacing:-0.02em; margin-bottom: 16px; }
      .plan .feat { line-height: 2.05; font-size: 15px; font-weight: 520; }
      .plan .price small { font-size: 16px; color:#5b6070; font-weight: 600; }
      .plan.pro { outline: 3px solid #0ea5a3; outline-offset: -3px; }
    `)
  }
];

const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: "light" });
const page2 = await ctx2.newPage();
for (const shot of SHOTS) {
  const tmp = path.join(outDir, "_frame.html");
  fs.writeFileSync(tmp, shot.html);
  await page2.goto("file://" + tmp);
  await page2.waitForTimeout(220);
  await page2.screenshot({ path: path.join(outDir, shot.file) });
  fs.unlinkSync(tmp);
  console.log(shot.file);
}
await ctx2.close();
await browser.close();
console.log("done → " + outDir);
