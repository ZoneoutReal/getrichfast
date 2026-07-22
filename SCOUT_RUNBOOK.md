# Weekly scout & scoreboard runbook (for a Claude Code agent)

This automates two Monday rituals from the PLAYBOOK — **"pick (or skip)"** and
**"read the scoreboard"** — so they arrive as pre-filled GitHub issues instead
of a blank page. The judgment is deterministic (encoded in `scripts/lib/`); the
agent's only job is to gather honest evidence and file what the engines decide.

**Boundary that makes this legitimate:** the scout does **not** scrape the
Chrome Web Store or any platform against its ToS — that would break the very
gate (#4) the checklist enforces. Evidence comes from ordinary web search,
public listing pages a human would read, and the founder's own dashboard
numbers. Garbage evidence in = garbage decision out, so the gathering step is
where the care goes.

---

## Part A — Niche scout (the "build this week" pick)

### PROMPT — paste this to the agent

> You are the Monday niche scout for a portfolio of privacy-first, pay-once,
> local-only Chrome extensions. Produce this week's build candidate.
>
> 1. Read `PLAYBOOK.md` — specifically the **niche qualification checklist**
>    (the 5 gates) and the **pricing rules**. Those are law.
> 2. Brainstorm 3–6 candidate niches. Good sources: categories adjacent to our
>    shipped products, "alternatives to <paid tool>" searches, and recurring
>    complaints about existing extensions. Do **not** propose anything that
>    automates someone else's platform/account, needs a server/OAuth, or
>    scrapes logged-in sites — those fail gates #3/#4 by construction.
> 3. For each candidate, gather **real evidence** with web search and by
>    reading public store listings: the top competitors, their approximate
>    install counts, their pricing model (subscription vs one-time), their free
>    caps, and what reviews complain about (privacy/price). Record it in the
>    schema below. If you cannot find ≥3 competitors at ≥10k installs, say so —
>    that candidate fails gate #1 and that is a valid, useful result.
> 4. Write the candidates to `scripts/data/candidates.<date>.json` (array;
>    schema = `scripts/data/candidates.example.json`).
> 5. Run `node scripts/niche-scout.mjs scripts/data/candidates.<date>.json`.
> 6. If a candidate qualifies, open the generated `scout-out/build-*.md` for the
>    **top pick** and file it as a GitHub issue (title `Build: <name>`, label
>    `build-candidate`) via the GitHub MCP. If nothing qualifies, do **not**
>    invent one — post a one-line comment on the tracking issue: "No qualified
>    niche this week; polish a winner instead" (that is the PLAYBOOK rule).
> 7. Never fabricate install counts or reviews. An unqualified week is the
>    system working, not failing.

### Candidate schema (per entry)

```jsonc
{
  "slug": "pdf-toolkit",              // products/<slug>/
  "name": "Local PDF Toolkit",
  "category": "PDF tools",
  "pitch": "One sentence, benefit-first.",
  "competitors": [
    { "name": "Smallpdf", "users": 5000000, "model": "subscription",
      "priceUsd": 12, "period": "mo", "freeCap": "2 tasks/day",
      "complaints": ["price", "upload"] }
    // ≥3 needed at ≥10k users to clear gate #1
  ],
  "build": { "localOnly": true, "needsServer": false, "needsOAuth": false,
             "needsScraping": false, "estDays": 3, "inBrowserML": false },
  "tosClean": true,
  "tosNotes": "Why it touches no third-party platform.",
  "supportRisk": "low",               // low | medium | high  (high fails gate #5)
  "moat": "medium",                   // low | medium | high  (in-browser ML = high)
  "priceHintUsd": 15                  // one-time, $9–$19 band
}
```

The 5 gates are all-or-nothing; the opportunity score (0–100) only ranks the
candidates that already passed. Weights: demand .30, wedge .25, build .15,
support .15, moat .15.

**Monetization risk:** a paid incumbent clears gate #2, but if the shelf is
already full of *free* local clones (competitors priced `free` at ≥10k
installs), the pay-once wedge is contested. Those discount the wedge score and
raise a `monetizationRisk: medium|high` flag in the build issue — the trap
commodity local niches (PDF, HEIC) fall into. A high-risk candidate should only
be built with a capability the free clones lack, not on price alone.

---

## Part B — Scoreboard autopilot (the kill/feed call)

### PROMPT — paste this to the agent

> You are the Monday scoreboard reader. Apply the PLAYBOOK's pre-committed
> kill/feed rules to live product stats — do not soften them.
>
> 1. Collect this week's Chrome Web Store dashboard numbers for every live
>    product: installs, weekly users, Pro sales this week, total revenue, the
>    live-since date, and whether the listing has been iterated (and when). The
>    founder pastes these, or a computer-use agent reads them from the already
>    signed-in dashboard. Put them in `scripts/data/scoreboard.<date>.json`
>    (schema = `scripts/data/scoreboard.example.json`).
> 2. Run `node scripts/scoreboard.mjs scripts/data/scoreboard.<date>.json`.
> 3. For each generated `scout-out/action-*.md`, file a GitHub issue:
>    - `FEED` → title `Feed: <product>`, label `feed`
>    - `ITERATE_LISTING` → title `Iterate listing: <product>`, label `kill-watch`
>    - `ARCHIVE` → title `Archive: <product>`, label `kill`
> 4. `HOLD` rows need no issue — they are just this week's status.
> 5. If an ARCHIVE issue is filed, do **not** unpublish anything yourself; that
>    is a founder decision. The issue is the prompt for it.

### The rules it encodes (from PLAYBOOK, verbatim intent)

- **Kill:** live + indexed ≥30 days AND <50 installs AND $0 revenue → one
  listing iteration; still flat 2 weeks after that iteration → archive.
- **Feed:** ≥5 Pro sales in a week → Edge port, Firefox port, roadmap features
  from reviews, more SEO pages.

---

## Scheduling it (optional, once you trust it)

Both scripts are cron-safe (they exit non-zero only on bad input). To make this
a standing Monday job, create a recurring trigger that opens a fresh session and
runs this runbook. Example weekly cron (Mondays 14:00 UTC):

```
0 14 * * 1   →   "Follow SCOUT_RUNBOOK.md Part A, then Part B."
```

Keep the human in the loop for the two things that must stay human: filing an
`ARCHIVE`/unpublish decision, and confirming the evidence is real before a build
issue turns into a week of work.

---

## Quick reference

```bash
npm run scout                              # scores scripts/data/candidates.example.json
npm run scout -- path/to/candidates.json   # real run
npm run scout -- --json                     # machine-readable, no files written
npm run scoreboard -- --date 2026-07-22     # pin "today" for a reproducible run
npm test                                    # 44 engine tests
```

Generated issue bodies land in `scout-out/` (gitignored). File them with the
GitHub MCP or paste them by hand — they are self-contained.
