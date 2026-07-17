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

## Products

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

Both products share the same factory: Playwright test harnesses, generated
store assets, listing kits, and a `release/` folder carrying the current
store-upload zip.

Site: `docs/` (GitHub Pages) — portfolio page, per-product landing pages and
privacy policies. Support: GitHub issue templates in `.github/ISSUE_TEMPLATE/`.
