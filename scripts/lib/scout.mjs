// Niche-scout scoring engine (pure, offline, deterministic).
//
// Turns evidence about a candidate niche into a go/no-go decision, faithfully
// encoding PLAYBOOK.md's "Niche qualification checklist (all must pass)" plus a
// ranked opportunity score for the candidates that survive. No network, no
// Date, no scraping — evidence is gathered upstream (by a research agent using
// web search, or by the founder) and fed in as JSON. That keeps the judgment
// reproducible and keeps us off other people's platforms (checklist gate #4).
//
// A candidate looks like scripts/data/candidates.example.json. Every gate maps
// 1:1 to a numbered checklist item so a rejection always names the rule it hit.

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const round2 = (x) => Math.round(x * 100) / 100;

// Chrome Web Store "proven demand" bar from the checklist: ≥3 competitors at
// ≥10k installs. Anything below that is "no demand", not "wide open".
const DEMAND_MIN_COMPETITORS = 3;
const DEMAND_MIN_USERS = 10_000;
const MAX_BUILD_DAYS = 3; // "Buildable local-only in ≤3 days"
const PRICE_BAND = [9, 19]; // one-time impulse tier from the pricing rules

// --- wedge detection -------------------------------------------------------
// Checklist #2: the leading competitor charges a subscription, has painful
// limits, or has reviews complaining about privacy/price. Each is one signal.
function wedgeSignals(competitors) {
  const has = (pred) => competitors.some(pred);
  const complains = (tag) =>
    competitors.some((c) => (c.complaints || []).map((s) => s.toLowerCase()).includes(tag));
  return {
    subscription: has((c) => c.model === "subscription"),
    painfulLimit: has((c) => typeof c.freeCap === "string" && c.freeCap.trim() !== ""),
    privacyComplaint: complains("privacy"),
    priceComplaint: complains("price"),
  };
}

// --- the five gates --------------------------------------------------------
function evaluateGates(c) {
  const competitors = c.competitors || [];
  const qualifying = competitors.filter((x) => (x.users || 0) >= DEMAND_MIN_USERS);
  const b = c.build || {};
  const wedge = wedgeSignals(competitors);
  const wedgeCount = Object.values(wedge).filter(Boolean).length;
  const support = (c.supportRisk || "").toLowerCase();
  // Free-clone saturation: a paid incumbent clears gate #2, but if the shelf
  // is already full of *free* local tools at scale, a pay-once wedge is
  // contested no matter how the incumbent prices. Surfaced in scoring/rendering
  // as monetization risk — the exact trap that commodity local niches (PDF,
  // HEIC) fall into once every capability has a free clone.
  const freeAtScale = competitors.filter((x) => x.model === "free" && (x.users || 0) >= DEMAND_MIN_USERS).length;

  const gates = [
    {
      id: 1,
      name: "Proven demand",
      pass: qualifying.length >= DEMAND_MIN_COMPETITORS,
      detail: `${qualifying.length}/${DEMAND_MIN_COMPETITORS} competitors ≥ ${DEMAND_MIN_USERS.toLocaleString()} installs`,
    },
    {
      id: 2,
      name: "Monetization wedge",
      pass: wedgeCount >= 1,
      detail:
        (wedgeCount >= 1
          ? "wedge: " + Object.entries(wedge).filter(([, v]) => v).map(([k]) => k).join(", ")
          : "no subscription / painful limit / privacy-or-price complaint found") +
        (freeAtScale > 0 ? ` · ⚠ ${freeAtScale} free competitor(s) ≥ ${DEMAND_MIN_USERS.toLocaleString()} installs (contested)` : ""),
    },
    {
      id: 3,
      name: "Buildable local-only ≤3 days",
      pass:
        b.localOnly === true &&
        !b.needsServer &&
        !b.needsOAuth &&
        !b.needsScraping &&
        typeof b.estDays === "number" &&
        b.estDays <= MAX_BUILD_DAYS,
      detail: `local=${!!b.localOnly} server=${!!b.needsServer} oauth=${!!b.needsOAuth} scraping=${!!b.needsScraping} est=${b.estDays ?? "?"}d`,
    },
    {
      id: 4,
      name: "ToS-clean",
      pass: c.tosClean === true,
      detail: c.tosNotes || (c.tosClean === true ? "clean" : "not confirmed"),
    },
    {
      id: 5,
      name: "Support burden ≈ 0",
      // "doesn't work on site X" tickets daily = fail. high fails; medium is a
      // penalized pass; low is ideal.
      pass: support === "low" || support === "medium",
      detail: `supportRisk=${support || "unset"}${c.supportNotes ? " — " + c.supportNotes : ""}`,
    },
  ];

  return { gates, qualifying, wedge, wedgeCount, support, freeAtScale };
}

// --- opportunity score (only meaningful once all gates pass) ---------------
// Weighted 0–100. Every component is explainable and bounded so two people
// scoring the same evidence get the same number.
const WEIGHTS = { demand: 0.3, wedge: 0.25, build: 0.15, support: 0.15, moat: 0.15 };

function scoreParts(c, ev) {
  const totalQualUsers = ev.qualifying.reduce((s, x) => s + (x.users || 0), 0);
  // 10k → 0, 10M → 1 on a log scale (BlockSite-at-5M lands ~0.9).
  const demand = totalQualUsers > 0 ? clamp((Math.log10(totalQualUsers) - 4) / 3, 0, 1) : 0;
  // Free-clone saturation discounts the wedge: a shelf full of free local
  // tools halves what a pay-once angle is worth, even with a paid incumbent.
  const freePressure = clamp((ev.freeAtScale || 0) / 3, 0, 1);
  const wedge = (ev.wedgeCount / 4) * (1 - 0.5 * freePressure);
  const estDays = (c.build && c.build.estDays) || MAX_BUILD_DAYS;
  const build = clamp((MAX_BUILD_DAYS + 1 - estDays) / MAX_BUILD_DAYS, 0, 1); // 1d→1, 3d→0.33
  const support = ev.support === "low" ? 1 : ev.support === "medium" ? 0.5 : 0;
  // Moat: a normally-cloud capability done locally (in-browser ML) resists
  // me-too clones — the next-wave thesis. Explicit override wins if provided.
  const moatWord = (c.moat || (c.build && c.build.inBrowserML ? "high" : "low")).toLowerCase();
  const moat = moatWord === "high" ? 1 : moatWord === "medium" ? 0.6 : 0.3;
  return { demand, wedge, build, support, moat };
}

export function evaluateCandidate(c) {
  const ev = evaluateGates(c);
  const failed = ev.gates.filter((g) => !g.pass);
  const qualified = failed.length === 0;

  let parts = null;
  let score = null;
  if (qualified) {
    parts = scoreParts(c, ev);
    score = Math.round(
      100 * (WEIGHTS.demand * parts.demand + WEIGHTS.wedge * parts.wedge + WEIGHTS.build * parts.build + WEIGHTS.support * parts.support + WEIGHTS.moat * parts.moat),
    );
  }

  return {
    slug: c.slug,
    name: c.name || c.slug,
    category: c.category || "",
    pitch: c.pitch || "",
    priceHintUsd: c.priceHintUsd || PRICE_BAND[0],
    gates: ev.gates,
    wedge: ev.wedge,
    qualified,
    failedGates: failed.map((g) => `#${g.id} ${g.name}`),
    monetizationRisk: ev.freeAtScale >= 2 ? "high" : ev.freeAtScale === 1 ? "medium" : "low",
    freeAtScale: ev.freeAtScale,
    scoreParts: parts && Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, round2(v)])),
    score,
  };
}

// Rank: qualified first (highest score wins), then disqualified. Stable on
// slug so runs are reproducible.
export function rankCandidates(candidates) {
  return candidates
    .map(evaluateCandidate)
    .sort((a, b) => {
      if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
      if (a.qualified && b.qualified && a.score !== b.score) return b.score - a.score;
      return String(a.slug).localeCompare(String(b.slug));
    });
}

// --- rendering (pure strings, testable) ------------------------------------
export function renderReport(evals) {
  const lines = [];
  const q = evals.filter((e) => e.qualified);
  lines.push(`# Niche scout — ${evals.length} candidate(s), ${q.length} qualified\n`);
  lines.push("| Rank | Candidate | Qualified | Score | Gate that failed |");
  lines.push("|---|---|---|---|---|");
  evals.forEach((e, i) => {
    lines.push(
      `| ${i + 1} | ${e.name} | ${e.qualified ? "✅" : "❌"} | ${e.qualified ? e.score : "—"} | ${e.qualified ? "—" : e.failedGates[0]} |`,
    );
  });
  lines.push("");
  if (q.length) {
    lines.push(`**Recommended build: ${q[0].name}** (score ${q[0].score}). Draft issue written for it.`);
  } else {
    lines.push("**No qualified candidate this week.** Per the weekly loop: no build — polish a winner instead.");
  }
  return lines.join("\n");
}

// Ready-to-file GitHub issue for a qualifying candidate — mirrors the
// PLAYBOOK's "definition of done" so the build ticket is self-contained.
// Blank lines are load-bearing (Markdown section breaks), so nothing is
// filtered here — the optional pitch line is added conditionally instead.
export function renderIssue(e) {
  const parts = e.scoreParts || {};
  const slug = e.slug || "slug";
  const compRow = (g) => `- ${g.pass ? "✅" : "❌"} **#${g.id} ${g.name}** — ${g.detail}`;
  const out = [`## Build candidate: ${e.name} (score ${e.score})`, ""];
  if (e.pitch) out.push(`> ${e.pitch}`, "");
  out.push(
    `**Category:** ${e.category} · **Suggested price:** one-time $${e.priceHintUsd}`,
    "",
    "### Niche checklist (all passed)",
    ...e.gates.map(compRow),
    "",
    "### Opportunity score",
    `\`${e.score}/100\` = demand ${parts.demand} · wedge ${parts.wedge} · build ${parts.build} · support ${parts.support} · moat ${parts.moat} (weighted)`,
    "",
  );
  if (e.monetizationRisk && e.monetizationRisk !== "low") {
    out.push(
      `> ⚠️ **Monetization risk: ${e.monetizationRisk}.** ${e.freeAtScale} free competitor(s) already at scale — the pay-once wedge is contested. Only build if you can lead hard on a capability the free clones lack (else this is a commodity race to the bottom).`,
      "",
    );
  }
  out.push(
    "### Definition of done (from PLAYBOOK)",
    `- [ ] Clone the SnipKey factory structure into \`products/${slug}/\``,
    "- [ ] Core feature working, 100% local (no server / OAuth / scraping)",
    "- [ ] Tests green (logic + real-extension smoke)",
    "- [ ] Icons + 1280×800 screenshots + promo tiles generated",
    "- [ ] Listing kit written (`store/listing.md`) with privacy answers",
    `- [ ] Release zip built and \`node scripts/check-release.mjs ${slug}\` passes`,
    `- [ ] Wire ExtensionPay ID + one-time $${e.priceHintUsd} Pro plan`,
    "",
    "_Generated by `scripts/niche-scout.mjs`. Evidence lives in the candidate JSON._",
  );
  return out.join("\n");
}
