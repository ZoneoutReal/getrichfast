#!/usr/bin/env node
// Scoreboard autopilot CLI — applies the kill/feed rules to weekly store stats
// and drafts a GitHub issue for every product that needs an action.
//
// Usage:
//   node scripts/scoreboard.mjs [stats.json] [--json] [--out DIR] [--date YYYY-MM-DD]
//
// Input defaults to scripts/data/scoreboard.example.json. --date overrides
// "today" (for reproducible runs / testing). Action issues (FEED / ITERATE /
// ARCHIVE) are written to scout-out/ (gitignored). Cron-safe: exits non-zero
// only on bad input.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateBoard, renderScoreboard, renderActionIssue, actionableRows } from "./lib/scoreboard.mjs";
import { parseArgs } from "./lib/cli.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const opts = parseArgs(process.argv.slice(2), ["--out", "--date"]);

if (opts.help) {
  console.log("Usage: node scripts/scoreboard.mjs [stats.json] [--json] [--out DIR] [--date YYYY-MM-DD]");
  console.log("  stats.json       array of product stats (schema: scripts/data/scoreboard.example.json)");
  console.log("  --json           print the evaluated rows as JSON, write no files");
  console.log("  --out DIR        where to write action-*.md issue bodies (default: scout-out/)");
  console.log("  --date YYYY-MM-DD  pin 'today' for a reproducible run (default: now)");
  process.exit(0);
}
if (opts.unknown.length) {
  console.error(`✗ unknown option(s): ${opts.unknown.join(", ")} (try --help)`);
  process.exit(2);
}

const outDir = opts.out || path.join(root, "scout-out");
const now = opts.date ? new Date(opts.date + "T12:00:00Z") : new Date();
if (Number.isNaN(now.getTime())) {
  console.error("✗ --date must be YYYY-MM-DD");
  process.exit(2);
}
const inputPath = opts._[0] || path.join(root, "scripts", "data", "scoreboard.example.json");

let products;
try {
  products = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  if (!Array.isArray(products)) throw new Error("expected a JSON array of product stats");
} catch (e) {
  console.error(`✗ could not read stats from ${inputPath}: ${e.message}`);
  process.exit(2);
}

const rows = evaluateBoard(products, now);

if (opts.json) {
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

console.log(`(scored ${path.relative(root, inputPath)} as of ${now.toISOString().slice(0, 10)})\n`);
console.log(renderScoreboard(rows));

const acting = actionableRows(rows);
if (acting.length) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const r of acting) {
    fs.writeFileSync(path.join(outDir, `action-${r.action.toLowerCase()}-${r.product}.md`), renderActionIssue(r) + "\n");
  }
  console.log(`\n↳ ${acting.length} action issue(s) written to ${path.relative(root, outDir)}/`);
} else {
  console.log("\n↳ No actions — nothing to file.");
}
