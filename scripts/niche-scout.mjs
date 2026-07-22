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
import { parseArgs } from "./lib/cli.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const opts = parseArgs(process.argv.slice(2), ["--out"]);

if (opts.help) {
  console.log("Usage: node scripts/niche-scout.mjs [candidates.json] [--json] [--out DIR]");
  console.log("  candidates.json  array of candidate niches (schema: scripts/data/candidates.example.json)");
  console.log("  --json           print the scored evaluations as JSON, write no files");
  console.log("  --out DIR        where to write build-*.md issue bodies (default: scout-out/)");
  process.exit(0);
}
if (opts.unknown.length) {
  console.error(`✗ unknown option(s): ${opts.unknown.join(", ")} (try --help)`);
  process.exit(2);
}

const outDir = opts.out || path.join(root, "scout-out");
const inputPath = opts._[0] || path.join(root, "scripts", "data", "candidates.example.json");

let candidates;
try {
  candidates = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  if (!Array.isArray(candidates)) throw new Error("expected a JSON array of candidates");
  if (candidates.length === 0) throw new Error("candidate list is empty");
} catch (e) {
  console.error(`✗ could not read candidates from ${inputPath}: ${e.message}`);
  process.exit(2);
}

const evals = rankCandidates(candidates);

if (opts.json) {
  console.log(JSON.stringify(evals, null, 2));
  process.exit(0);
}

console.log(`(scored ${path.relative(root, inputPath)})\n`);
console.log(renderReport(evals));

// Write one issue file per qualified candidate (top-ranked first).
const qualified = evals.filter((e) => e.qualified);
if (qualified.length) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const e of qualified) {
    fs.writeFileSync(path.join(outDir, `build-${e.slug}.md`), renderIssue(e) + "\n");
  }
  console.log(`\n↳ ${qualified.length} build issue(s) written to ${path.relative(root, outDir)}/`);
  console.log(`  Top pick: ${path.relative(root, path.join(outDir, `build-${qualified[0].slug}.md`))}`);
} else {
  console.log("\n↳ No qualified candidate — nothing to file.");
}
