// Generates the extension icons (16/48/128 px PNG) by rendering an HTML
// mark with Playwright. Usage: npm run icons
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "..", "extension", "icons");
fs.mkdirSync(outDir, { recursive: true });

const PREINSTALLED = "/opt/pw-browsers/chromium";
const launchOpts = fs.existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {};

const html = (size) => `<!DOCTYPE html><html><head><style>
  html, body { margin: 0; background: transparent; }
  #icon {
    width: ${size}px; height: ${size}px;
    border-radius: ${Math.round(size * 0.22)}px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex; align-items: center; justify-content: center;
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-weight: 800; color: #fff;
    font-size: ${Math.round(size * 0.62)}px;
    padding-bottom: ${Math.round(size * 0.04)}px;
    box-sizing: border-box;
  }
</style></head><body><div id="icon">/</div></body></html>`;

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
