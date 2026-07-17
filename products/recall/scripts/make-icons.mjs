// Generates Recall extension icons (16/48/128 px PNG) via Playwright.
// Brand mark: a magnifying glass whose lens holds a clock face — "search your
// browsing history" — on the teal→blue gradient. Usage: npm run icons
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "..", "extension", "icons");
fs.mkdirSync(outDir, { recursive: true });

const PREINSTALLED = "/opt/pw-browsers/chromium";
const launchOpts = fs.existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {};

// Drawn on a 100×100 canvas, scaled to each icon size. White is slightly
// translucent so the gradient glows through the strokes.
const svg = (size) => `<!DOCTYPE html><html><head><style>
    html, body { margin: 0; background: transparent; }
    svg { display: block; }
  </style></head><body>
  <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0ea5a3"/>
        <stop offset="1" stop-color="#2563eb"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="100" height="100" rx="23" fill="url(#g)"/>
    <g stroke="rgba(255,255,255,0.97)" fill="none" stroke-linecap="round">
      <line x1="60" y1="60" x2="80" y2="80" stroke-width="10"/>
      <circle cx="42" cy="42" r="25" stroke-width="8"/>
      <line x1="42" y1="42" x2="42" y2="27" stroke-width="4.5"/>
      <line x1="42" y1="42" x2="55" y2="47" stroke-width="4"/>
    </g>
    <circle cx="42" cy="42" r="3.4" fill="#a7f3ef"/>
  </svg>
  </body></html>`;

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage();
for (const size of [16, 48, 128]) {
  await page.setContent(svg(size));
  await page.locator("svg").screenshot({
    path: path.join(outDir, `icon${size}.png`),
    omitBackground: true
  });
  console.log(`icon${size}.png`);
}
await browser.close();
