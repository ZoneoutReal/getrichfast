# TypeVault — Chrome Web Store Listing Kit

Copy-paste everything below into the Chrome Web Store Developer Dashboard.

---

## Store listing

**Name (max 45 chars):**
```
TypeVault — Draft & Version Recovery
```

**Summary (max 132 chars):**
```
Never lose what you typed. TypeVault auto-saves versioned drafts of every field, on-device. Scrub the timeline, diff, restore.
```

**Category:** Productivity → Tools
**Language:** English

**Description:**
```
Ever spent ten minutes writing the perfect reply, then watched a form clear itself, a tab crash, or a misclick wipe it all? TypeVault makes that impossible.

TypeVault quietly saves versioned snapshots of everything you type — emails, forms, comment boxes, rich editors, support desks, CMS fields — the moment you stop typing. When something goes wrong, open TypeVault and put any version back with one click.

🗂️ AUTOMATIC VERSION HISTORY
Every text field, textarea and rich editor gets its own timeline. TypeVault saves a new snapshot whenever the content meaningfully changes — so you can go back not just to your last draft, but to the paragraph you deleted twenty minutes ago.

⏪ REWIND & SEE WHAT CHANGED
Scrub a field's full timeline with timestamps, and get a word-level diff between any two versions — additions in green, removals struck through. Find the exact wording you had before and restore it into the live field, or copy it out.

🌐 EVERY SITE, ONE VAULT
The manager gathers your drafts across every site into one searchable, per-site history. Search by field, site or text. Tune how many versions to keep, pause capturing on sensitive sites (or everywhere), and export everything as JSON.

🔒 100% LOCAL & PRIVATE
Everything stays in your browser's local storage. No account, no cloud, no servers, no analytics. Your drafts are never uploaded anywhere. Password fields are always ignored, and very short scraps are skipped.

💎 PRO — PAY ONCE, OWN IT FOREVER ($12)
• Full cross-site history — every draft on every site, forever
• Unlimited version timeline and diff
• Unlimited retention
• Export your whole vault to JSON
No subscription. Every future update included. The free tier still recovers the last 24 hours and up to 5 versions per field on the current site.

Perfect for: writing long emails, job applications, forum and Reddit posts, GitHub issues & PRs, Notion/CMS editing, support replies, bug reports, and anywhere a browser form eats your work.
```

**Screenshots (1280×800), in order:**
1. `screenshots/1-hero.png`
2. `screenshots/2-timeline.png`
3. `screenshots/3-manager.png`
4. `screenshots/4-pricing.png`

**Small promo tile (440×280):** `screenshots/promo-small-440x280.jpg`
**Marquee promo tile (1400×560):** `screenshots/promo-marquee-1400x560.jpg`

**Homepage URL:** `https://zoneoutreal.github.io/getrichfast/typevault/`
**Support URL:** `https://github.com/ZoneoutReal/getrichfast/issues`

**Additional fields:** Official URL: None · Mature content: off

---

## Privacy tab

**Single purpose description:**
```
TypeVault automatically saves versioned snapshots of the text a user types into form fields, on the user's own device, so the user can recover a lost or overwritten draft and restore any earlier version.
```

**Permission justifications:**

- `storage`:
```
Stores the user's saved drafts and their version history, plus settings (retention, paused sites), locally in the browser. This is the entire product — the saved versions the user restores from. Nothing is ever transmitted.
```

- Content script on `<all_urls>`:
```
TypeVault must observe typing in text inputs, textareas and contenteditable fields on the pages the user actually writes on, which can be any site. The content script captures only what the user types into those fields, on-device, to enable recovery; it never transmits anything, and it explicitly ignores password fields. It runs at document_idle and only reads the fields the user edits.
```

- Host permission `https://extensionpay.com/*` (content script):
```
Required by the ExtensionPay payment library solely to complete the optional one-time Pro purchase flow.
```

**Remote code:** No, I am not using remote code.

**Data usage disclosures:** check NONE of the data types. Certify all three disclosures. TypeVault collects and transmits nothing — all data stays in local browser storage.

**Privacy policy URL:** `https://zoneoutreal.github.io/getrichfast/typevault/privacy.html`

---

## Distribution tab

- Visibility: Public · Regions: All · Pricing: Free (Pro handled in-extension via ExtensionPay/Stripe)

---

## After approval

1. Copy the live store URL.
2. Replace the `ADD_TO_CHROME` href in `docs/typevault/index.html`.
3. Reply to reviews weekly; requests feed the roadmap.

## Roadmap candidates (post-traction)

- Optional encrypted local vault (passphrase)
- Pin / star important drafts so they never age out
- Diff between any two arbitrary versions (not just adjacent)
- Keyboard shortcut to open the current field's timeline
- Firefox/Edge ports
