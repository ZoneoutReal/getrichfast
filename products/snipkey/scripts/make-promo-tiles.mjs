// Generates Chrome Web Store promo tiles (no-alpha JPEGs):
//   small tile  440x280, marquee 1400x560. Usage: npm run tiles
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

const baseCSS = (w, h) => `
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${w}px; height: ${h}px; overflow: hidden; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #fff;
    background:
      radial-gradient(${w}px ${h}px at 115% -20%, rgba(255,255,255,0.16) 0%, transparent 55%),
      radial-gradient(${w * 0.8}px ${h}px at -15% 120%, rgba(255,255,255,0.10) 0%, transparent 50%),
      linear-gradient(135deg, #5457e8, #7c4fe0);
    display: flex; align-items: center;
  }
  .mark {
    border-radius: 22%;
    background: rgba(255,255,255,0.16);
    border: 1.5px solid rgba(255,255,255,0.35);
    display: flex; align-items: center; justify-content: center;
    font-family: ui-monospace, Menlo, monospace; font-weight: 800; color: #fff;
  }
  .tag { font-weight: 620; opacity: 0.92; }
`;

const smallTile = `<!DOCTYPE html><html><head><style>
  ${baseCSS(440, 280)}
  body { flex-direction: column; justify-content: center; gap: 14px; text-align: center; }
  .mark { width: 64px; height: 64px; font-size: 38px; }
  h1 { font-size: 42px; letter-spacing: -0.02em; font-weight: 780; }
  .tag { font-size: 17.5px; }
</style></head><body>
  <div class="mark">/</div>
  <h1>SnipKey</h1>
  <div class="tag">Type it once. /snip it forever.</div>
</body></html>`;

const popupSrc = "file://" + path.join(outDir, "_popup-raw.png");
const marqueeTile = `<!DOCTYPE html><html><head><style>
  ${baseCSS(1400, 560)}
  body { padding: 0 90px; gap: 70px; }
  .left { flex: 1; }
  .brand { display: flex; align-items: center; gap: 14px; margin-bottom: 30px; }
  .mark { width: 58px; height: 58px; font-size: 34px; }
  .brand b { font-size: 34px; letter-spacing: -0.01em; }
  h1 { font-size: 58px; line-height: 1.1; letter-spacing: -0.022em; font-weight: 780; margin-bottom: 18px; }
  .tag { font-size: 24px; max-width: 560px; line-height: 1.45; }
  .chips { display: flex; gap: 12px; margin-top: 26px; }
  .chip { border: 1.5px solid rgba(255,255,255,0.4); background: rgba(255,255,255,0.12);
          border-radius: 999px; padding: 8px 18px; font-size: 16.5px; font-weight: 650; }
  .shotwrap { flex: none; width: 400px; display: flex; align-items: center; }
  img { width: 100%; border-radius: 16px; box-shadow: 0 30px 60px rgba(20, 10, 60, 0.45); }
</style></head><body>
  <div class="left">
    <div class="brand"><div class="mark">/</div><b>SnipKey</b></div>
    <h1>Text expander for everything you retype.</h1>
    <div class="tag">Snippets that expand instantly, anywhere you type. 100% local &amp; private.</div>
    <div class="chips"><span class="chip">⚡ Instant</span><span class="chip">🔒 No cloud</span><span class="chip">💰 Pay once</span></div>
  </div>
  <div class="shotwrap"><img src="${popupSrc}" /></div>
</body></html>`;

const browser = await chromium.launch(launchOpts);
const jobs = [
  { file: "promo-small-440x280.jpg", html: smallTile, w: 440, h: 280 },
  { file: "promo-marquee-1400x560.jpg", html: marqueeTile, w: 1400, h: 560 }
];
for (const job of jobs) {
  const ctx = await browser.newContext({ viewport: { width: job.w, height: job.h }, colorScheme: "light" });
  const page = await ctx.newPage();
  // Load from disk so file:// subresources (the popup image) resolve.
  const tmp = path.join(outDir, "_tile.html");
  fs.writeFileSync(tmp, job.html);
  await page.goto("file://" + tmp);
  await page.waitForTimeout(150);
  fs.unlinkSync(tmp);
  await page.screenshot({ path: path.join(outDir, job.file), type: "jpeg", quality: 92 });
  console.log(job.file);
  await ctx.close();
}
await browser.close();
