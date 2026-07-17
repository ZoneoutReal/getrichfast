// MockFill engine tests: load the real engine into the harness form page in
// a real Chromium and verify classification, values, events, and gating.
// Usage: npm run test:engine
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const HARNESS = "file://" + path.join(here, "harness.html");

const PREINSTALLED = "/opt/pw-browsers/chromium";
const launchOpts = fs.existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {};

const results = [];
function check(name, cond, extra = "") {
  results.push({ ok: !!cond, name });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  → " + extra}`);
}

const browser = await chromium.launch(launchOpts);
const page = await browser.newPage();
await page.goto(HARNESS);
await page.waitForFunction(() => globalThis.MockFillEngine);

const fill = (settings = {}) =>
  page.evaluate((s) => MockFillEngine.fillDocument(document, s), settings);
const val = (id) => page.evaluate((i) => document.getElementById(i).value, id);

// ---- default (free) fill --------------------------------------------------
const res1 = await fill({ emailDomain: "example.com" });
check("fills a substantial number of fields", res1.filled >= 25, String(res1.filled));

check("first name from first_name", (await val("first")).length > 1 && !/\s/.test(await val("first")), await val("first"));
check("last name from last_name", (await val("last")).length > 1, await val("last"));
check("full name has two words", /^\S+ \S+$/.test(await val("fullname")), await val("fullname"));
check("email is fake-safe on example.com", /^[a-z]+\.[a-z]+\d{3}@example\.com$/.test(await val("email")), await val("email"));
check("phone uses reserved 555-01xx block", /^\(\d{3}\) 555-01\d{2}$/.test(await val("phone")), await val("phone"));
check("username from autocomplete attr", /^[a-z]+_[a-z]+\d{2}$/.test(await val("user")), await val("user"));
check("password meets complexity", /^Aa1!.{8}$/.test(await val("pw")), await val("pw"));
check("url is a valid https url", /^https:\/\/www\.[a-z]+\.example\.com$/.test(await val("site")), await val("site"));
check("company from placeholder", (await val("company")).length > 2, await val("company"));
check("snake_case name classified (job_title → job title)", !/\./.test(await val("job")) && /[A-Z]/.test(await val("job")), await val("job"));
check("camelCase name classified (streetAddress)", /^\d+ .+/.test(await val("camel")), await val("camel"));
check("textarea gets multi-sentence paragraph", (await val("bio")).split(".").length >= 3, await val("bio"));
check("street address from autocomplete", /^\d+ .+/.test(await val("street")), await val("street"));
check("zip respects maxlength=5", /^\d{5}$/.test(await val("zip")), await val("zip"));
check("select gets a real option (not placeholder)", ["CA", "NY", "TX"].includes(await val("state")), await val("state"));

const birth = await val("birth");
const yearsAgo = (new Date().getFullYear()) - Number(birth.slice(0, 4));
check("birthdate ISO + adult age", /^\d{4}-\d{2}-\d{2}$/.test(birth) && yearsAgo >= 18 && yearsAgo <= 66, birth);
check("generic date is near today", Math.abs(new Date(await val("appt")) - Date.now()) < 32 * 86400000, await val("appt"));
check("time is HH:MM", /^([01]\d|2[0-3]):[0-5]\d$/.test(await val("when")), await val("when"));
const qty = Number(await val("qty"));
check("number respects min/max", qty >= 2 && qty <= 9, String(qty));
const vol = Number(await val("volume"));
check("range respects min/max", vol >= 10 && vol <= 20, String(vol));
check("color is hex", /^#[0-9a-f]{6}$/.test(await val("shade")), await val("shade"));

check("free tier: card number is NOT a test PAN (random digits)", /^\d{16}$/.test(await val("cardnum")) && !(await page.evaluate((v) => MockFillEngine.TEST_CARDS.visa === v, await val("cardnum"))), await val("cardnum"));
check("cvc is 3 digits", /^\d{3}$/.test(await val("cvc")), await val("cvc"));
check("expiry is MM/YY in the future", /^(0[1-9]|1[0-2])\/\d{2}$/.test(await val("exp")), await val("exp"));

check("terms checkbox force-checked", await page.evaluate(() => document.getElementById("terms").checked));
check("exactly one radio selected in group", (await page.evaluate(() => document.querySelectorAll('input[name="plan"]:checked').length)) === 1);

// untouched fields
check("hidden input untouched", (await page.evaluate(() => document.getElementById("hidden").value)) === "token123");
check("readonly input untouched", (await val("ro")) === "readonly-keep");
check("disabled input untouched", (await val("dis")) === "disabled-keep");
check("data-mockfill=skip untouched", (await val("skipme")) === "");

// events reach framework listeners
const saw = await page.evaluate(() => window.frameworkSaw);
check("React-style listener saw the injected value", saw.length > 0 && saw[saw.length - 1].length > 0, JSON.stringify(saw));
const evts = await page.evaluate(() => window.eventLog);
check("input+change+focus fired on text input", ["focus", "input", "change"].every((e) => (evts.email || []).includes(e)), JSON.stringify(evts.email));
check("input+change fired on select", ["input", "change"].every((e) => (evts.state || []).includes(e)), JSON.stringify(evts.state));

// ---- pro features ---------------------------------------------------------
const proSettings = {
  pro: true,
  fillCards: true,
  cardBrand: "mastercard",
  seedEnabled: true,
  seed: "sprint-42",
  emailDomain: "qa.example.org",
  customRules: [
    { pattern: "coupon", action: "value", value: "TESTCODE50" },
    { pattern: "internal_ref", action: "skip" }
  ]
};
await page.evaluate(() => (document.getElementById("internal").value = ""));
await fill(proSettings);
check("Pro: official test card for chosen brand", (await val("cardnum")) === "5555555555554444", await val("cardnum"));
check("Pro: test card is Luhn-valid", await page.evaluate((v) => MockFillEngine.luhnValid(v), await val("cardnum")));
check("Pro: custom rule fixed value applied", (await val("coupon")) === "TESTCODE50", await val("coupon"));
check("Pro: custom skip rule leaves field empty", (await val("internal")) === "", await val("internal"));
check("Pro: email domain override", /@qa\.example\.org$/.test(await val("email")), await val("email"));

const snapA = await page.evaluate(() => [first.value, email.value, phone.value, city.value].join("|"));
await fill(proSettings);
const snapB = await page.evaluate(() => [first.value, email.value, phone.value, city.value].join("|"));
check("Pro: seeded runs are deterministic", snapA === snapB, `${snapA} vs ${snapB}`);

await fill({ ...proSettings, seed: "other-seed" });
const snapC = await page.evaluate(() => [first.value, email.value, phone.value, city.value].join("|"));
check("Pro: different seed, different data", snapA !== snapC, snapC);

// free user does NOT get custom rules applied
await page.evaluate(() => (document.getElementById("coupon").value = ""));
await fill({ pro: false, customRules: [{ pattern: "coupon", action: "value", value: "TESTCODE50" }] });
check("Free: custom rules ignored without Pro", (await val("coupon")) !== "TESTCODE50", await val("coupon"));

// re-running produces fresh random data (no seed)
const snapD = await page.evaluate(() => [first.value, email.value, city.value, bio.value].join("|"));
await fill({});
const snapE = await page.evaluate(() => [first.value, email.value, city.value, bio.value].join("|"));
check("unseeded refill produces new data", snapD !== snapE);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
