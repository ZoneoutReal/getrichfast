# The Product Factory Playbook

The operating system for this repo. One person's identity + Claude Code's
build capacity + marketplace distribution = a portfolio of small paid tools
with **zero human interaction** in the sales loop. Marketplaces bring buyers;
buyers self-serve; support is automated.

The math this is built on (see RESEARCH.md for sources): 54% of indie
products earn $0 — product income is a power law. You don't beat that by
betting one idea; you beat it by **shipping many cheap shots and feeding the
winner**. Claude Code makes each shot cost hours instead of weeks.

---

## The weekly loop

**Monday — pick (or skip).** Scan for a niche using the checklist below. No
qualified niche = no build this week; polish a winner instead.

**Tuesday–Thursday — build.** Clone the SnipKey structure
(`products/snipkey/` is the template: extension + tests + icon/screenshot
generators + listing kit). Definition of done: tests green, screenshots
generated, listing written, zip built.

**Friday — ship.** Founder does the ~20 minutes of uploads. Submit, move on.
Never wait for a review to start the next cycle.

**Every Monday — read the scoreboard.** Store stats for each live product:
impressions, installs, weekly users, Pro conversions. Apply kill/feed rules.

## Niche qualification checklist (all must pass)

1. **Proven demand:** Chrome Web Store search for the category shows ≥3
   competitors with ≥10k installs. (No competitors = no demand, not "wide
   open".)
2. **Monetization wedge:** the leading competitor charges a subscription, has
   painful limits, or has reviews complaining about privacy/price. Our angle
   is always the same: *one-time price, 100% local, no account.*
3. **Buildable local-only in ≤3 days** with Claude Code — no servers, no
   OAuth, no scraping of logged-in sites.
4. **ToS-clean:** never automate actions on someone else's platform against
   their terms (no LinkedIn scrapers, no bulk-DM tools, no view bots). Those
   listings get taken down and accounts get banned — that's the whole
   business gone.
5. **Support burden ≈ 0:** if a product would generate "it doesn't work on
   site X" tickets daily, it fails this gate.

## Pricing rules

- One-time, $9–$19. Undercut subscription incumbents on lifetime cost.
- Free tier generous enough to love, limited enough to outgrow (SnipKey: 10
  snippets).
- Refund on request, no questions — disputes cost more than refunds, and
  "easy refunds" reviews sell copies.

## Distribution (all zero-interaction)

1. **Chrome Web Store organic search** — the engine. Listing title/summary
   carry the keywords; reviews compound ranking.
2. **Edge Add-ons port** — same zip, free developer account, a second organic
   channel for ~30 minutes of work. Do it after a product's first sale.
3. **Landing site SEO** (`docs/`) — one page per product + privacy policy;
   GitHub Pages is free hosting.
4. **Directories** — AlternativeTo, Product Hunt (can be posted without
   engagement; upside only), extension roundup sites. Submit-and-forget.
5. **Never:** cold DMs, comment spam, review swaps, fake reviews. Besides
   being wrong, they're account-level death sentences.

## Kill / feed rules (pre-committed)

- **Kill:** live + indexed for 30 days AND <50 installs AND $0 revenue →
  one listing iteration (title/summary/screenshots). Still flat after 2 more
  weeks → archive. No sunk-cost polishing.
- **Feed:** ≥5 Pro sales in a week → Edge port, Firefox port, roadmap
  features from reviews, more SEO pages.
- **Portfolio target:** 6–10 shots shipped before judging the strategy. The
  playbook expects most to miss — the portfolio only needs one or two hits.

## Support automation

- Support link goes to GitHub Issues with templates; Claude triages and
  drafts every reply for founder one-click approval.
- FAQ on the landing page absorbs the repetitive questions.
- Crash-grade bugs get fixed and shipped as an update; everything else is
  weekly-batched.

## Candidate shortlist — status after the July 2026 build sprint

The original shortlist is now mostly shipped (validation evidence recorded in
each product's PR):

1. ~~**Developer/QA form filler**~~ → **shipped as MockFill (#3)**. Validated:
   Fake Filler ~120k users charging $3.99/mo for custom fields.
2. ~~**Copy-as-Markdown everywhere**~~ → **shipped as CopyMark (#4)**. Demand
   proven (MarkDownload/Copy-as-Markdown/MarkSnip); monetization is the
   riskiest of the batch, priced at impulse-tier $9.
3. ~~**Local screenshot annotator**~~ → **shipped as SnipShot (#2)**.
4. ~~**JSON viewer-formatter with big-file support**~~ → **shipped as
   JSONPeek (#5)**. Validated: subscription incumbent at $4.99/mo.
5. **Recurring-invoice text generator for freelancers** — still open;
   likely a SnipKey feature marketed as its own listing.

Two additional niches were validated and shipped the same sprint:

6. **Site blocker / focus mode** → **FocusFence (#6)**. Validated: BlockSite
   5M+ users at $10.99/mo, ~3-site free cap, privacy complaints.
7. **Auto refresh + page monitor** → **PagePulse (#7)**. Validated:
   Auto Refresh Plus category in the millions, monitoring paywalled.

**Portfolio: 7 products shipped.** The 6–10 shot target below is met — the
job now shifts to Friday uploads, Monday scoreboards, and kill/feed calls.

## Boundaries (non-negotiable)

- Nothing that violates platform ToS, scrapes private data, automates other
  people's accounts, or fakes engagement.
- No dark patterns: no fake urgency, no impossible-to-cancel flows, no
  pretend discounts.
- Privacy claims must stay literally true: no analytics means **no
  analytics**, forever, in every product.

The compounding loop: each product adds store-search surface area, each
review adds ranking, each engine (like SnipKey's expander) gets reused, and
the founder's total time stays ~1 hour per product plus ~1 hour per week.
