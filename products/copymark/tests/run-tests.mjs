// CopyMark serializer tests: load the real serializer into the harness page
// in a real Chromium and verify markdown output fragment by fragment.
// Usage: npm run test:serializer
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
await page.waitForFunction(() => globalThis.CopyMarkSerializer);

const md = await page.evaluate(() => CopyMarkSerializer.serialize(document.getElementById("article"), {}));
const mdPro = await page.evaluate(() => CopyMarkSerializer.serialize(document.getElementById("article"), { pro: true, gfmTables: true }));

// headings
check("h1 → #", md.includes("# A Guide to Widgets"), md.slice(0, 60));
check("h2 → ##", md.includes("## Installation"));

// inline styles
check("bold → **", md.includes("**important**"));
check("italic → *", md.includes("*occasionally*"));
check("bold+italic nesting", md.includes("***both***") || md.includes("**\\*both\\***") || /\*\*\*both\*\*\*/.test(md), md.match(/.{0,20}both.{0,20}/)?.[0]);
check("inline code → backticks", md.includes("`widget.spin()`"));
check("strikethrough → ~~", md.includes("~~old text~~"));

// links
check("relative link resolved to absolute", /\[intro docs\]\(file:\/\/.*\/docs\/intro\)/.test(md), md.match(/\[intro docs\][^\n]*/)?.[0]);
check("absolute link kept", md.includes("[full manual](https://example.com/full)"));
check("javascript: link → text only", md.includes("this link") && !md.includes("javascript:"), md.match(/.{0,30}this link.{0,30}/)?.[0]);

// code block
check("fenced code with language", md.includes("```bash\nnpm install widgets\nwidgets init --fast\n```"), md.match(/```[\s\S]{0,80}/)?.[0]);

// lists
check("unordered list with dash", md.includes("- First item"));
check("nested list indented", /- Second with `code`\n {2}- Nested one\n {2}- Nested two/.test(md), md.match(/- Second[\s\S]{0,80}/)?.[0]);
check("ordered list respects start=3", md.includes("3. Step three") && md.includes("4. Step four"));
check("task list checked/unchecked", md.includes("- [x] Done thing") && md.includes("- [ ] Pending thing"), md.match(/- \[.\][^\n]*/g)?.join(" | "));

// blockquote
check("blockquote lines prefixed", md.includes("> Widgets change everything.") && md.includes("> — *Widget Weekly*"), md.match(/>[^\n]*/g)?.join(" | "));

// tables
check("free tier: table as plain rows (no pipes table)", !md.includes("| Name |") && md.includes("Name — Speed — Price"), md.match(/Name[^\n]*/)?.[0]);
check("Pro: GFM table header + separator", mdPro.includes("| Name | Speed | Price |") && mdPro.includes("| --- | --- | --- |"), mdPro.match(/\| Name[^\n]*/)?.[0]);
check("Pro: pipe inside cell escaped", mdPro.includes("Fast \\| furious"), mdPro.match(/.{0,30}furious.{0,10}/)?.[0]);

// misc blocks
check("hr → ---", md.includes("\n---\n"));
check("special chars escaped", md.includes("5 \\* 3 = 15") && md.includes("a\\_b\\_c") && md.includes("\\[not a link\\]"), md.match(/Special chars[^\n]*/)?.[0]);
check("br → two-space line break", /Line one {2}\nline two after break\./.test(md), JSON.stringify(md.match(/Line one[\s\S]{0,40}/)?.[0]));
check("hidden element dropped", !md.includes("HIDDEN TEXT"));
check("script content dropped", !md.includes("document.write"));
check("image → markdown image with abs url", /!\[A widget\]\(file:\/\/.*\/img\/widget\.png\)/.test(md), md.match(/!\[[^\n]*/)?.[0]);
check("deep nesting flattens to paragraph", md.includes("Deeply nested paragraph."));
check("no triple blank lines", !/\n{3,}/.test(md));
check("output ends with single newline", /[^\n]\n$/.test(md));

// image modes
const mdAlt = await page.evaluate(() => CopyMarkSerializer.serialize(document.getElementById("article"), { imageMode: "alt" }));
const mdSkip = await page.evaluate(() => CopyMarkSerializer.serialize(document.getElementById("article"), { imageMode: "skip" }));
check("imageMode=alt → italic alt text", mdAlt.includes("*A widget*") && !mdAlt.includes("!["), mdAlt.match(/.{0,30}widget\b.{0,20}/)?.[0]);
check("imageMode=skip drops images", !mdSkip.includes("![") && !mdSkip.includes("*A widget*"));

// bullet option
const mdStar = await page.evaluate(() => CopyMarkSerializer.serialize(document.getElementById("article"), { bullet: "*" }));
check("bullet option * respected", mdStar.includes("* First item"), mdStar.match(/[*-] First[^\n]*/)?.[0]);

// fence option
const mdTilde = await page.evaluate(() => CopyMarkSerializer.serialize(document.getElementById("article"), { fence: "~~~" }));
check("fence option ~~~ respected", mdTilde.includes("~~~bash"), mdTilde.match(/~~~[^\n]*/)?.[0]);

// selection → markdown (drag across two paragraphs)
const selMd = await page.evaluate(() => {
  const doc = document;
  const range = doc.createRange();
  const h2 = doc.querySelector("h2");
  const pre = doc.querySelector("pre");
  range.setStartBefore(h2);
  range.setEndAfter(pre);
  const sel = doc.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  return CopyMarkSerializer.selectionToMarkdown(doc, {});
});
check("selection: heading + code block captured", selMd.includes("## Installation") && selMd.includes("```bash"), selMd.slice(0, 80));

const noSel = await page.evaluate(() => {
  document.getSelection().removeAllRanges();
  return CopyMarkSerializer.selectionToMarkdown(document, {});
});
check("empty selection → empty string", noSel === "");

// page link helper
const link = await page.evaluate(() => CopyMarkSerializer.pageLink(document));
check("pageLink is [title](url)", /^\[CopyMark test harness — A Guide to Widgets\]\(file:\/\/.+\)$/.test(link), link);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
