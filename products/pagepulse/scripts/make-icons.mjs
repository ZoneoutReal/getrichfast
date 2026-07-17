// Generates PagePulse extension icons (16/48/128 px PNG) via Playwright.
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

// Refresh ring + arrowhead + pulse dot on the brand cyan gradient.
const html = (size) => {
  const stroke = Math.max(2, Math.round(size * 0.1));
  const ring = Math.round(size * 0.52);
  const arrow = Math.max(3, Math.round(size * 0.16));
  return `<!DOCTYPE html><html><head><style>
    html, body { margin: 0; background: transparent; }
    #icon {
      width: ${size}px; height: ${size}px; position: relative;
      border-radius: ${Math.round(size * 0.22)}px;
      background: linear-gradient(135deg, #0891b2, #2563eb);
      display: flex; align-items: center; justify-content: center;
    }
    #ring {
      width: ${ring}px; height: ${ring}px; border-radius: 50%;
      border: ${stroke}px solid rgba(255,255,255,0.95);
      border-top-color: transparent;
      transform: rotate(-40deg);
      box-sizing: border-box;
    }
    #head {
      position: absolute;
      top: ${Math.round(size * 0.16)}px; right: ${Math.round(size * 0.2)}px;
      width: 0; height: 0;
      border-left: ${arrow}px solid transparent;
      border-right: ${arrow}px solid transparent;
      border-bottom: ${Math.round(arrow * 1.3)}px solid rgba(255,255,255,0.95);
      transform: rotate(125deg);
    }
    #dot {
      position: absolute; width: ${Math.max(2, Math.round(size * 0.12))}px; height: ${Math.max(2, Math.round(size * 0.12))}px;
      border-radius: 50%; background: #a5f3fc;
    }
  </style></head><body><div id="icon"><div id="ring"></div><div id="head"></div><div id="dot"></div></div></body></html>`;
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
