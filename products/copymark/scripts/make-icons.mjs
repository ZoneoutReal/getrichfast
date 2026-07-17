// Generates CopyMark extension icons (16/48/128 px PNG) via Playwright.
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

// "M↓" markdown motif on the brand blue gradient.
const html = (size) => `<!DOCTYPE html><html><head><style>
    html, body { margin: 0; background: transparent; }
    #icon {
      width: ${size}px; height: ${size}px; position: relative;
      border-radius: ${Math.round(size * 0.22)}px;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    }
    #m {
      color: #fff; font-weight: 800; font-size: ${Math.round(size * 0.52)}px;
      letter-spacing: -0.04em; margin-top: -${Math.round(size * 0.06)}px;
    }
    #arrow {
      position: absolute; right: ${Math.round(size * 0.12)}px; bottom: ${Math.round(size * 0.1)}px;
      width: 0; height: 0;
      border-left: ${Math.round(size * 0.11)}px solid transparent;
      border-right: ${Math.round(size * 0.11)}px solid transparent;
      border-top: ${Math.round(size * 0.14)}px solid #a5f3fc;
    }
    #stem {
      position: absolute; right: ${Math.round(size * 0.12 + size * 0.11 - size * 0.035)}px; bottom: ${Math.round(size * 0.1 + size * 0.12)}px;
      width: ${Math.max(2, Math.round(size * 0.07))}px; height: ${Math.round(size * 0.14)}px;
      background: #a5f3fc; border-radius: 2px;
    }
  </style></head><body><div id="icon"><span id="m">M</span><span id="stem"></span><span id="arrow"></span></div></body></html>`;

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
