// Generates TypeVault extension icons (16/48/128 px PNG) via Playwright.
// Brand: indigo→violet gradient (#6366f1 → #8b5cf6). Mark: a stack of draft
// "version" cards (with content lines) — the saved-history motif.
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

// Stacked version cards on the brand gradient. Drawn in a 96×96 viewBox and
// scaled to each icon size so it stays crisp from 16px to 128px.
const svg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/>
      <stop offset="1" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="96" height="96" rx="22" fill="url(#g)"/>
  <!-- receding stack (older versions) -->
  <rect x="38" y="18" width="40" height="40" rx="10" fill="#ffffff" opacity="0.30"/>
  <rect x="31" y="25" width="40" height="40" rx="10" fill="#ffffff" opacity="0.55"/>
  <!-- front card (current draft) with content lines -->
  <rect x="22" y="33" width="42" height="42" rx="11" fill="#ffffff"/>
  <g stroke="#6366f1" stroke-width="4" stroke-linecap="round">
    <line x1="30" y1="46" x2="56" y2="46"/>
    <line x1="30" y1="54" x2="56" y2="54"/>
    <line x1="30" y1="62" x2="47" y2="62"/>
  </g>
</svg>`;

const html = (size) =>
  `<!DOCTYPE html><html><head><style>html,body{margin:0;background:transparent}</style></head>` +
  `<body><div id="icon" style="width:${size}px;height:${size}px;line-height:0">${svg(size)}</div></body></html>`;

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage();
for (const size of [16, 48, 128]) {
  await page.setContent(html(size));
  await page.locator("#icon").screenshot({ path: path.join(outDir, `icon${size}.png`), omitBackground: true });
  console.log(`icon${size}.png`);
}
await browser.close();
