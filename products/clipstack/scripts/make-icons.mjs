// Generates ClipStack extension icons (16/48/128 px PNG) via Playwright.
// Brand: amber→pink gradient with a stack of clipboard cards.
// Usage: npm run icons
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "..", "extension", "icons");
fs.mkdirSync(outDir, { recursive: true });

const PREINSTALLED = "/opt/pw-browsers/chromium";
const launchOpts = fs.existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {};

// Two offset "cards" behind a solid front card with a clipboard clip on top —
// reads as a stack of saved clips even at 16px.
const html = (size) => {
  const r = Math.round(size * 0.2); // container corner
  const cardW = Math.round(size * 0.5);
  const cardH = Math.round(size * 0.6);
  const cardR = Math.max(2, Math.round(size * 0.1));
  const off = Math.max(1, Math.round(size * 0.085));
  const clipW = Math.round(cardW * 0.42);
  const clipH = Math.max(2, Math.round(size * 0.09));
  return `<!DOCTYPE html><html><head><style>
    html, body { margin: 0; background: transparent; }
    #icon {
      width: ${size}px; height: ${size}px; position: relative;
      border-radius: ${r}px;
      background: linear-gradient(135deg, #f59e0b 0%, #ec4899 100%);
      overflow: hidden;
    }
    .card {
      position: absolute; left: 50%; top: 50%;
      width: ${cardW}px; height: ${cardH}px; border-radius: ${cardR}px;
      transform: translate(-50%, -50%);
      box-sizing: border-box;
    }
    #c3 { background: rgba(255,255,255,0.35); transform: translate(calc(-50% + ${off * 2}px), calc(-50% - ${off * 2}px)); }
    #c2 { background: rgba(255,255,255,0.65); transform: translate(calc(-50% + ${off}px), calc(-50% - ${off}px)); }
    #c1 {
      background: #ffffff;
      box-shadow: 0 ${Math.round(size * 0.03)}px ${Math.round(size * 0.06)}px rgba(120,30,60,0.28);
    }
    #clip {
      position: absolute; left: 50%; top: calc(50% + ${off * 0}px);
      transform: translate(-50%, calc(-50% - ${Math.round(cardH * 0.5) - Math.round(clipH * 0.15)}px));
      width: ${clipW}px; height: ${clipH}px; border-radius: ${clipH}px;
      background: linear-gradient(135deg, #f59e0b, #ec4899);
      z-index: 3;
    }
  </style></head><body>
    <div id="icon">
      <div class="card" id="c3"></div>
      <div class="card" id="c2"></div>
      <div class="card" id="c1"></div>
      <div id="clip"></div>
    </div>
  </body></html>`;
};

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage();
for (const size of [16, 48, 128]) {
  await page.setContent(html(size));
  await page.locator("#icon").screenshot({
    path: path.join(outDir, `icon${size}.png`),
    omitBackground: true
  });
  console.log(`icon${size}.png`);
}
await browser.close();
