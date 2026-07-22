// Scoreboard autopilot (pure, deterministic given a reference date).
//
// Applies PLAYBOOK.md's pre-committed kill/feed rules to each live product's
// store stats so hope never overrides the math. Evidence (impressions,
// installs, weekly users, Pro sales, revenue) is read from the Chrome Web Store
// dashboard by the founder or a computer-use agent and fed in as JSON — see
// scripts/data/scoreboard.example.json. The date is injected so results are
// reproducible in tests; the CLI defaults it to today.
//
// Rules encoded (verbatim intent):
//   KILL   — live + indexed ≥30 days AND <50 installs AND $0 revenue →
//            one listing iteration (title/summary/screenshots); still flat 2
//            weeks after that iteration → archive. No sunk-cost polishing.
//   FEED   — ≥5 Pro sales in a week → Edge port, Firefox port, roadmap features
//            from reviews, more SEO pages.

const DAY = 86_400_000;
export const KILL_MIN_AGE_DAYS = 30;
export const KILL_MAX_INSTALLS = 50;
export const ITERATION_GRACE_DAYS = 14; // "2 more weeks" after a listing iteration
export const FEED_MIN_PRO_SALES = 5;

const daysBetween = (fromISO, now) => Math.floor((now.getTime() - new Date(fromISO + "T00:00:00Z").getTime()) / DAY);

export function evaluateProduct(p, now) {
  const ageDays = p.liveSince ? daysBetween(p.liveSince, now) : null;
  const indexed = p.indexed !== false; // assume indexed unless told otherwise
  const installs = p.installs || 0;
  const revenue = p.revenueTotal || 0;
  const proWeek = p.proSalesThisWeek || 0;
  const iteratedDays = p.listingIteratedAt ? daysBetween(p.listingIteratedAt, now) : null;

  const flat = installs < KILL_MAX_INSTALLS && revenue === 0;
  const killWindow = indexed && ageDays !== null && ageDays >= KILL_MIN_AGE_DAYS;

  let action, rule, why, next;

  if (proWeek >= FEED_MIN_PRO_SALES) {
    // Feed takes precedence — a winner is never a kill candidate.
    action = "FEED";
    rule = `≥${FEED_MIN_PRO_SALES} Pro sales in a week (${proWeek})`;
    why = "Proven conversion — invest to compound it.";
    next = ["Port to Edge Add-ons", "Port to Firefox", "Mine reviews for the next Pro feature", "Add SEO / comparison pages"];
  } else if (killWindow && flat && !p.listingIteratedAt) {
    action = "ITERATE_LISTING";
    rule = `live+indexed ${ageDays}d, ${installs}<${KILL_MAX_INSTALLS} installs, $${revenue} revenue`;
    why = "Kill window reached with no traction — earn one iteration before archiving.";
    next = ["Rewrite title/summary keywords", "Regenerate hero + screenshots", "Re-check the niche wedge", `Re-measure in ${ITERATION_GRACE_DAYS} days`];
  } else if (killWindow && flat && iteratedDays !== null && iteratedDays >= ITERATION_GRACE_DAYS) {
    action = "ARCHIVE";
    rule = `still flat ${iteratedDays}d after listing iteration (${installs} installs, $${revenue})`;
    why = "One iteration already tried and 2+ weeks flat — archive, no sunk-cost polishing.";
    next = ["Unpublish / mark archived", "Record the miss in the product PR", "Reallocate the slot to a fresh shot"];
  } else if (killWindow && flat && iteratedDays !== null) {
    action = "HOLD";
    rule = `iteration ${iteratedDays}d ago — grace period ends at ${ITERATION_GRACE_DAYS}d`;
    why = "Listing iteration in flight; let it run before the archive call.";
    next = [`Re-measure in ${ITERATION_GRACE_DAYS - iteratedDays} more day(s)`];
  } else {
    action = "HOLD";
    rule = killWindow ? `${installs} installs, $${revenue} — above kill floor` : `only ${ageDays ?? "?"}d live — pre-30d window`;
    why = ageDays !== null && ageDays < KILL_MIN_AGE_DAYS ? "Too early to judge." : "Traction present or building — keep monitoring.";
    next = ["Keep on the weekly scoreboard"];
  }

  return { product: p.product, ageDays, installs, weeklyUsers: p.weeklyUsers || 0, proWeek, revenue, action, rule, why, next };
}

export function evaluateBoard(products, now) {
  return products.map((p) => evaluateProduct(p, now));
}

const ACTION_ORDER = { FEED: 0, ARCHIVE: 1, ITERATE_LISTING: 2, HOLD: 3 };
const ACTION_ICON = { FEED: "🚀", ARCHIVE: "🗄️", ITERATE_LISTING: "✏️", HOLD: "⏳" };

// --- rendering -------------------------------------------------------------
export function renderScoreboard(rows) {
  const sorted = [...rows].sort((a, b) => (ACTION_ORDER[a.action] - ACTION_ORDER[b.action]) || String(a.product).localeCompare(String(b.product)));
  const lines = [];
  const acting = sorted.filter((r) => r.action !== "HOLD");
  lines.push(`# Scoreboard — ${rows.length} product(s), ${acting.length} need action\n`);
  lines.push("| Product | Installs | Wk users | Pro/wk | Revenue | Action |");
  lines.push("|---|--:|--:|--:|--:|---|");
  for (const r of sorted) {
    lines.push(`| ${r.product} | ${r.installs} | ${r.weeklyUsers} | ${r.proWeek} | $${r.revenue} | ${ACTION_ICON[r.action]} ${r.action} |`);
  }
  lines.push("");
  if (acting.length === 0) lines.push("_No kill/feed actions this week — all products holding._");
  return lines.join("\n");
}

// One GitHub issue per actionable product (FEED / ITERATE / ARCHIVE).
export function renderActionIssue(r) {
  return [
    `## ${ACTION_ICON[r.action]} ${r.action.replace("_", " ")}: ${r.product}`,
    "",
    `**Rule triggered:** ${r.rule}`,
    `**Why:** ${r.why}`,
    "",
    `**Stats:** ${r.installs} installs · ${r.weeklyUsers} weekly users · ${r.proWeek} Pro sales this week · $${r.revenue} total`,
    "",
    "### Next steps",
    ...r.next.map((s) => `- [ ] ${s}`),
    "",
    "_Generated by `scripts/scoreboard.mjs` from the weekly Chrome Web Store stats._",
  ].join("\n");
}

export function actionableRows(rows) {
  return rows.filter((r) => r.action !== "HOLD");
}
