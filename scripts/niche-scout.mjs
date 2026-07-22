#!/usr/bin/env node
// Niche scout CLI — scores candidate niches against the PLAYBOOK checklist and
// drafts a "build this week" GitHub issue for the top qualifier.
//
// Usage:
//   node scripts/niche-scout.mjs [candidates.json] [--json] [--out DIR]
//
// Input defaults to scripts/data/candidates.example.json. Issue bodies for
// qualified candidates are written to scout-out/ (gitignored) so the weekly
// agent can file them via the GitHub MCP; the founder can also paste them by
// hand. Exit code is non-zero only on bad input, so it is cron-safe.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rankCandidates, renderReport, renderIssue } from "./lib/scout.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const jsonOut = args.includes("--json");
const outIdx = args.indexOf("--out");
const outDir = outIdx >= 0 ? args[outIdx + 1] : path.join(root, "scout-out");
const inputArg = args.find((a) => !a.startsWith("--") && a !== args[outIdx + 1]);
const inputPath = inputArg || path.join(root, "scripts", "data", "candidates.example.json");

let candidates;
try {
  candidates = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  if (!Array.isArray(candidates)) throw new Error("expected a JSON array of candidates");
} catch (e) {
  console.error(`✗ could not read candidates from ${inputPath}: ${e.message}`);
  process.exit(2);
}

const evals = rankCandidates(candidates);

if (jsonOut) {
  console.log(JSON.stringify(evals, null, 2));
  process.exit(0);
}

console.log(renderReport(evals));

// Write one issue file per qualified candidate (top-ranked first).
const qualified = evals.filter((e) => e.qualified);
if (qualified.length) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const e of qualified) {
    const file = path.join(outDir, `build-${e.slug}.md`);
    fs.writeFileSync(file, renderIssue(e) + "\n");
  }
  console.log(`\n↳ ${qualified.length} build issue(s) written to ${path.relative(root, outDir)}/`);
  console.log(`  Top pick: ${path.relative(root, path.join(outDir, `build-${qualified[0].slug}.md`))}`);
} else {
  console.log("\n↳ No qualified candidate — nothing to file.");
}
