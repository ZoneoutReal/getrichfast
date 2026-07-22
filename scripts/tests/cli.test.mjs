// CLI smoke tests — exercise the actual command-line entry points, including
// the positional-input path that the lib-only tests don't cover.
// Usage: node scripts/tests/cli.test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "../lib/cli.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(path.dirname(here));
const SCOUT = path.join(root, "scripts", "niche-scout.mjs");
const BOARD = path.join(root, "scripts", "scoreboard.mjs");

const results = [];
function check(name, cond, extra = "") {
  results.push({ ok: !!cond, name });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  → " + extra}`);
}
function run(file, args) {
  try {
    return { code: 0, out: execFileSync("node", [file, ...args], { encoding: "utf8" }) };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || "") + (e.stderr || "") };
  }
}

// --- parseArgs unit checks ---
const p1 = parseArgs(["candidates.json"], ["--out"]);
check("parseArgs keeps a lone positional (the input file)", p1._[0] === "candidates.json", JSON.stringify(p1));
const p2 = parseArgs(["in.json", "--out", "dir", "--json"], ["--out"]);
check("parseArgs: positional survives alongside --out", p2._[0] === "in.json" && p2.out === "dir" && p2.json === true, JSON.stringify(p2));
const p3 = parseArgs(["--date", "2026-07-22", "stats.json"], ["--out", "--date"]);
check("parseArgs: value flag does not swallow a later positional", p3.date === "2026-07-22" && p3._[0] === "stats.json", JSON.stringify(p3));
check("parseArgs flags unknown options", parseArgs(["--nope"]).unknown[0] === "--nope");

// --- scout CLI with a REAL positional file (the regression the bug hid) ---
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scout-cli-"));
const candFile = path.join(tmp, "cands.json");
const outDir = path.join(tmp, "out");
fs.writeFileSync(
  candFile,
  JSON.stringify([
    {
      slug: "zzz-marker",
      name: "ZZZ Marker Product",
      category: "Test",
      competitors: [
        { name: "A", users: 2000000, model: "subscription", freeCap: "cap", complaints: ["price"] },
        { name: "B", users: 1000000, model: "subscription", freeCap: "cap", complaints: ["privacy"] },
        { name: "C", users: 50000, model: "freemium", freeCap: "cap", complaints: [] },
      ],
      build: { localOnly: true, needsServer: false, needsOAuth: false, needsScraping: false, estDays: 2 },
      tosClean: true,
      supportRisk: "low",
      priceHintUsd: 14,
    },
  ]),
);
const s = run(SCOUT, [candFile, "--out", outDir]);
check("scout CLI exits 0 on good input", s.code === 0, s.out);
check("scout CLI actually reads the positional file (not the example)", s.out.includes("ZZZ Marker Product"), s.out);
check("scout CLI writes the build issue for the passed candidate", fs.existsSync(path.join(outDir, "build-zzz-marker.md")), fs.readdirSync(outDir).join(","));
const issueBody = fs.existsSync(path.join(outDir, "build-zzz-marker.md")) ? fs.readFileSync(path.join(outDir, "build-zzz-marker.md"), "utf8") : "";
check("issue body keeps blank lines before headings (renders on GitHub)", /\n\n### Niche checklist/.test(issueBody), JSON.stringify(issueBody.slice(0, 120)));
check("issue body keeps a blank line after the blockquote", !/^> .*\n\*\*Category/m.test(issueBody), issueBody.slice(0, 160));

// --json writes nothing
const before = fs.existsSync(outDir) ? fs.readdirSync(outDir).length : 0;
const sj = run(SCOUT, [candFile, "--json", "--out", outDir]);
check("scout --json emits parseable JSON", (() => { try { return Array.isArray(JSON.parse(sj.out)); } catch { return false; } })(), sj.out.slice(0, 80));
check("scout --json writes no files", (fs.existsSync(outDir) ? fs.readdirSync(outDir).length : 0) === before);

// --- scoreboard CLI with positional file + --date ---
const statsFile = path.join(tmp, "stats.json");
fs.writeFileSync(statsFile, JSON.stringify([{ product: "zzz-feed", liveSince: "2026-06-01", indexed: true, installs: 900, proSalesThisWeek: 8, revenueTotal: 600 }]));
const b = run(BOARD, [statsFile, "--date", "2026-07-22", "--out", outDir]);
check("scoreboard CLI exits 0 on good input", b.code === 0, b.out);
check("scoreboard CLI reads the positional file", b.out.includes("zzz-feed"), b.out);
check("scoreboard writes a FEED action issue", fs.existsSync(path.join(outDir, "action-feed-zzz-feed.md")), fs.readdirSync(outDir).join(","));

// --- error handling ---
check("scout --help exits 0", run(SCOUT, ["--help"]).code === 0);
check("scout unknown flag exits 2", run(SCOUT, ["--bogus"]).code === 2);
check("scout missing file exits 2", run(SCOUT, [path.join(tmp, "nope.json")]).code === 2);
check("scoreboard bad --date exits 2", run(BOARD, [statsFile, "--date", "not-a-date"]).code === 2);

fs.rmSync(tmp, { recursive: true, force: true });

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
