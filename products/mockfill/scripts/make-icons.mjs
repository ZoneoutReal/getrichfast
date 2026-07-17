// Generates MockFill extension icons (16/48/128 px PNG) via Playwright.
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

// Form lines + lightning bolt on the brand teal gradient.
const html = (size) => {
  const line = Math.max(1, Math.round(size * 0.09));
  const inset = Math.round(size * 0.22);
  const gap = Math.round(size * 0.16);
  const boltW = Math.round(size * 0.34);
  return `<!DOCTYPE html><html><head><style>
    html, body { margin: 0; background: transparent; }
    #icon {
      width: ${size}px; height: ${size}px; position: relative;
      border-radius: ${Math.round(size * 0.22)}px;
      background: linear-gradient(135deg, #0ea5a3, #10b981);
      box-sizing: border-box; overflow: hidden;
    }
    .l { position: absolute; left: ${inset}px; height: ${line}px; border-radius: ${line}px;
         background: rgba(255,255,255,0.92); }
    .l1 { top: ${inset}px; width: ${size - inset * 2}px; }
    .l2 { top: ${inset + gap}px; width: ${Math.round((size - inset * 2) * 0.66)}px; }
    .l3 { top: ${inset + gap * 2}px; width: ${Math.round((size - inset * 2) * 0.45)}px; }
    #bolt {
      position: absolute; right: ${Math.round(size * 0.1)}px; bottom: ${Math.round(size * 0.08)}px;
      width: ${boltW}px; height: ${Math.round(boltW * 1.15)}px;
      background: #fde047;
      clip-path: polygon(56% 0, 12% 56%, 40% 56%, 30% 100%, 88% 40%, 55% 40%);
      filter: drop-shadow(0 ${Math.max(1, Math.round(size * 0.02))}px ${Math.max(1, Math.round(size * 0.03))}px rgba(0,0,0,0.25));
    }
  </style></head><body><div id="icon">
    <div class="l l1"></div><div class="l l2"></div><div class="l l3"></div>
    <div id="bolt"></div>
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
