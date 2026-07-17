# Recall — Chrome Web Store Listing Kit

Copy-paste everything below into the Chrome Web Store Developer Dashboard.

---

## Store listing

**Name (max 45 chars):**
```
Recall — Search History by Content
```

**Summary (max 132 chars):**
```
Search your browsing history by the words on the page, not just titles & URLs. 100% local — your pages never leave the device.
```

**Category:** Productivity → Tools
**Language:** English

**Description:**
```
Ever tried to find a page you KNOW you read — "that article about quantum teleportation" — and Chrome's history came up empty because the word you remember was in the body, not the title? Recall fixes exactly that.

🔍 SEARCH WHAT WAS ON THE PAGE
Chrome history only matches page titles and URLs. Recall quietly builds a full-text index of the pages you actually read, so you can search their content later — any word or phrase from the body — and jump straight back.

🧠 IT REMEMBERS AS YOU BROWSE
Open a page, keep reading. Recall extracts the readable text (title, description, body — minus the nav and clutter) and folds it into a private on-device index. No setup, no clicking "save".

⚡ RANKED RESULTS WITH SNIPPETS
Type a query in the toolbar popup and get ranked hits — each with the page title, site, when you visited, and a snippet with your terms highlighted. Click to reopen. Multi-word queries rank pages that match more of your words first.

🔒 100% LOCAL — AND WE MEAN IT
Everything stays in your browser's local storage. No servers, no account, no analytics, no network calls of any kind. Your reading history is nobody's business but yours. Sensitive pages (logins, banking, checkout) are skipped automatically, and you can pause indexing or ignore any site at any time.

🗂️ A FULL-SEARCH PAGE
The options page is a manager for your reading memory: browse recently indexed pages, see what's indexed, keep a per-site ignore list, and clear everything in one click.

💎 PRO — PAY ONCE, OWN IT FOREVER ($15)
• Unlimited history & page count (free keeps the last 14 days / 2,000 pages)
• Filter results by site and by date range
• Export your entire index as JSON
No subscription. Every future update included.

Perfect for: researchers, students, developers, writers, and anyone who reads a lot and thinks "where did I see that?"
```

**Screenshots (1280×800), in order:**
1. `screenshots/1-hero.png`
2. `screenshots/2-aha.png`
3. `screenshots/3-manager.png`
4. `screenshots/4-pricing.png`

**Small promo tile (440×280):** `screenshots/promo-small-440x280.jpg`
**Marquee promo tile (1400×560):** `screenshots/promo-marquee-1400x560.jpg`

**Homepage URL:** `https://zoneoutreal.github.io/getrichfast/recall/`
**Support URL:** `https://github.com/ZoneoutReal/getrichfast/issues`

**Additional fields:** Official URL: None · Mature content: off

---

## Privacy tab

**Single purpose description:**
```
Recall builds a local, on-device full-text index of the pages the user reads so they can later search their own browsing history by page content (not just title or URL). All data stays on the device; nothing is transmitted.
```

**Permission justifications:**

- `storage`:
```
Stores the local search index (the extracted page text, tokens, and page metadata) and the user's settings in the browser's local storage so history search works across sessions. Nothing is transmitted anywhere.
```

- Content script on `<all_urls>` (host access):
```
The content script reads the readable text of pages the user visits for the SOLE purpose of building a local, on-device search index. The page text is used only to update that local index and is never sent off the device. http(s) pages only; pages that look sensitive (login/banking/checkout) are skipped, and the user can pause indexing or exclude any site.
```

- Host permission `https://extensionpay.com/*` (content script):
```
Required by the ExtensionPay payment library solely to complete the optional one-time Pro purchase flow.
```

**Remote code:** No, I am not using remote code.

**Data usage disclosures:** check NONE of the data types. Certify all three disclosures (data is not sold, not used for unrelated purposes, not used for creditworthiness). Recall collects and transmits nothing — the index is local-only.

**Privacy policy URL:** `https://zoneoutreal.github.io/getrichfast/recall/privacy.html`

---

## Distribution tab

- Visibility: Public · Regions: All · Pricing: Free (Pro handled in-extension via ExtensionPay/Stripe)

---

## After approval

1. Copy the live store URL.
2. Replace the `ADD_TO_CHROME` href in `docs/recall/index.html`.
3. Reply to reviews weekly; requests feed the roadmap.

## Roadmap candidates (post-traction)

- Fuzzy / typo-tolerant matching and stemming
- "On this day" — resurface what you read a week/month ago
- Keyboard-launcher (omnibox `re` keyword) for instant content search
- Optional encrypted local backup / import
- Firefox/Edge ports
