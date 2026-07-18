// Recall deep smoke test: loads the REAL extension into a real Chromium,
// visits several live local pages so the content script extracts + indexes
// their body text, then drives the actual popup/options search UIs and
// asserts content-search behaviour — plus the core privacy promise: NOTHING
// is ever requested from a non-local host. Usage: npm run test:ui
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const EXT_PATH = path.join(here, "..", "extension");

const PREINSTALLED = "/opt/pw-browsers/chromium";
const executablePath = fs.existsSync(PREINSTALLED) ? PREINSTALLED : undefined;

const results = [];
function check(name, cond, extra = "") {
  results.push({ ok: !!cond, name });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  → " + extra}`);
}

async function waitFor(fn, { timeout = 9000, step = 150 } = {}) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, step));
  }
  return last;
}

// ---- distinct local pages, each with unique body text ---------------------
// Distinctive BODY words never appear in the page's own <title>, so a hit
// proves we searched page *content*, not the title. Junk lives outside <main>
// to prove nav/footer stripping.
const PAGES = {
  "/field-notes-espresso": {
    title: "Field Notes",
    body:
      "Espresso extraction depends on grind size, brew pressure, and water temperature. A skilled barista dials in the grinder every morning to balance acidity against bitterness in the cup."
  },
  "/weekend-reading": {
    title: "Weekend Reading",
    body:
      "Photosynthesis converts sunlight into chemical energy stored inside chloroplasts. Chlorophyll absorbs red and blue light, and green plants release oxygen into the air as a byproduct."
  },
  "/sourdough-diary": {
    title: "Sourdough Bread Diary",
    body:
      "A sourdough bread starter needs only flour and water kept warm. The dough develops its sour flavor during a long slow fermentation before baking inside a very hot cast iron oven."
  },
  "/mountain-trip": {
    title: "Trip Planning",
    body:
      "We mapped a scenic route along the alpine ridge. Bring warm layers, plenty of water, and a paper map. The summit rewards every step of the steep climb with a wide open panorama."
  }
};
const TITLE_WORD_PAGE = "/summit-guide"; // title contains a word absent from its body
PAGES[TITLE_WORD_PAGE] = {
  title: "Kilimanjaro Expedition",
  body: "The journey takes roughly seven days of steady walking through five distinct climate zones and rainforest."
};

function pageHtml(pathname) {
  const p = PAGES[pathname];
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${p.title}</title></head>
<body>
  <nav>navjunkword sitewide navigation home about contact</nav>
  <header>headerjunkword banner</header>
  <main><h1>${p.title}</h1><p>${p.body}</p></main>
  <footer>footerjunkword copyright legal boilerplate</footer>
</body></html>`;
}

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  res.setHeader("content-type", "text/html; charset=utf-8");
  if (PAGES[url]) return void res.end(pageHtml(url));
  res.statusCode = url === "/favicon.ico" ? 200 : 404;
  res.end("<!DOCTYPE html><title>none</title><p>no page here</p>");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;
const base = `http://127.0.0.1:${PORT}`;

// ---- launch with the real extension ---------------------------------------
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "recall-uitest-"));
const netArgs = [
  "--disable-background-networking",
  "--disable-component-update",
  "--disable-default-apps",
  "--disable-sync",
  "--no-first-run",
  "--no-default-browser-check"
];
const extArgs = [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`, ...netArgs];

async function launch() {
  try {
    const ctx = await chromium.launchPersistentContext(userDataDir, { headless: true, executablePath, args: extArgs });
    const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 8000 }));
    return { ctx, sw };
  } catch {
    const ctx = await chromium.launchPersistentContext(userDataDir + "-2", {
      headless: false,
      executablePath,
      args: [...extArgs, "--headless=new"]
    });
    const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent("serviceworker", { timeout: 8000 }));
    return { ctx, sw };
  }
}

const { ctx, sw } = await launch();

// ---- PRIVACY GUARD: record every request to a non-local host --------------
const external = [];
ctx.on("request", (req) => {
  try {
    const u = new URL(req.url());
    if ((u.protocol === "http:" || u.protocol === "https:") && u.hostname !== "127.0.0.1" && u.hostname !== "localhost") {
      external.push(req.url());
    }
  } catch {
    /* non-http scheme — ignore */
  }
});

const extId = new URL(sw.url()).host;
check("service worker registered (background boots)", !!extId, sw.url());

// extension page used only for storage reads
const store = await ctx.newPage();
await store.goto(`chrome-extension://${extId}/src/popup/popup.html`);
const getIndex = async () => {
  const data = await store.evaluate(() => new Promise((res) => chrome.storage.local.get({ recall_index: null }, res)));
  return data.recall_index && data.recall_index.docs ? data.recall_index : { docs: {} };
};
const setSettings = (s) => store.evaluate((v) => new Promise((res) => chrome.storage.local.set({ recall_settings: v }, res)), s);

// ---- visit each page: the content script should index it -------------------
const pagePaths = Object.keys(PAGES);
for (const p of pagePaths) {
  const tab = await ctx.newPage();
  await tab.goto(base + p, { waitUntil: "load" });
  await tab.waitForTimeout(150); // let document_idle + requestIdleCallback fire
}

const idx = await waitFor(async () => {
  const i = await getIndex();
  return Object.keys(i.docs).length >= pagePaths.length ? i : null;
});
const indexedCount = Object.keys(idx ? idx.docs : {}).length;
check("content script indexed every visited page", indexedCount === pagePaths.length, `indexed ${indexedCount}/${pagePaths.length}`);

const docsByUrl = {};
for (const d of Object.values(idx.docs || {})) docsByUrl[new URL(d.url).pathname] = d;
check("indexed doc keeps title + host", docsByUrl["/weekend-reading"] && docsByUrl["/weekend-reading"].host === "127.0.0.1");

// ---- popup search ----------------------------------------------------------
const popup = await ctx.newPage();
await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);
await popup.waitForFunction(() => window.__recallPopupReady);

check("popup shows the correct pages-indexed count", (await popup.textContent("#countLabel")).includes(`${pagePaths.length} pages indexed`), await popup.textContent("#countLabel"));
check("popup unconfigured build hides upgrade button", await popup.locator("#upgradeBtn").isHidden());

async function popupSearch(q) {
  await popup.fill("#q", q);
  await popup.waitForTimeout(120);
  const titles = await popup.locator("#results li .res-title").allTextContents();
  return titles;
}

// BODY-only word: "photosynthesis" is in the body of /weekend-reading but NOT
// in its title "Weekend Reading" — the whole point of the product.
const bodyHits = await popupSearch("photosynthesis");
check("search by BODY word returns the page", bodyHits.length === 1 && bodyHits[0] === "Weekend Reading", JSON.stringify(bodyHits));
check("that page's TITLE does not contain the query word (proves content search)", !docsByUrl["/weekend-reading"].title.toLowerCase().includes("photosynthesis"));

const chloro = await popupSearch("chloroplasts");
check("another body-only word also resolves to that page", chloro.length === 1 && chloro[0] === "Weekend Reading", JSON.stringify(chloro));

// TITLE word works too: "Kilimanjaro" is only in the title of /summit-guide.
const titleHits = await popupSearch("kilimanjaro");
check("search by TITLE word returns the page", titleHits.length === 1 && titleHits[0] === "Kilimanjaro Expedition", JSON.stringify(titleHits));

// ranking: multi-word query — only /sourdough-diary has BOTH words → top hit.
const ranked = await popupSearch("sourdough bread");
check("multi-term query ranks the right page first", ranked[0] === "Sourdough Bread Diary", JSON.stringify(ranked));

// negative cases
check("made-up word returns nothing", (await popupSearch("zzxqwvblarg")).length === 0);
check("stripped nav/footer text is not indexed", (await popupSearch("navjunkword")).length === 0 && (await popupSearch("footerjunkword")).length === 0);
check("noresults state is shown for an empty result set", await popup.locator("#noresults").isVisible());

// ---- options / full search page -------------------------------------------
const opts = await ctx.newPage();
await opts.goto(`chrome-extension://${extId}/src/options/options.html`);
await opts.waitForFunction(() => window.__recallOptionsReady);

check("options stats show every indexed page", (await opts.textContent("#statDocs")) === String(pagePaths.length), await opts.textContent("#statDocs"));
check("options shows a recent list when the query is empty", (await opts.locator("#results li").count()) === pagePaths.length, String(await opts.locator("#results li").count()));

await opts.fill("#q", "fermentation");
await opts.waitForTimeout(120);
const optHits = await opts.locator("#results li .res-title").allTextContents();
check("options search by body word works", optHits.length === 1 && optHits[0] === "Sourdough Bread Diary", JSON.stringify(optHits));
await opts.fill("#q", "");

// Pro gating: site/date filters and export are Pro-only in this free build.
await opts.selectOption("#siteFilter", { index: 1 }).catch(() => {});
await opts.waitForTimeout(100);
check("filters are Pro-gated (upgrade dialog opens for free users)", await opts.evaluate(() => document.getElementById("upgrade").open));
await opts.evaluate(() => document.getElementById("upgrade").close());

await opts.click("#exportBtn");
await opts.waitForTimeout(100);
check("JSON export is Pro-gated (upgrade dialog opens)", await opts.evaluate(() => document.getElementById("upgrade").open));
await opts.evaluate(() => document.getElementById("upgrade").close());

// ---- pause stops indexing new visits --------------------------------------
await setSettings({ paused: true, ignore: [] });
PAGES["/paused-visit"] = { title: "Paused Visit", body: "This body contains the unique marker pausedmarkerword that must never be indexed while paused." };
const pausedTab = await ctx.newPage();
await pausedTab.goto(base + "/paused-visit", { waitUntil: "load" });
await pausedTab.waitForTimeout(1200);
const afterPause = Object.keys((await getIndex()).docs).length;
check("pause stops the content script from indexing", afterPause === pagePaths.length, `count is ${afterPause}, expected ${pagePaths.length}`);
await setSettings({ paused: false, ignore: [] });

// ---- clear-all wipes the index --------------------------------------------
opts.on("dialog", (d) => d.accept());
await opts.click("#clearBtn");
const cleared = await waitFor(async () => (Object.keys((await getIndex()).docs).length === 0 ? true : null), { timeout: 4000 });
check("clear-all empties the local index", cleared === true);

// ---- THE privacy assertion -------------------------------------------------
check("NO request ever went to a non-local host (100% local)", external.length === 0, external.slice(0, 5).join(" , "));

await ctx.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
