// Generates FocusFence extension icons (16/48/128 px PNG) via Playwright.
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

// Fence pickets inside a shield tile on the brand red-orange gradient.
const html = (size) => {
  const pw = Math.max(2, Math.round(size * 0.11));
  const gap = Math.round(size * 0.09);
  const top = Math.round(size * 0.26);
  const h1 = Math.round(size * 0.5);
  const h2 = Math.round(size * 0.38);
  const left = Math.round(size / 2 - pw * 1.5 - gap);
  return `<!DOCTYPE html><html><head><style>
    html, body { margin: 0; background: transparent; }
    #icon {
      width: ${size}px; height: ${size}px; position: relative;
      border-radius: ${Math.round(size * 0.22)}px;
      background: linear-gradient(135deg, #dc2626, #ea580c);
      overflow: hidden;
    }
    .p { position: absolute; width: ${pw}px; border-radius: ${pw}px; background: rgba(255,255,255,0.95); top: ${top}px; }
    .p::before { content: ""; position: absolute; top: -${Math.round(pw * 0.9)}px; left: 0; border-left: ${Math.round(pw / 2)}px solid transparent; border-right: ${Math.round(pw / 2)}px solid transparent; border-bottom: ${Math.round(pw * 0.9)}px solid rgba(255,255,255,0.95); }
    .p1 { left: ${left}px; height: ${h2}px; }
    .p2 { left: ${left + pw + gap}px; height: ${h1}px; }
    .p3 { left: ${left + (pw + gap) * 2}px; height: ${h2}px; }
    #bar { position: absolute; left: ${Math.round(size * 0.18)}px; right: ${Math.round(size * 0.18)}px; top: ${Math.round(size * 0.52)}px; height: ${Math.max(2, Math.round(size * 0.07))}px; border-radius: ${size}px; background: rgba(255,255,255,0.65); }
  </style></head><body><div id="icon">
    <span class="p p1"></span><span class="p p2"></span><span class="p p3"></span>
    <span id="bar"></span>
  </div></body></html>`;
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
