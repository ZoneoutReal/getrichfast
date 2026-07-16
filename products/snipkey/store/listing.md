# SnipKey — Chrome Web Store Listing Kit

Copy-paste everything below into the Chrome Web Store Developer Dashboard.
Fields map 1:1 to the dashboard's "Store listing", "Privacy" and
"Distribution" tabs.

---

## Store listing

**Name (max 45 chars):**
```
SnipKey — Text Expander & Snippets
```

**Summary (max 132 chars):**
```
Create snippets that expand anywhere you type — emails, forms, CRMs. 100% local and private. Pay once, no subscription.
```

**Category:** Productivity → Workflow & Planning
**Language:** English

**Description:**
```
Stop retyping the same sentences.

SnipKey turns short commands like /addr, /sig or /ty into full text the instant you type them — your address, your sign-off, your canned replies, anywhere on the web: Gmail, CRMs, support desks, forms, docs.

⚡ INSTANT EXPANSION
Type /addr and it becomes your full address the moment you finish the shortcut. No popup, no clicking, no interruption. Prefer a confirmation? Switch to expand-on-space in settings.

🌍 WORKS EVERYWHERE YOU TYPE
Plain inputs, textareas, and rich editors (contenteditable) — including Gmail compose. If you can type in it, SnipKey expands in it. Password fields are always ignored.

🔒 100% LOCAL & PRIVATE
Your snippets never leave your device. No account. No cloud. No analytics. No tracking. SnipKey has no servers — there is nowhere for your data to go.

📅 DYNAMIC PLACEHOLDERS
Make templates smart:
• {date} — today's date
• {date+7} — a week from now (any offset works)
• {time} / {datetime} — current time
• {cursor} — exactly where your caret lands after expansion

🎛️ YOUR RULES
Pick your trigger prefix (/, ;, #, \, :), expand instantly or after a space, pause everything with one switch, and see local usage stats for every snippet.

📦 OWN YOUR DATA
One-click JSON export and import. Your snippet library is a file you control.

💰 HONEST PRICING
Free: 10 snippets, every feature included.
Pro: $15 one-time — unlimited snippets, all future updates. No subscription, ever.

Perfect for customer support, sales, recruiting, freelancing, QA, ops — anyone who types the same thing twice.
```

**Screenshots (1280×800), in order:**
1. `screenshots/1-hero.png`
2. `screenshots/2-manager.png`
3. `screenshots/3-everywhere.png`
4. `screenshots/4-pricing.png`

**Homepage URL:** `https://zoneoutreal.github.io/getrichfast/snipkey/`
**Support URL:** `https://github.com/ZoneoutReal/getrichfast/issues`

---

## Privacy tab

**Single purpose description:**
```
SnipKey replaces user-defined text shortcuts with their saved snippet text as the user types in text fields.
```

**Permission justifications:**

- `storage`:
```
Stores the user's snippets, settings, and local usage counts on their device. No data is transmitted anywhere.
```

- Host permission `<all_urls>` (content script):
```
Text expansion must happen wherever the user types, so the content script runs on pages to detect a typed shortcut in the focused text field and replace it locally with the user's snippet. It reads only the focused field's text, ignores password fields, and transmits nothing off-device.
```

- Host permission `https://extensionpay.com/*`:
```
Required by the ExtensionPay payment library solely to complete the optional one-time Pro purchase flow.
```

**Remote code:** No, I am not using remote code.

**Data usage disclosures:** check NONE of the data types (SnipKey collects no
data). Certify the disclosures.

**Privacy policy URL:** `https://zoneoutreal.github.io/getrichfast/snipkey/privacy.html`

---

## Distribution tab

- Visibility: Public
- Regions: All regions
- Pricing: Free (the Pro upgrade is handled in-extension via ExtensionPay/Stripe)

---

## After approval

1. Copy the live store URL (`https://chromewebstore.google.com/detail/…`).
2. Replace the `#pricing` href on the landing page's "Add to Chrome" button
   (`docs/snipkey/index.html`, marked with `ADD_TO_CHROME`).
3. Reply to reviews weekly; feature requests feed the roadmap.

## Roadmap candidates (post-traction)

- Snippet folders + drag ordering (Pro)
- chrome.storage.sync option for multi-device (still no servers)
- Firefox / Edge ports (same codebase, MV3-compatible)
- Gentle review prompt after N expansions (respectful, dismissible forever)
