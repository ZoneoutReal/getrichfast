// Niche-scout engine tests — pure logic, no browser needed.
// Usage: node scripts/tests/scout.test.mjs
import { evaluateCandidate, rankCandidates, renderReport, renderIssue } from "../lib/scout.mjs";

const results = [];
function check(name, cond, extra = "") {
  results.push({ ok: !!cond, name });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  → " + extra}`);
}

const strong = {
  slug: "pdf-toolkit",
  name: "Local PDF Toolkit",
  category: "PDF tools",
  competitors: [
    { name: "Smallpdf", users: 5000000, model: "subscription", freeCap: "2 tasks/day", complaints: ["price", "upload"] },
    { name: "iLovePDF", users: 3000000, model: "subscription", freeCap: "limits", complaints: ["privacy", "price"] },
    { name: "Sejda", users: 40000, model: "freemium", freeCap: "3/hour", complaints: ["upload"] },
  ],
  build: { localOnly: true, needsServer: false, needsOAuth: false, needsScraping: false, estDays: 3 },
  tosClean: true,
  supportRisk: "low",
  moat: "medium",
  priceHintUsd: 15,
};

const strongEval = evaluateCandidate(strong);
check("strong candidate qualifies (all 5 gates)", strongEval.qualified === true, JSON.stringify(strongEval.failedGates));
check("qualified candidate gets a numeric score", typeof strongEval.score === "number" && strongEval.score > 0, String(strongEval.score));
check("every gate reports pass=true", strongEval.gates.every((g) => g.pass), JSON.stringify(strongEval.gates.filter((g) => !g.pass)));

// gate #2 wedge detection
check("wedge: subscription detected", strongEval.wedge.subscription === true);
check("wedge: painful limit detected", strongEval.wedge.painfulLimit === true);
check("wedge: privacy complaint detected", strongEval.wedge.privacyComplaint === true);
check("wedge: price complaint detected", strongEval.wedge.priceComplaint === true);

// gate #1 proven demand — need ≥3 competitors at ≥10k
const thinDemand = { ...strong, slug: "thin", competitors: [{ name: "Only", users: 80000, model: "subscription", freeCap: "x", complaints: ["price"] }, { name: "Tiny", users: 900, model: "free" }] };
const thinEval = evaluateCandidate(thinDemand);
check("thin demand fails gate #1", thinEval.qualified === false && thinEval.failedGates[0].startsWith("#1"), JSON.stringify(thinEval.failedGates));
check("disqualified candidate has null score", thinEval.score === null, String(thinEval.score));

// gate #2 — no wedge at all
const noWedge = {
  ...strong,
  slug: "nowedge",
  competitors: [
    { name: "A", users: 500000, model: "free", complaints: [] },
    { name: "B", users: 200000, model: "free", complaints: [] },
    { name: "C", users: 50000, model: "free", complaints: [] },
  ],
};
check("no subscription/limit/complaint fails gate #2", evaluateCandidate(noWedge).failedGates.some((g) => g.startsWith("#2")), JSON.stringify(evaluateCandidate(noWedge).failedGates));

// gate #3 buildability
const needsServer = { ...strong, slug: "srv", build: { localOnly: false, needsServer: true, estDays: 3 } };
check("needs-server fails gate #3", evaluateCandidate(needsServer).failedGates.some((g) => g.startsWith("#3")));
const tooLong = { ...strong, slug: "long", build: { localOnly: true, needsServer: false, needsOAuth: false, needsScraping: false, estDays: 5 } };
check("estDays>3 fails gate #3", evaluateCandidate(tooLong).failedGates.some((g) => g.startsWith("#3")));

// gate #4 tos
const dirty = { ...strong, slug: "tos", tosClean: false, build: { localOnly: true, needsServer: false, needsOAuth: false, needsScraping: false, estDays: 3 } };
check("tosClean=false fails gate #4", evaluateCandidate(dirty).failedGates.some((g) => g.startsWith("#4")));

// gate #5 support
const highSupport = { ...strong, slug: "sup", supportRisk: "high" };
check("supportRisk=high fails gate #5", evaluateCandidate(highSupport).failedGates.some((g) => g.startsWith("#5")));

// scoring — determinism + monotonic in demand
check("scoring is deterministic", evaluateCandidate(strong).score === evaluateCandidate(strong).score);
const smallMarket = { ...strong, slug: "small", competitors: strong.competitors.map((c) => ({ ...c, users: Math.max(10000, Math.round(c.users / 100)) })) };
check("bigger proven market scores higher", evaluateCandidate(strong).score > evaluateCandidate(smallMarket).score, `${evaluateCandidate(strong).score} vs ${evaluateCandidate(smallMarket).score}`);
const highMoat = { ...strong, slug: "moat", moat: "high" };
check("higher moat scores higher", evaluateCandidate(highMoat).score > evaluateCandidate(strong).score, `${evaluateCandidate(highMoat).score} vs ${evaluateCandidate(strong).score}`);

// ranking — qualified before disqualified, higher score first
const ranked = rankCandidates([thinDemand, strong, highMoat]);
check("ranking puts qualified first", ranked[0].qualified && ranked[ranked.length - 1].qualified === false, ranked.map((r) => r.slug).join(","));
check("ranking orders qualified by score desc", ranked[0].score >= ranked[1].score, `${ranked[0].score} >= ${ranked[1].score}`);

// rendering
const issue = renderIssue(strongEval);
check("issue body names the candidate + score", issue.includes(strong.name) && issue.includes(String(strongEval.score)));
check("issue body carries the definition of done", issue.includes("Definition of done") && issue.includes("check-release.mjs"));
check("issue body lists all five gates", ["#1", "#2", "#3", "#4", "#5"].every((t) => issue.includes(t)));
const report = renderReport(ranked);
check("report recommends the top qualifier", report.includes("Recommended build") && report.includes(ranked[0].name));
const reportNone = renderReport([thinEval]);
check("report handles a no-qualifier week", reportNone.includes("No qualified candidate"), reportNone);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
