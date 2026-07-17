// PagePulse timing-engine tests: pure logic loaded into a real Chromium page.
// Usage: npm run test:logic
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const TIMING = fs.readFileSync(path.join(here, "..", "extension", "src", "lib", "timing.js"), "utf8");

const PREINSTALLED = "/opt/pw-browsers/chromium";
const launchOpts = fs.existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {};

const results = [];
function check(name, cond, extra = "") {
  results.push({ ok: !!cond, name });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  → " + extra}`);
}

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage();
await page.setContent("<!DOCTYPE html><html><body></body></html>");
await page.addScriptTag({ content: TIMING });
const R = (expr) => page.evaluate(expr);

// nextFireAt
check("nextFireAt: plain interval", (await R(`PagePulseTiming.nextFireAt({intervalSec: 30, jitterPct: 0}, 1000)`)) === 31000);
const jittered = await R(`Array.from({length: 40}, () => PagePulseTiming.nextFireAt({intervalSec: 100, jitterPct: 20}, 0))`);
check("jitter stays within ±20%", jittered.every((t) => t >= 80000 && t <= 120000), JSON.stringify([Math.min(...jittered), Math.max(...jittered)]));
check("jitter actually varies", new Set(jittered).size > 5, String(new Set(jittered).size));
check("nextFireAt floors at 1s", (await R(`PagePulseTiming.nextFireAt({intervalSec: 0.2, jitterPct: 0}, 0)`)) >= 1000);

// dueJobs
const due = await R(`PagePulseTiming.dueJobs({a: {tabId: 1, nextAt: 500}, b: {tabId: 2, nextAt: 5000}}, 1000).map(j => j.tabId)`);
check("dueJobs picks overdue only", JSON.stringify(due) === "[1]", JSON.stringify(due));

// badgeText
check("badge seconds", (await R(`PagePulseTiming.badgeText(9500)`)) === "10s");
check("badge sub-100s stays in seconds", (await R(`PagePulseTiming.badgeText(95000)`)) === "95s");
check("badge minutes", (await R(`PagePulseTiming.badgeText(180000)`)) === "3m");
check("badge hours", (await R(`PagePulseTiming.badgeText(2 * 3600 * 1000)`)) === "2h");
check("badge clamps negatives to 0s", (await R(`PagePulseTiming.badgeText(-500)`)) === "0s");

// fmtInterval
check("fmt 45 → 45s", (await R(`PagePulseTiming.fmtInterval(45)`)) === "45s");
check("fmt 300 → 5m", (await R(`PagePulseTiming.fmtInterval(300)`)) === "5m");
check("fmt 90 → 1m30s", (await R(`PagePulseTiming.fmtInterval(90)`)) === "1m30s");
check("fmt 7200 → 2h", (await R(`PagePulseTiming.fmtInterval(7200)`)) === "2h");

// parseInterval
check("parse '45s'", (await R(`PagePulseTiming.parseInterval("45s", 2)`)) === 45);
check("parse '2m'", (await R(`PagePulseTiming.parseInterval("2m", 2)`)) === 120);
check("parse '1.5h'", (await R(`PagePulseTiming.parseInterval("1.5h", 2)`)) === 5400);
check("parse bare number = seconds", (await R(`PagePulseTiming.parseInterval("30", 2)`)) === 30);
check("parse rejects below min", (await R(`PagePulseTiming.parseInterval("1s", 2)`)) === null);
check("parse rejects garbage", (await R(`PagePulseTiming.parseInterval("soon", 2)`)) === null);
check("parse rejects > 24h", (await R(`PagePulseTiming.parseInterval("25h", 2)`)) === null);

// monitorDiff
const d1 = await R(`PagePulseTiming.monitorDiff(null, "Out of stock", "in stock")`);
check("first snapshot: no change flags", d1.changed === false && d1.keywordAppeared === false && d1.hasKeyword === false, JSON.stringify(d1));
const d2 = await R(`PagePulseTiming.monitorDiff({hash: ${d1.hash}, hasKeyword: false}, "Now in stock! Buy fast", "in stock")`);
check("keyword appears → keywordAppeared", d2.keywordAppeared === true && d2.changed === true, JSON.stringify(d2));
const d3 = await R(`PagePulseTiming.monitorDiff({hash: 1, hasKeyword: true}, "Sold out again", "in stock")`);
check("keyword vanishes → keywordGone", d3.keywordGone === true, JSON.stringify(d3));
const d4 = await R(`PagePulseTiming.monitorDiff({hash: ${d1.hash}, hasKeyword: false}, "Out  of \\n stock", "in stock")`);
check("whitespace-only difference is not a change", d4.changed === false, JSON.stringify(d4));
const d5 = await R(`PagePulseTiming.monitorDiff({hash: ${d1.hash}, hasKeyword: null}, "Totally new content", "")`);
check("no keyword: any content change flags", d5.changed === true, JSON.stringify(d5));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
