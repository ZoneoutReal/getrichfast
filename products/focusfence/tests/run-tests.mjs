// FocusFence logic tests: the pure rules/schedule engine, loaded into a real
// Chromium page. Usage: npm run test:logic
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const RULES = fs.readFileSync(path.join(here, "..", "extension", "src", "lib", "rules.js"), "utf8");

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
await page.addScriptTag({ content: RULES });
const R = (fn, ...args) => page.evaluate(({ fn, args }) => {
  const parts = fn.split(".");
  let f = globalThis.FocusFenceRules;
  for (const p of parts) f = f[p];
  return f(...args.map((a) => (a && a.__date ? new Date(a.__date) : a)));
}, { fn, args });

// ---- parsePattern ---------------------------------------------------------
check("plain domain", JSON.stringify(await R("parsePattern", "facebook.com")).includes('"domain":"facebook.com"'));
check("strips scheme + www", (await R("parsePattern", "https://www.Reddit.com/")).domain === "reddit.com");
check("wildcard subdomain accepted", (await R("parsePattern", "*.tiktok.com")).domain === "tiktok.com");
check("path pattern parsed", (await R("parsePattern", "reddit.com/r/all")).path === "/r/all");
check("port stripped", (await R("parsePattern", "localhost.dev:3000")).domain === "localhost.dev");
check("query/hash stripped from path", (await R("parsePattern", "youtube.com/shorts?feed=1#x")).path === "/shorts");
check("garbage rejected", (await R("parsePattern", "not a site!!")) === null);
check("empty rejected", (await R("parsePattern", "   ")) === null);
check("single word rejected (no TLD)", (await R("parsePattern", "facebook")) === null);

// ---- isProPattern ---------------------------------------------------------
check("domain is free-tier pattern", (await R("isProPattern", "facebook.com")) === false);
check("path is Pro pattern", (await R("isProPattern", "reddit.com/r/all")) === true);

// ---- toRule / buildRules --------------------------------------------------
const rule = await R("toRule", "facebook.com", 1, "chrome-extension://abc/src/blocked/blocked.html");
check("rule uses ||domain^ anchor", rule.condition.urlFilter === "||facebook.com^", JSON.stringify(rule.condition));
check("rule redirects to blocked page with source", rule.action.type === "redirect" && rule.action.redirect.url.includes("blocked.html?from=facebook.com"), JSON.stringify(rule.action));
check("rule limited to main_frame", JSON.stringify(rule.condition.resourceTypes) === '["main_frame"]');
const pathRule = await R("toRule", "reddit.com/r/all", 2, null);
check("path rule narrows filter", pathRule.condition.urlFilter === "||reddit.com/r/all", pathRule.condition.urlFilter);
check("block action when no redirect url", pathRule.action.type === "block");
const rules = await R("buildRules", ["a.com", "bad input", "b.org"], null);
check("buildRules skips invalid, ids sequential", rules.length === 2 && rules[0].id === 1 && rules[1].id === 2, JSON.stringify(rules.map((r) => r.id)));

// ---- schedules ------------------------------------------------------------
const mon10 = { __date: "2026-07-13T10:00:00" }; // monday
const mon8 = { __date: "2026-07-13T08:00:00" };
const sat10 = { __date: "2026-07-18T10:00:00" }; // saturday
const workdays = { days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" };
check("schedule active inside window", (await R("scheduleActiveAt", workdays, mon10)) === true);
check("schedule inactive before start", (await R("scheduleActiveAt", workdays, mon8)) === false);
check("schedule inactive on weekend", (await R("scheduleActiveAt", workdays, sat10)) === false);
check("boundary: end minute is off", (await R("scheduleActiveAt", workdays, { __date: "2026-07-13T17:00:00" })) === false);
check("boundary: start minute is on", (await R("scheduleActiveAt", workdays, { __date: "2026-07-13T09:00:00" })) === true);

const night = { days: [1], start: "22:00", end: "06:00" }; // monday nights
check("overnight: before midnight active", (await R("scheduleActiveAt", night, { __date: "2026-07-13T23:30:00" })) === true);
check("overnight: after midnight (tuesday) still active", (await R("scheduleActiveAt", night, { __date: "2026-07-14T05:00:00" })) === true);
check("overnight: tuesday evening inactive", (await R("scheduleActiveAt", night, { __date: "2026-07-14T23:00:00" })) === false);
check("invalid times rejected", (await R("scheduleActiveAt", { days: [1], start: "9am", end: "17:00" }, mon10)) === false);

// ---- blockingActive -------------------------------------------------------
const now = Date.now();
check("session running → active", (await R("blockingActive", { session: { endsAt: now + 60000 }, alwaysOn: false, schedules: [], pro: false })) === true);
check("expired session alone → inactive", (await R("blockingActive", { session: { endsAt: now - 1000 }, alwaysOn: false, schedules: [], pro: false })) === false);
check("alwaysOn → active", (await R("blockingActive", { session: null, alwaysOn: true, schedules: [], pro: false })) === true);
check("schedule ignored without pro", (await R("blockingActive", { session: null, alwaysOn: false, schedules: [{ days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "23:59" }], pro: false })) === false);
check("schedule honored with pro", (await R("blockingActive", { session: null, alwaysOn: false, schedules: [{ days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "23:59" }], pro: true })) === true);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
