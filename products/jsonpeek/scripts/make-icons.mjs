// Generates JSONPeek extension icons (16/48/128 px PNG) via Playwright.
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

// Braces + peek dot on the brand amber gradient.
const html = (size) => `<!DOCTYPE html><html><head><style>
    html, body { margin: 0; background: transparent; }
    #icon {
      width: ${size}px; height: ${size}px; position: relative;
      border-radius: ${Math.round(size * 0.22)}px;
      background: linear-gradient(135deg, #f59e0b, #f97316);
      display: flex; align-items: center; justify-content: center; gap: ${Math.round(size * 0.09)}px;
      font-family: ui-monospace, Menlo, Consolas, monospace;
    }
    .brace { color: #fff; font-weight: 700; font-size: ${Math.round(size * 0.62)}px; margin-top: -${Math.round(size * 0.06)}px; }
    #dot { width: ${Math.max(2, Math.round(size * 0.14))}px; height: ${Math.max(2, Math.round(size * 0.14))}px;
           border-radius: 50%; background: #fff; box-shadow: 0 0 0 ${Math.max(1, Math.round(size * 0.04))}px rgba(255,255,255,.35); }
  </style></head><body><div id="icon"><span class="brace">{</span><span id="dot"></span><span class="brace">}</span></div></body></html>`;

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
