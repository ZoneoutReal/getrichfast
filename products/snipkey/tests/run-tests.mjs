// SnipKey expansion-engine e2e tests.
// Runs the real content script on a harness page with a chrome.* stub and
// real (CDP-trusted) keystrokes. Usage: npm test
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// In managed environments Chromium is pre-installed at /opt/pw-browsers.
const PREINSTALLED = "/opt/pw-browsers/chromium";
export const launchOpts = fs.existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {};

const here = path.dirname(fileURLToPath(import.meta.url));
const HARNESS = "file://" + path.join(here, "harness.html");

const SNIPPETS = [
  { id: "1", shortcut: "ty", text: "Thank you so much!" },
  { id: "2", shortcut: "addr", text: "123 Main St\nSpringfield {date}" },
  { id: "3", shortcut: "sig", text: "Best regards,\nJon" },
  { id: "4", shortcut: "mid", text: "Hello {cursor}world" },
  { id: "5", shortcut: "a", text: "ALPHA" },
  { id: "6", shortcut: "ab", text: "BETA" }
];

const results = [];
function check(name, cond, extra = "") {
  results.push({ ok: !!cond, name, extra });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  → " + extra}`);
}

const browser = await chromium.launch(launchOpts);

async function newPage(settings) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(
    (seed) => {
      window.__SEED = seed;
    },
    {
      snippets: SNIPPETS,
      settings: Object.assign({ prefix: "/", expandMode: "instant", enabled: true }, settings)
    }
  );
  await page.goto(HARNESS);
  // Give the content script's async storage load a beat to finish.
  await page.waitForTimeout(150);
  return { ctx, page };
}

async function typeInto(page, selector, text) {
  await page.click(selector);
  await page.keyboard.type(text, { delay: 8 });
  await page.waitForTimeout(60);
}

// ---------------------------------------------------------------- instant mode
{
  const { ctx, page } = await newPage();

  await typeInto(page, "#plain", "hi /ty");
  const v1 = await page.inputValue("#plain");
  check("instant expansion in <input>", v1 === "hi Thank you so much!", JSON.stringify(v1));
  const caret1 = await page.evaluate(() => {
    const el = document.getElementById("plain");
    return el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
  });
  check("caret lands at end of expansion", caret1);

  await typeInto(page, "#ta", "/addr");
  const v2 = await page.inputValue("#ta");
  const expected2 = await page.evaluate(() => "123 Main St\nSpringfield " + new Date().toLocaleDateString());
  check("multi-line + {date} in <textarea>", v2 === expected2, JSON.stringify({ v2, expected2 }));

  await typeInto(page, "#ce", "yo /sig");
  const v3 = await page.evaluate(() => document.getElementById("ce").innerText.replace(/\n$/, ""));
  check("contenteditable expansion (execCommand path)", v3 === "yo Best regards,\nJon", JSON.stringify(v3));

  await typeInto(page, "#ta2", "/mid");
  const mid = await page.evaluate(() => {
    const el = document.getElementById("ta2");
    return { value: el.value, caret: el.selectionStart };
  });
  check("{cursor} placement", mid.value === "Hello world" && mid.caret === 6, JSON.stringify(mid));

  await typeInto(page, "#plain2", "http://ty");
  const v4 = await page.inputValue("#plain2");
  check("no expansion mid-word (http://ty)", v4 === "http://ty", JSON.stringify(v4));

  await typeInto(page, "#react", "/ty");
  const reactVal = await page.evaluate(() => window.__reactValue);
  check("React-controlled input sees expansion", reactVal === "Thank you so much!", JSON.stringify(reactVal));

  await typeInto(page, "#pw", "/ty");
  const pw = await page.inputValue("#pw");
  check("password fields untouched", pw === "/ty", JSON.stringify(pw));

  await ctx.close();
}

// ------------------------------------------- prefix-conflict deferral (instant)
{
  const { ctx, page } = await newPage();

  await typeInto(page, "#plain", "/a");
  const before = await page.inputValue("#plain");
  check("shorter shortcut defers while a longer one matches", before === "/a", JSON.stringify(before));

  await page.keyboard.type("b", { delay: 8 });
  await page.waitForTimeout(60);
  const after = await page.inputValue("#plain");
  check("longer shortcut expands instantly", after === "BETA", JSON.stringify(after));

  await typeInto(page, "#plain2", "/a ");
  const resolved = await page.inputValue("#plain2");
  check("deferred shortcut resolves on space", resolved === "ALPHA ", JSON.stringify(resolved));

  await ctx.close();
}

// ---------------------------------------------------------------- delimiter mode
{
  const { ctx, page } = await newPage({ expandMode: "delimiter" });

  await typeInto(page, "#plain", "/ty");
  const notYet = await page.inputValue("#plain");
  check("delimiter mode waits", notYet === "/ty", JSON.stringify(notYet));

  await page.keyboard.type(" ", { delay: 8 });
  await page.waitForTimeout(60);
  const done = await page.inputValue("#plain");
  check("delimiter mode expands on space (space kept)", done === "Thank you so much! ", JSON.stringify(done));

  await ctx.close();
}

// ---------------------------------------------------------------- disabled state
{
  const { ctx, page } = await newPage({ enabled: false });
  await typeInto(page, "#plain", "/ty");
  const v = await page.inputValue("#plain");
  check("disabled toggle stops expansion", v === "/ty", JSON.stringify(v));
  await ctx.close();
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
