# getrichfast

A portfolio of small, paid, privacy-first browser tools — built almost
entirely by Claude Code, distributed by marketplaces, operated with zero
human interaction in the sales loop.

**Start here:**

| Doc | What it is |
|---|---|
| [RESEARCH.md](RESEARCH.md) | The evidence: why "fast automated money" strategies measurably lose, and why shipping products is the lane with positive expected value |
| [PLAYBOOK.md](PLAYBOOK.md) | The operating system: weekly ship loop, niche checklist, pricing, kill/feed rules |
| [FOUNDER_SETUP.md](FOUNDER_SETUP.md) | The ~60 minutes of one-time human steps (accounts, uploads) |
| [SCOUT_RUNBOOK.md](SCOUT_RUNBOOK.md) | The weekly automation: niche scout + scoreboard autopilot that draft build/kill/feed issues |

## Products

| # | Product | Category | Pro | Tests |
|---|---------|----------|-----|-------|
| 1 | [SnipKey](products/snipkey/) | Text expander & snippets | $15 | 14 |
| 2 | [SnipShot](products/snipshot/) | Screenshot & annotate | $15 | 29 |
| 3 | [MockFill](products/mockfill/) | Test data form filler | $15 | 57 |
| 4 | [CopyMark](products/copymark/) | Copy as Markdown | $9 | 51 |
| 5 | [JSONPeek](products/jsonpeek/) | JSON viewer & formatter | $12 | 44 |
| 6 | [FocusFence](products/focusfence/) | Site blocker & focus | $15 | 58 |
| 7 | [PagePulse](products/pagepulse/) | Auto refresh & monitor | $9 | 42 |
| 8 | [TypeVault](products/typevault/) | Draft & version recovery | $12 | 58 |
| 9 | [Recall](products/recall/) | Search history by content | $15 | 73 |
| 10 | [ClipStack](products/clipstack/) | Clipboard history | $9 | 58 |

### 1. SnipKey — Text Expander & Snippets (`products/snipkey/`)

Chrome extension (Manifest V3). Type `/addr` and it expands into your full
address, instantly, anywhere on the web. 100% local, no account, no
subscription — free for 10 snippets, $15 one-time for unlimited.

```bash
cd products/snipkey
npm install
npm test        # 14 e2e tests: real keystrokes against the real engine
npm run icons   # regenerate extension icons
npm run shots   # regenerate Chrome Web Store screenshots
npm run build   # produce the uploadable zip in dist/
```

- `extension/` — the extension itself (vanilla JS, no build step, no deps)
- `tests/` — Playwright e2e harness with a chrome.* stub
- `store/` — listing copy kit + generated 1280×800 screenshots
- `scripts/` — icon/screenshot generators, zip packager

### 2. SnipShot — Screenshot & Annotate (`products/snipshot/`)

Chrome extension (Manifest V3). One click captures the page and opens a
local annotation editor — arrows, boxes, highlights, text, crop, undo, plus
Pro blur/redaction and numbered step badges. Images never leave the device.
Free core, $15 one-time Pro.

```bash
cd products/snipshot
npm install
npm test        # 29 tests: canvas editor logic + real-extension smoke suite
npm run icons && npm run shots && npm run tiles
npm run build   # produce the uploadable zip in dist/
```

### 3. MockFill — Test Data Form Filler (`products/mockfill/`)

Chrome extension (Manifest V3), built for devs & QA. One keystroke
(Alt+Shift+F) fills every field on the page with realistic fake data —
smart detection via autocomplete/names/labels, framework-safe native-setter
events, safe-by-design values (reserved example domains, 555-01xx phones).
Free unlimited filling; $15 one-time Pro adds custom field rules, official
test cards, and deterministic seed mode.

```bash
cd products/mockfill
npm install
npm test        # 57 tests: engine suite + real-extension smoke suite
npm run icons && npm run shots && npm run tiles
npm run build   # produce the uploadable zip in dist/
```

### 4. CopyMark — Copy as Markdown (`products/copymark/`)

Chrome extension (Manifest V3). Select anything and Alt+Shift+M copies it as
clean Markdown — headings, nested lists, links (absolutized), language-tagged
code fences, quotes, task lists, escaping. Free: selection + page-link
copying; $9 one-time Pro adds GFM tables, full-page clips with front-matter
templates (Obsidian preset), and all-tabs link lists.

```bash
cd products/copymark
npm install
npm test        # 51 tests: serializer suite + real-extension smoke suite
npm run icons && npm run shots && npm run tiles
npm run build   # produce the uploadable zip in dist/
```

### 5. JSONPeek — JSON Viewer & Formatter (`products/jsonpeek/`)

Chrome extension (Manifest V3). One click on any JSON tab (or paste/drop)
opens a fast lazy-rendered collapsible tree with search-that-expands, exact
path breadcrumbs, raw view, copy/download. Free up to 2 MB; $12 one-time Pro
removes the limit and adds JSONPath queries, CSV export, structural diff.

```bash
cd products/jsonpeek
npm install
npm test        # 44 tests: viewer/engine suite + real-extension smoke suite
npm run icons && npm run shots && npm run tiles
npm run build   # produce the uploadable zip in dist/
```

### 6. FocusFence — Site Blocker & Focus Mode (`products/focusfence/`)

Chrome extension (Manifest V3). Block distracting sites via Chrome's own
declarativeNetRequest engine — focus sessions with badge countdown, one-click
"block this site", wildcard subdomains, calm local fence page. Free fences 7
sites; $15 one-time Pro adds unlimited sites, weekly schedules (overnight
spans included), strict mode, path patterns, custom block message.

```bash
cd products/focusfence
npm install
npm test        # 58 tests: rules/schedule engine + real-blocking smoke suite
npm run icons && npm run shots && npm run tiles
npm run build   # produce the uploadable zip in dist/
```

### 7. PagePulse — Auto Refresh & Page Monitor (`products/pagepulse/`)

Chrome extension (Manifest V3). Per-tab auto refresh (presets 10s–30m) with
a live countdown badge, driven by a service-worker timer chain with an alarm
safety net; jobs survive restarts and clean up on tab close. $9 one-time Pro
adds custom second-level intervals, ±20% jitter, and change/keyword alerts
with per-site opt-in permissions.

```bash
cd products/pagepulse
npm install
npm test        # 42 tests: timing engine + real observed-reloads smoke suite
npm run icons && npm run shots && npm run tiles
npm run build   # produce the uploadable zip in dist/
```

### 8. TypeVault — Draft & Version Recovery (`products/typevault/`)

Chrome extension (Manifest V3). Content script snapshots a version history of
everything you type into any field; the popup timeline scrubs versions with a
word-level diff and one-click restore back into the live field. Passwords are
never captured; everything is on-device. Free: 24h / 5 versions per field; $12
one-time Pro adds full cross-site history, unlimited timeline + diff, and JSON
export.

```bash
cd products/typevault
npm install
npm test        # 58 tests: diff/versioning logic + real-extension smoke suite
npm run icons && npm run shots && npm run tiles
npm run build   # produce the uploadable zip in dist/
```

### 9. Recall — Search History by Content (`products/recall/`)

Chrome extension (Manifest V3). A content script indexes the readable text of
pages you visit into a local inverted index, so you can search your own browsing
memory by page content — not just title/URL like Chrome history. 100% on-device,
zero network (proven by test). Free: last 14 days / 2000 pages; $15 one-time Pro
adds unlimited history, site/date filters, and JSON export.

```bash
cd products/recall
npm install
npm test        # 73 tests: index/search engine + real-extension smoke suite
npm run icons && npm run shots && npm run tiles
npm run build   # produce the uploadable zip in dist/
```

### 10. ClipStack — Clipboard History (`products/clipstack/`)

Chrome extension (Manifest V3). Captures copy/cut events into a searchable,
pinnable clipboard history stored entirely locally — paste from many copies ago,
click to copy back. Free text history capped at 50; $9 one-time Pro adds
unlimited history, pinned collections, image clips, and JSON export.

```bash
cd products/clipstack
npm install
npm test        # 58 tests: history-store logic + real-extension smoke suite
npm run icons && npm run shots && npm run tiles
npm run build   # produce the uploadable zip in dist/
```

All products share the same factory: Playwright test harnesses, generated
store assets, listing kits, and a `release/` folder carrying the current
store-upload zip.

## Factory operations (`scripts/`)

The weekly decisions run on deterministic engines so hope never overrides the
math — see [SCOUT_RUNBOOK.md](SCOUT_RUNBOOK.md) for the operator flow.

```bash
npm run scout          # score candidate niches vs the PLAYBOOK checklist → build issue
npm run scoreboard     # apply kill/feed rules to weekly stats → feed/iterate/archive issues
npm run check          # Chrome Web Store submission-readiness validator
npm test               # 44 engine tests (scout + scoreboard)
```

- `scripts/lib/` — the pure scoring engines (`scout.mjs`, `scoreboard.mjs`)
- `scripts/data/*.example.json` — the input schemas, filled with worked examples
- `scripts/tests/` — the engine test suites
- Generated issue bodies land in `scout-out/` (gitignored), ready to file via
  the GitHub MCP or paste by hand.

Site: `docs/` (GitHub Pages) — portfolio page, per-product landing pages and
privacy policies. Support: GitHub issue templates in `.github/ISSUE_TEMPLATE/`.
