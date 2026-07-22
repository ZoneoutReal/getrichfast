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

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const jsonOut = args.includes("--json");
const outIdx = args.indexOf("--out");
const outDir = outIdx >= 0 ? args[outIdx + 1] : path.join(root, "scout-out");
const dateIdx = args.indexOf("--date");
const now = dateIdx >= 0 ? new Date(args[dateIdx + 1] + "T12:00:00Z") : new Date();
const consumed = new Set([args[outIdx + 1], args[dateIdx + 1]]);
const inputArg = args.find((a) => !a.startsWith("--") && !consumed.has(a));
const inputPath = inputArg || path.join(root, "scripts", "data", "scoreboard.example.json");

if (Number.isNaN(now.getTime())) {
  console.error("✗ --date must be YYYY-MM-DD");
  process.exit(2);
}

let products;
try {
  products = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  if (!Array.isArray(products)) throw new Error("expected a JSON array of product stats");
} catch (e) {
  console.error(`✗ could not read stats from ${inputPath}: ${e.message}`);
  process.exit(2);
}

const rows = evaluateBoard(products, now);

if (jsonOut) {
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

console.log(renderScoreboard(rows));

const acting = actionableRows(rows);
if (acting.length) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const r of acting) {
    const file = path.join(outDir, `action-${r.action.toLowerCase()}-${r.product}.md`);
    fs.writeFileSync(file, renderActionIssue(r) + "\n");
  }
  console.log(`\n↳ ${acting.length} action issue(s) written to ${path.relative(root, outDir)}/`);
} else {
  console.log("\n↳ No actions — nothing to file.");
}
