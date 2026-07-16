// Generates SnipShot extension icons (16/48/128 px PNG) via Playwright.
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

// Selection frame + lens dot on the brand gradient.
const html = (size) => {
  const b = Math.max(1, Math.round(size * 0.09)); // frame stroke
  const inset = Math.round(size * 0.22);
  const dot = Math.round(size * 0.2);
  return `<!DOCTYPE html><html><head><style>
    html, body { margin: 0; background: transparent; }
    #icon {
      width: ${size}px; height: ${size}px; position: relative;
      border-radius: ${Math.round(size * 0.22)}px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      box-sizing: border-box;
    }
    #frame {
      position: absolute; inset: ${inset}px;
      border: ${b}px solid #fff;
      border-radius: ${Math.max(2, Math.round(size * 0.08))}px;
      border-right-color: transparent;
      border-bottom-color: transparent;
    }
    #dot {
      position: absolute; right: ${inset}px; bottom: ${inset}px;
      width: ${dot}px; height: ${dot}px; border-radius: 50%;
      background: #fff;
    }
  </style></head><body><div id="icon"><div id="frame"></div><div id="dot"></div></div></body></html>`;
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
