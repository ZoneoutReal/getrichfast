// Generates Chrome Web Store promo tiles (no-alpha JPEGs):
//   small tile 440x280, marquee 1400x560. Usage: npm run tiles
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

const mark = (size) => `
  .mark { width: ${size}px; height: ${size}px; border-radius: 22%;
          box-shadow: 0 8px 22px rgba(20,10,60,0.28); }
`;

const baseCSS = (w, h) => `
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${w}px; height: ${h}px; overflow: hidden; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #fff;
    background:
      radial-gradient(${w}px ${h}px at 115% -20%, rgba(255,255,255,0.18) 0%, transparent 55%),
      radial-gradient(${w * 0.8}px ${h}px at -15% 120%, rgba(255,255,255,0.10) 0%, transparent 50%),
      linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex; align-items: center;
  }
  .tag { font-weight: 620; opacity: 0.94; }
`;

const smallTile = `<!DOCTYPE html><html><head><style>
  ${baseCSS(440, 280)} ${mark(66)}
  body { flex-direction: column; justify-content: center; gap: 15px; text-align: center; }
  h1 { font-size: 40px; letter-spacing: -0.02em; font-weight: 780; }
  .tag { font-size: 16.5px; max-width: 340px; }
</style></head><body>
  <img class="mark" src="${iconPath}" />
  <h1>TypeVault</h1>
  <div class="tag">Never lose what you typed.</div>
</body></html>`;

const shotSrc = "file://" + path.join(outDir, "_popup-list.png");
const marqueeTile = `<!DOCTYPE html><html><head><style>
  ${baseCSS(1400, 560)} ${mark(60)}
  body { padding: 0 90px; gap: 64px; }
  .left { flex: 1; }
  .brand { display: flex; align-items: center; gap: 16px; margin-bottom: 26px; }
  .brand b { font-size: 34px; letter-spacing: -0.01em; }
  h1 { font-size: 54px; line-height: 1.1; letter-spacing: -0.022em; font-weight: 780; margin-bottom: 18px; }
  .tag { font-size: 22px; max-width: 560px; line-height: 1.45; }
  .chips { display: flex; gap: 12px; margin-top: 26px; flex-wrap: wrap; }
  .chip { border: 1.5px solid rgba(255,255,255,0.4); background: rgba(255,255,255,0.12);
          border-radius: 999px; padding: 8px 18px; font-size: 16px; font-weight: 650; }
  .shotwrap { flex: none; width: 360px; display: flex; align-items: center; }
  img.shot { width: 100%; border-radius: 16px; box-shadow: 0 30px 60px rgba(20, 10, 60, 0.45); }
</style></head><body>
  <div class="left">
    <div class="brand"><img class="mark" src="${iconPath}" /><b>TypeVault</b></div>
    <h1>Never lose what you typed.</h1>
    <div class="tag">Auto-saves versioned drafts of every field, on-device. Scrub the timeline, diff versions, restore in one click.</div>
    <div class="chips"><span class="chip">🗂 Version timeline</span><span class="chip">🔒 100% local</span><span class="chip">💰 Pay once</span></div>
  </div>
  <div class="shotwrap"><img class="shot" src="${shotSrc}" /></div>
</body></html>`;

const browser = await chromium.launch(launchOpts);
const jobs = [
  { file: "promo-small-440x280.jpg", html: smallTile, w: 440, h: 280 },
  { file: "promo-marquee-1400x560.jpg", html: marqueeTile, w: 1400, h: 560 }
];
for (const job of jobs) {
  const ctx = await browser.newContext({ viewport: { width: job.w, height: job.h }, colorScheme: "light" });
  const page = await ctx.newPage();
  const tmp = path.join(outDir, "_tile.html");
  fs.writeFileSync(tmp, job.html);
  await page.goto("file://" + tmp);
  await page.waitForTimeout(180);
  fs.unlinkSync(tmp);
  await page.screenshot({ path: path.join(outDir, job.file), type: "jpeg", quality: 92 });
  console.log(job.file);
  await ctx.close();
}
await browser.close();
