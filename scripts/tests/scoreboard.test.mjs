// Scoreboard-autopilot engine tests — kill/feed rules, fixed reference date.
// Usage: node scripts/tests/scoreboard.test.mjs
import { evaluateProduct, evaluateBoard, renderScoreboard, renderActionIssue, actionableRows } from "../lib/scoreboard.mjs";

const NOW = new Date("2026-07-22T12:00:00Z");
const results = [];
function check(name, cond, extra = "") {
  results.push({ ok: !!cond, name });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  → " + extra}`);
}

const ev = (p) => evaluateProduct(p, NOW);

// age math
check("ageDays computed from liveSince", ev({ product: "x", liveSince: "2026-06-01", installs: 100 }).ageDays === 51, String(ev({ product: "x", liveSince: "2026-06-01", installs: 100 }).ageDays));

// FEED — ≥5 Pro sales this week wins over everything
const feed = ev({ product: "focusfence", liveSince: "2026-06-01", installs: 820, weeklyUsers: 310, proSalesThisWeek: 7, revenueTotal: 540 });
check("≥5 Pro sales → FEED", feed.action === "FEED", feed.action);
check("FEED next steps include Edge + Firefox ports", feed.next.join(" ").includes("Edge") && feed.next.join(" ").includes("Firefox"));
// exactly at threshold
check("exactly 5 Pro sales → FEED", ev({ product: "z", liveSince: "2026-06-01", installs: 100, proSalesThisWeek: 5, revenueTotal: 100 }).action === "FEED");
check("4 Pro sales does not FEED", ev({ product: "z", liveSince: "2026-07-15", installs: 100, proSalesThisWeek: 4, revenueTotal: 60 }).action !== "FEED");

// ITERATE — 30d+, flat, never iterated
const iterate = ev({ product: "copymark", liveSince: "2026-06-10", indexed: true, installs: 22, proSalesThisWeek: 0, revenueTotal: 0, listingIteratedAt: null });
check("30d+ flat, no iteration → ITERATE_LISTING", iterate.action === "ITERATE_LISTING", iterate.action);

// ARCHIVE — iterated ≥14d ago, still flat
const archive = ev({ product: "snipshot", liveSince: "2026-05-20", indexed: true, installs: 31, proSalesThisWeek: 0, revenueTotal: 0, listingIteratedAt: "2026-06-25" });
check("iterated 27d ago, still flat → ARCHIVE", archive.action === "ARCHIVE", archive.action);

// HOLD (grace) — iterated <14d ago
const grace = ev({ product: "pagepulse", liveSince: "2026-06-15", indexed: true, installs: 40, proSalesThisWeek: 0, revenueTotal: 0, listingIteratedAt: "2026-07-15" });
check("iterated 7d ago → HOLD (grace)", grace.action === "HOLD" && grace.rule.includes("grace"), `${grace.action} / ${grace.rule}`);

// HOLD (pre-30d) — too early
const early = ev({ product: "jsonpeek", liveSince: "2026-07-14", indexed: true, installs: 12, proSalesThisWeek: 1, revenueTotal: 12 });
check("only 8d live → HOLD (pre-30d)", early.action === "HOLD" && early.rule.includes("pre-30d"), `${early.action} / ${early.rule}`);
check("exactly 29d live does not kill", ev({ product: "z", liveSince: "2026-06-23", indexed: true, installs: 5, revenueTotal: 0 }).action === "HOLD");
check("exactly 30d live + flat → ITERATE", ev({ product: "z", liveSince: "2026-06-22", indexed: true, installs: 5, revenueTotal: 0 }).action === "ITERATE_LISTING");

// HOLD — above the kill floor
const holding = ev({ product: "snipkey", liveSince: "2026-05-01", indexed: true, installs: 240, weeklyUsers: 62, proSalesThisWeek: 2, revenueTotal: 90 });
check("above install floor → HOLD", holding.action === "HOLD", holding.action);
check("≥50 installs is not a kill candidate", ev({ product: "z", liveSince: "2026-05-01", indexed: true, installs: 50, revenueTotal: 0 }).action === "HOLD");
check("any revenue is not a kill candidate", ev({ product: "z", liveSince: "2026-05-01", indexed: true, installs: 5, revenueTotal: 9 }).action === "HOLD");

// indexed gate — not indexed can't be killed however old
check("not indexed → never kill", ev({ product: "z", liveSince: "2026-01-01", indexed: false, installs: 0, revenueTotal: 0 }).action === "HOLD");

// board + rendering
const rows = evaluateBoard([feed, iterate, archive, grace, early, holding].map((r) => ({ product: r.product, liveSince: "2026-06-01", installs: r.installs, proSalesThisWeek: r.proWeek, revenueTotal: r.revenue })), NOW);
check("evaluateBoard returns one row per product", rows.length === 6, String(rows.length));
const board = renderScoreboard([feed, iterate, archive, grace, early, holding]);
check("scoreboard renders a row per product", ["focusfence", "copymark", "snipshot", "pagepulse", "jsonpeek", "snipkey"].every((p) => board.includes(p)));
check("scoreboard sorts FEED before HOLD", board.indexOf("FEED") < board.indexOf("HOLD"), board);
check("actionableRows drops HOLDs", actionableRows([feed, iterate, archive, grace, early, holding]).every((r) => r.action !== "HOLD"));
const ai = renderActionIssue(feed);
check("action issue quotes the rule and next steps", ai.includes("Rule triggered") && ai.includes("Next steps"));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
