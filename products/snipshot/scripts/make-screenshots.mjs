// Generates Chrome Web Store screenshots (1280x800) from the REAL editor UI
// seeded with annotations. Usage: npm run shots
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const outDir = path.join(root, "store", "screenshots");
fs.mkdirSync(outDir, { recursive: true });

const EDITOR = "file://" + path.join(root, "extension", "src", "editor", "editor.html");
const PREINSTALLED = "/opt/pw-browsers/chromium";
const launchOpts = fs.existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {};

const chromeStub = () => {
  window.chrome = {
    storage: {
      local: {
        get(d, cb) {
          setTimeout(() => cb({ pendingCapture: null }), 0);
        },
        set(_o, cb) {
          if (cb) cb();
        }
      },
      onChanged: { addListener() {} }
    },
    runtime: { id: "stub", getURL: (p) => p, onMessage: { addListener() {} }, sendMessage() {} }
  };
};

const browser = await chromium.launch(launchOpts);

async function editorShot(file, { pro, shapes, tool }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "light", deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(chromeStub);
  await page.goto(EDITOR);
  await page.waitForFunction(() => window.__snipshot && window.__snipshot.state.img);
  await page.evaluate(
    ({ pro, shapes, tool }) => {
      const h = window.__snipshot;
      h.state.pro = pro;
      document.querySelectorAll(".tool[data-pro]").forEach((b) => b.classList.toggle("locked", !pro));
      let id = 100;
      for (const s of shapes) h.state.shapes.push({ id: id++, ...s });
      if (tool) {
        document.querySelectorAll("#tools .tool").forEach((b) => b.classList.toggle("active", b.dataset.tool === tool));
      }
      h.render();
    },
    { pro, shapes, tool }
  );
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(outDir, file) });
  await ctx.close();
  console.log(file);
}

// Raw A: free-tier annotations on the demo dashboard
await editorShot("_editor-annotated.png", {
  pro: false,
  tool: "arrow",
  shapes: [
    { type: "rect", x: 415, y: 132, w: 362, h: 196, color: "#3b82f6", stroke: 4 },
    { type: "arrow", x1: 985, y1: 470, x2: 800, y2: 330, color: "#ef4444", stroke: 4 },
    { type: "text", x: 830, y: 490, text: "This number ships Friday", size: 30, color: "#ef4444", stroke: 4 },
    { type: "highlight", x: 36, y: 500, w: 500, h: 40, color: "#f59e0b", stroke: 4 }
  ]
});

// Raw B: Pro tools — blur redaction + numbered steps
await editorShot("_editor-pro.png", {
  pro: true,
  tool: "blur",
  shapes: [
    { type: "blur", x: 56, y: 185, w: 230, h: 62, color: "#ef4444", stroke: 4 },
    { type: "blur", x: 36, y: 493, w: 470, h: 36, color: "#ef4444", stroke: 4 },
    { type: "step", x: 400, y: 230, n: 1, color: "#ef4444", stroke: 4 },
    { type: "step", x: 790, y: 230, n: 2, color: "#ef4444", stroke: 4 },
    { type: "step", x: 1090, y: 500, n: 3, color: "#ef4444", stroke: 4 }
  ]
});

// ---- composition (same frame language as the rest of the portfolio) -------
const baseCSS = `
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1280px; height: 800px; overflow: hidden; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background:
      radial-gradient(1000px 600px at 110% -10%, #ede9fe 0%, transparent 60%),
      radial-gradient(900px 500px at -10% 110%, #e0e7ff 0%, transparent 55%),
      #f6f7fb;
    color: #16182d; display: flex; align-items: center; padding: 56px;
  }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 26px; }
  .mark {
    width: 34px; height: 34px; border-radius: 10px; position: relative;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
  }
  .mark i { position: absolute; inset: 8px; border: 3px solid #fff; border-right-color: transparent; border-bottom-color: transparent; border-radius: 4px; }
  .mark u { position: absolute; right: 8px; bottom: 8px; width: 7px; height: 7px; border-radius: 50%; background: #fff; }
  .brand b { font-size: 20px; letter-spacing: -0.01em; }
  h1 { font-size: 45px; line-height: 1.12; letter-spacing: -0.022em; font-weight: 760; margin-bottom: 16px; }
  .sub { font-size: 18.5px; line-height: 1.5; color: #5b6070; max-width: 420px; margin-bottom: 24px; }
  .ticks { display: grid; gap: 11px; font-size: 16px; font-weight: 550; }
  .ticks span::before { content: "✓  "; color: #10b981; font-weight: 800; }
  .left { width: 460px; flex: none; }
  .right { flex: 1; display: flex; justify-content: center; align-items: center; }
  .shot {
    border-radius: 16px;
    box-shadow: 0 2px 6px rgba(22,24,45,.08), 0 30px 70px rgba(78, 70, 180, .28);
    border: 1px solid #e3e6ef; overflow: hidden; background: #fff;
  }
`;

const brand = `<div class="brand"><div class="mark"><i></i><u></u></div><b>SnipShot</b></div>`;
const frame = (inner, extra = "") =>
  `<!DOCTYPE html><html><head><style>${baseCSS}${extra}</style></head><body>${inner}</body></html>`;

const rawA = "file://" + path.join(outDir, "_editor-annotated.png");
const rawB = "file://" + path.join(outDir, "_editor-pro.png");

const SHOTS = [
  {
    file: "1-hero.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>Screenshot.<br />Annotate. Done.</h1>
        <div class="sub">Capture any page, mark it up in seconds, then copy or download. No account. No cloud. No watermark.</div>
        <div class="ticks">
          <span>Arrows, boxes, highlights &amp; text</span>
          <span>Crop, undo, keyboard shortcuts</span>
          <span>100% local — images never leave your device</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="${rawA}" width="712" /></div>
    `)
  },
  {
    file: "2-redact.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>Blur secrets before you share.</h1>
        <div class="sub">Pixelate revenue, emails, tokens — redaction is baked into the pixels, not layered on top. Add numbered steps for instant tutorials.</div>
        <div class="ticks">
          <span>One-drag blur / pixelate (Pro)</span>
          <span>Numbered step badges (Pro)</span>
          <span>Perfect for docs, bug reports &amp; support</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="${rawB}" width="712" /></div>
    `)
  },
  {
    file: "3-editor.png",
    html: `<!DOCTYPE html><html><head><style>
      * { margin: 0; } html, body { width: 1280px; height: 800px; overflow: hidden; }
      img { width: 1280px; height: 800px; display: block; }
    </style></head><body><img src="${rawA}" /></body></html>`
  },
  {
    file: "4-pricing.png",
    html: frame(`
      <div style="width:100%; display:flex; flex-direction:column; align-items:center; gap:36px;">
        <div style="text-align:center">
          ${brand.replace('class="brand"', 'class="brand" style="justify-content:center"')}
          <h1 style="margin-bottom:10px">Pay once. Own it forever.</h1>
          <div class="sub" style="max-width:560px; margin:0 auto;">Screenshot tools shouldn't be a monthly bill. No subscription. No account. No upload.</div>
        </div>
        <div style="display:flex; gap:26px;">
          <div class="plan shot">
            <div class="name">Free</div>
            <div class="price">$0</div>
            <div class="feat">✓ Capture any page<br />✓ Arrows, boxes, highlight, text<br />✓ Crop, undo, shortcuts<br />✓ Copy &amp; download PNG</div>
          </div>
          <div class="plan shot pro">
            <div class="name">Pro</div>
            <div class="price">$15 <small>one-time</small></div>
            <div class="feat">✓ Everything in Free<br />✓ Blur / pixelate redaction<br />✓ Numbered step badges<br />✓ Ellipse + custom colors, forever</div>
          </div>
        </div>
      </div>
    `, `
      body { padding: 48px; }
      .plan { width: 310px; padding: 28px; }
      .plan .name { font-weight: 700; font-size: 17px; color:#5b6070; margin-bottom: 6px; }
      .plan .price { font-size: 42px; font-weight: 780; letter-spacing:-0.02em; margin-bottom: 16px; }
      .plan .price small { font-size: 16px; color:#5b6070; font-weight: 600; }
      .plan .feat { line-height: 2.05; font-size: 15.5px; font-weight: 520; }
      .plan.pro { outline: 3px solid #6366f1; outline-offset: -3px; }
    `)
  }
];

const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: "light" });
const page2 = await ctx2.newPage();
for (const shot of SHOTS) {
  const tmp = path.join(outDir, "_frame.html");
  fs.writeFileSync(tmp, shot.html);
  await page2.goto("file://" + tmp);
  await page2.waitForTimeout(150);
  await page2.screenshot({ path: path.join(outDir, shot.file) });
  fs.unlinkSync(tmp);
  console.log(shot.file);
}
await ctx2.close();
await browser.close();
console.log("done → " + outDir);
