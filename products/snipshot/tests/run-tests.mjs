// SnipShot editor logic tests: run the real editor page with a chrome.*
// stub (no capture pending → deterministic demo image) and drive the canvas
// with real mouse input. Usage: npm run test:editor
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const EDITOR = "file://" + path.join(here, "..", "extension", "src", "editor", "editor.html");

const PREINSTALLED = "/opt/pw-browsers/chromium";
const launchOpts = fs.existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {};

const results = [];
function check(name, cond, extra = "") {
  results.push({ ok: !!cond, name });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  → " + extra}`);
}

const browser = await chromium.launch(launchOpts);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.chrome = {
    storage: {
      local: {
        get(defaults, cb) {
          setTimeout(() => cb({ pendingCapture: null }), 0);
        },
        set(_obj, cb) {
          if (cb) cb();
        }
      },
      onChanged: { addListener() {} }
    },
    runtime: { id: "stub", getURL: (p) => p, onMessage: { addListener() {} }, sendMessage() {} }
  };
});
await page.goto(EDITOR);
await page.waitForFunction(() => window.__snipshot && window.__snipshot.state.img);

const S = () => page.evaluate(() => ({
  shapes: window.__snipshot.state.shapes,
  tool: window.__snipshot.state.tool,
  selectedId: window.__snipshot.state.selectedId,
  crop: window.__snipshot.state.crop,
  undo: window.__snipshot.state.undo.length,
  redo: window.__snipshot.state.redo.length,
  canvasW: document.getElementById("canvas").width
}));

async function drag(x1, y1, x2, y2) {
  const box = await page.locator("#canvas").boundingBox();
  const scale = box.width / (await page.evaluate(() => document.getElementById("canvas").width));
  await page.mouse.move(box.x + x1 * scale, box.y + y1 * scale);
  await page.mouse.down();
  await page.mouse.move(box.x + x2 * scale, box.y + y2 * scale, { steps: 5 });
  await page.mouse.up();
}

// demo image loads at natural size
let s = await S();
check("demo image loads into canvas", s.canvasW === 1200, String(s.canvasW));
check("default tool is arrow", s.tool === "arrow", s.tool);

// arrow
await drag(100, 150, 300, 260);
s = await S();
check("arrow drawn by drag", s.shapes.length === 1 && s.shapes[0].type === "arrow", JSON.stringify(s.shapes));

// rect
await page.click('[data-tool="rect"]');
await drag(400, 160, 640, 330);
s = await S();
check("rectangle drawn", s.shapes.length === 2 && s.shapes[1].type === "rect", JSON.stringify(s.shapes[1]));

// tiny drag is discarded
await drag(700, 150, 702, 152);
s = await S();
check("tiny drag discarded", s.shapes.length === 2, String(s.shapes.length));

// highlighter
await page.click('[data-tool="highlight"]');
await drag(60, 430, 500, 470);
s = await S();
check("highlight drawn", s.shapes.length === 3 && s.shapes[2].type === "highlight");

// text via floating input
await page.click('[data-tool="text"]');
const box = await page.locator("#canvas").boundingBox();
await page.mouse.click(box.x + 500, box.y + 520);
await page.waitForSelector("#textEditor:not([hidden])");
await page.keyboard.type("Ship it!");
await page.keyboard.press("Enter");
s = await S();
check("text committed via Enter", s.shapes.length === 4 && s.shapes[3].type === "text" && s.shapes[3].text === "Ship it!", JSON.stringify(s.shapes[3]));

// undo / redo
await page.keyboard.press("Control+z");
s = await S();
check("undo removes last shape", s.shapes.length === 3, String(s.shapes.length));
await page.keyboard.press("Control+Shift+z");
s = await S();
check("redo restores it", s.shapes.length === 4, String(s.shapes.length));

// select + delete
await page.click('[data-tool="select"]');
await page.mouse.click(box.x + 500, box.y + 245); // on the rect edge region
s = await S();
check("click selects a shape", s.selectedId !== null, JSON.stringify(s.selectedId));
await page.keyboard.press("Delete");
s = await S();
check("Delete removes selection", s.shapes.length === 3, String(s.shapes.length));

// pro gating: blur locked when unpaid/unconfigured
await page.click('[data-tool="blur"]');
const dialogOpen = await page.evaluate(() => document.getElementById("proDialog").open);
s = await S();
check("blur is Pro-locked (dialog opens)", dialogOpen === true);
check("locked tool does not activate", s.tool === "select", s.tool);
const unavailableShown = await page.evaluate(() => !document.getElementById("proUnavailable").hidden);
check("unconfigured build shows 'not purchasable'", unavailableShown === true);
await page.click("#proCloseBtn");

// simulate a paid user → blur unlocks and pixelates
await page.evaluate(() => {
  window.__snipshot.state.pro = true;
});
await page.click('[data-tool="blur"]');
await drag(80, 560, 400, 640);
s = await S();
check("blur draws for Pro user", s.shapes.some((x) => x.type === "blur"));

// step badges for Pro
await page.click('[data-tool="step"]');
await page.mouse.click(box.x + 900, box.y + 200);
await page.mouse.click(box.x + 950, box.y + 300);
s = await S();
const steps = s.shapes.filter((x) => x.type === "step");
check("step badges number sequentially", steps.length === 2 && steps[0].n === 1 && steps[1].n === 2, JSON.stringify(steps));

// crop
await page.click('[data-tool="crop"]');
await drag(50, 120, 850, 620);
await page.waitForSelector("#cropBar:not([hidden])");
await page.click("#cropApply");
s = await S();
check("crop resizes canvas", s.crop && s.canvasW === s.crop.w && s.crop.w === 800, JSON.stringify(s.crop));
await page.click("#resetCropBtn");
s = await S();
check("uncrop restores full size", !s.crop && s.canvasW === 1200);

// export produces a real PNG
const [download] = await Promise.all([page.waitForEvent("download"), page.click("#downloadBtn")]);
const file = await download.path();
const buf = fs.readFileSync(file);
check("download is a PNG", buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47, buf.slice(0, 4).toString("hex"));
check("PNG has real content", buf.length > 20000, String(buf.length));
check("filename is snipshot-*.png", /^snipshot-\d{8}-\d{6}\.png$/.test(download.suggestedFilename()), download.suggestedFilename());

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
