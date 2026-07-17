// Generates Chrome Web Store screenshots (1280x800) from the REAL CopyMark
// serializer + UI. Usage: npm run shots
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const outDir = path.join(root, "store", "screenshots");
fs.mkdirSync(outDir, { recursive: true });

const SERIALIZER = fs.readFileSync(path.join(root, "extension", "src", "md", "serializer.js"), "utf8");
const PREINSTALLED = "/opt/pw-browsers/chromium";
const launchOpts = fs.existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {};

const browser = await chromium.launch(launchOpts);

// ---- raw A: article → markdown, side by side, real serializer output ------
const ARTICLE = `
  <h1>Shipping Faster with Widgets</h1>
  <p>Widgets are <strong>the fastest way</strong> to ship <em>reliable</em> UI. Start with <code>widget.spin()</code> and read the <a href="https://widgets.example.com/docs">docs</a>.</p>
  <h2>Install</h2>
  <pre><code class="language-bash">npm install widgets</code></pre>
  <ul>
    <li>Zero config</li>
    <li>Works everywhere
      <ul><li>Browser</li><li>Node</li></ul>
    </li>
  </ul>
  <blockquote><p>Widgets cut our build time in half.</p></blockquote>
  <table>
    <tr><th>Plan</th><th>Price</th></tr>
    <tr><td>Starter</td><td>$0</td></tr>
    <tr><td>Team</td><td>$49</td></tr>
  </table>`;

async function rawConvertShot(file) {
  const ctx = await browser.newContext({ viewport: { width: 980, height: 640 }, colorScheme: "light", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.setContent(`<!DOCTYPE html><html><head><style>
    * { box-sizing: border-box; margin: 0; }
    body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; display: flex; width: 980px; height: 640px; background: #fff; }
    .web { width: 470px; padding: 26px 30px; border-right: 1px solid #e5e7eb; overflow: hidden; }
    .web h1 { font-size: 24px; margin-bottom: 10px; letter-spacing: -0.01em; }
    .web h2 { font-size: 18px; margin: 16px 0 8px; }
    .web p, .web li { font-size: 13.5px; color: #374151; line-height: 1.6; }
    .web ul { padding-left: 20px; margin: 8px 0; }
    .web pre { background: #f3f4f6; border-radius: 8px; padding: 10px 12px; font-size: 12.5px; margin: 8px 0; }
    .web code { font-family: ui-monospace, Menlo, monospace; background: #f3f4f6; border-radius: 4px; padding: 0 4px; font-size: 12.5px; }
    .web pre code { background: none; padding: 0; }
    .web blockquote { border-left: 3px solid #93c5fd; padding: 2px 12px; color: #4b5563; margin: 10px 0; font-style: italic; }
    .web table { border-collapse: collapse; margin: 10px 0; font-size: 13px; }
    .web th, .web td { border: 1px solid #e5e7eb; padding: 5px 12px; text-align: left; }
    .web a { color: #2563eb; }
    .mdpane { flex: 1; background: #0f1222; color: #d6deeb; padding: 22px 24px; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12.3px; line-height: 1.62; white-space: pre-wrap; overflow: hidden; position: relative; }
    .mdpane .bar { display: flex; gap: 6px; margin-bottom: 14px; }
    .mdpane .dot { width: 10px; height: 10px; border-radius: 50%; background: #2b3050; }
    .mdpane .label { position: absolute; top: 18px; right: 20px; font-size: 11px; color: #8b93b5; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; font-weight: 600; letter-spacing: .03em; }
    .h { color: #82aaff; } .b { color: #c792ea; } .lnk { color: #7fdbca; }
  </style></head><body>
    <div class="web" id="src">${ARTICLE}</div>
    <div class="mdpane"><div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><span class="label">CLIPBOARD · MARKDOWN</span><div id="md"></div></div>
  </body></html>`);
  await page.addScriptTag({ content: SERIALIZER });
  await page.evaluate(() => {
    const md = CopyMarkSerializer.serialize(document.getElementById("src"), { pro: true, gfmTables: true });
    // light syntax tint for the shot
    const esc = md.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    document.getElementById("md").innerHTML = esc
      .replace(/^(#{1,6} .*)$/gm, '<span class="h">$1</span>')
      .replace(/\*\*([^*]+)\*\*/g, '<span class="b">**$1**</span>')
      .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '<span class="lnk">[$1]($2)</span>');
  });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(outDir, file) });
  await ctx.close();
  console.log(file);
}
await rawConvertShot("_convert.png");

// ---- raw B: real popup with a success state -------------------------------
const chromeStub = () => {
  const seeded = { settings: { bullet: "-", imageMode: "markdown", fence: "```", frontMatter: "", pro: false } };
  const get = (_d, cb) => (cb ? setTimeout(() => cb(seeded), 0) : Promise.resolve(seeded));
  const set = (_o, cb) => (cb ? cb() : Promise.resolve());
  window.chrome = {
    storage: { local: { get, set }, onChanged: { addListener() {} } },
    runtime: {
      id: "stub",
      getURL: (p) => p,
      openOptionsPage() {},
      onMessage: { addListener() {} },
      sendMessage: (msg) =>
        Promise.resolve(msg.type === "capture" ? { ok: true, md: "# Shipping Faster with Widgets…", chars: 1204 } : { ok: true, md: "- [Widget Docs](https://a)\n- [Blog](https://b)", chars: 64 })
    },
    tabs: { query: () => Promise.resolve([{ id: 1, url: "https://widgets.example.com/blog/shipping-faster" }]) }
  };
  // popup writes via navigator.clipboard — stub it for file://
  Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.resolve() } });
};

async function rawPopupShot(file) {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 330 }, colorScheme: "light", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(chromeStub);
  await page.goto("file://" + path.join(root, "extension", "src", "popup", "popup.html"));
  await page.waitForFunction(() => window.__copymarkReady);
  await page.click("#selBtn");
  await page.waitForSelector("#result:not([hidden])");
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(outDir, file) });
  await ctx.close();
  console.log(file);
}
await rawPopupShot("_popup.png");

// ---- raw C: real options page, Pro on, Obsidian template ------------------
async function rawOptionsShot(file) {
  const ctx = await browser.newContext({ viewport: { width: 860, height: 660 }, colorScheme: "light", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(chromeStub);
  await page.goto("file://" + path.join(root, "extension", "src", "options", "options.html"));
  await page.waitForFunction(() => window.__copymarkReady);
  await page.evaluate(() => {
    window.__copymark.setPro(true);
    document.getElementById("frontMatter").value = `---\ntitle: "{{title}}"\nsource: {{url}}\nclipped: {{date}}\ntags: [clipping]\n---`;
  });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(outDir, file) });
  await ctx.close();
  console.log(file);
}
await rawOptionsShot("_options.png");

// ---- compositions ---------------------------------------------------------
const baseCSS = `
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1280px; height: 800px; overflow: hidden; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background:
      radial-gradient(1000px 600px at 110% -10%, #dbeafe 0%, transparent 60%),
      radial-gradient(900px 500px at -10% 110%, #e0e7ff 0%, transparent 55%),
      #f6f7fb;
    color: #16182d; display: flex; align-items: center; padding: 56px;
  }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 26px; }
  .mark { width: 34px; height: 34px; border-radius: 10px; position: relative; background: linear-gradient(135deg, #3b82f6, #6366f1);
          display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:19px; }
  .mark::after { content:"↓"; position:absolute; right:2px; bottom:-2px; font-size:13px; color:#a5f3fc; font-weight:800; }
  .brand b { font-size: 20px; letter-spacing: -0.01em; }
  h1 { font-size: 45px; line-height: 1.12; letter-spacing: -0.022em; font-weight: 760; margin-bottom: 16px; }
  .sub { font-size: 18.5px; line-height: 1.5; color: #5b6070; max-width: 430px; margin-bottom: 24px; }
  .ticks { display: grid; gap: 11px; font-size: 16px; font-weight: 550; }
  .ticks span::before { content: "✓  "; color: #10b981; font-weight: 800; }
  .left { width: 460px; flex: none; }
  .right { flex: 1; display: flex; justify-content: center; align-items: center; }
  .shot { border-radius: 16px; box-shadow: 0 2px 6px rgba(22,24,45,.08), 0 30px 70px rgba(59,70,180,.28); border: 1px solid #e3e6ef; overflow: hidden; background: #fff; }
`;
const brand = `<div class="brand"><div class="mark">M</div><b>CopyMark</b></div>`;
const frame = (inner, extra = "") =>
  `<!DOCTYPE html><html><head><style>${baseCSS}${extra}</style></head><body>${inner}</body></html>`;

const rawConvert = "file://" + path.join(outDir, "_convert.png");
const rawPopup = "file://" + path.join(outDir, "_popup.png");
const rawOptions = "file://" + path.join(outDir, "_options.png");

const SHOTS = [
  {
    file: "1-hero.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>The web,<br />as clean Markdown.</h1>
        <div class="sub">Select anything — headings, lists, links, code, tables — and copy it as tidy Markdown for Obsidian, Notion, GitHub, or your notes.</div>
        <div class="ticks">
          <span>Alt+Shift+M or right-click → copy</span>
          <span>Real code fences with language tags</span>
          <span>100% local — pages never leave your browser</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="${rawConvert}" width="712" /></div>
    `)
  },
  {
    file: "2-obsidian.png",
    html: frame(`
      <div class="left">
        ${brand}
        <h1>Built for your second brain.</h1>
        <div class="sub">Pro adds GFM tables, full-page clipping with front-matter templates ({{title}}, {{url}}, {{date}}), and a one-click Obsidian preset.</div>
        <div class="ticks">
          <span>Front-matter templates (Pro)</span>
          <span>Tables → GFM pipes (Pro)</span>
          <span>Copy all tabs as a Markdown link list (Pro)</span>
        </div>
      </div>
      <div class="right"><img class="shot" src="${rawOptions}" width="640" /></div>
    `)
  },
  {
    file: "3-popup.png",
    html: `<!DOCTYPE html><html><head><style>
      * { margin: 0; } html, body { width: 1280px; height: 800px; overflow: hidden; position: relative; }
      .bg { width: 1280px; height: 800px; object-fit: cover; object-position: left top; display: block; filter: blur(0px); }
      .pop { position: absolute; right: 64px; top: 56px; width: 330px; border-radius: 14px;
             box-shadow: 0 12px 48px rgba(10,20,30,.45); border: 1px solid #e3e6ef; }
    </style></head><body><img class="bg" src="${rawConvert}" /><img class="pop" src="${rawPopup}" /></body></html>`
  },
  {
    file: "4-pricing.png",
    html: frame(`
      <div style="width:100%; display:flex; flex-direction:column; align-items:center; gap:36px;">
        <div style="text-align:center">
          ${brand.replace('class="brand"', 'class="brand" style="justify-content:center"')}
          <h1 style="margin-bottom:10px">Pay once. Clip forever.</h1>
          <div class="sub" style="max-width:560px; margin:0 auto;">No subscription, no account, no server. Your notes pipeline shouldn't have a monthly bill.</div>
        </div>
        <div style="display:flex; gap:26px;">
          <div class="plan shot">
            <div class="name">Free</div>
            <div class="price">$0</div>
            <div class="feat">✓ Copy any selection as Markdown<br />✓ Copy page as Markdown link<br />✓ Headings, lists, code, quotes, images<br />✓ Keyboard shortcut &amp; context menu</div>
          </div>
          <div class="plan shot pro">
            <div class="name">Pro</div>
            <div class="price">$9 <small>one-time</small></div>
            <div class="feat">✓ Everything in Free<br />✓ Tables → GFM pipes<br />✓ Full-page clip + front-matter templates<br />✓ All tabs → Markdown link list</div>
          </div>
        </div>
      </div>
    `, `
      body { padding: 48px; }
      .plan { width: 330px; padding: 28px; }
      .plan .name { font-weight: 700; font-size: 17px; color:#5b6070; margin-bottom: 6px; }
      .plan .price { font-size: 42px; font-weight: 780; letter-spacing:-0.02em; margin-bottom: 16px; }
      .plan .price small { font-size: 16px; color:#5b6070; font-weight: 600; }
      .plan .feat { line-height: 2.05; font-size: 15px; font-weight: 520; }
      .plan.pro { outline: 3px solid #6366f1; outline-offset: -3px; }
    `)
  }
];

const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, colorScheme: "light" });
const page2 = await ctx2.newPage();
for (const shot of SHOTS) {
  const tmp = path.join(outDir, "_frame.html");
  fs.writeFileSync(tmp, shot.html);
  await page2.goto("file://" + tmp);
  await page2.waitForTimeout(200);
  await page2.screenshot({ path: path.join(outDir, shot.file) });
  fs.unlinkSync(tmp);
  console.log(shot.file);
}
await ctx2.close();
await browser.close();
console.log("done → " + outDir);
