# MockFill — Chrome Web Store Listing Kit

Copy-paste everything below into the Chrome Web Store Developer Dashboard.

---

## Store listing

**Name (max 45 chars):**
```
MockFill — Test Data Form Filler
```

**Summary (max 132 chars):**
```
Fill any form with realistic fake data in one keystroke. Built for devs & QA. 100% local, no account. Pay once, no subscription.
```

**Category:** Developer Tools
**Language:** English

**Description:**
```
Stop typing "asdf asdf test@test.com" into your own signup form for the hundredth time.

MockFill fills every field on the page with realistic fake data in one keystroke — names, emails, phones, addresses, dates, selects, checkboxes, radio groups. Built for developers and QA engineers who test forms all day.

⚡ ONE KEYSTROKE
Alt+Shift+F, the toolbar button, or right-click → "Fill forms with fake data". Instant, on any page you invoke it on.

🧠 SMART FIELD DETECTION
MockFill reads autocomplete attributes, field names, ids, placeholders and labels — snake_case, camelCase, whatever your codebase uses — and generates the right kind of data for each field. Emails land on reserved example domains, phone numbers use the fictional 555-01xx block: your test data can never accidentally reach a real person.

⚛️ FRAMEWORK-SAFE
Values are set through native setters with real input/change events, so React, Vue and Angular forms see the data exactly as if you typed it.

🔒 100% LOCAL & PRIVATE
No account, no analytics, no servers. MockFill only touches a page when you explicitly invoke it (Chrome's activeTab permission) and nothing ever leaves your machine.

💎 PRO — PAY ONCE, OWN IT FOREVER ($15)
• Custom field rules: match your app's field names with a regex and fill exactly what it expects — a fixed value, a chosen preset, or skip the field entirely.
• Official test credit cards (4242 4242 4242 4242 and friends) — Luhn-valid, never chargeable, straight from the payment processors' docs.
• Deterministic seed mode: same seed, same data, every run — for reproducible bug reports.
The incumbent tool charges $3.99/month for custom fields. MockFill Pro is $15 once, forever.

Perfect for: testing signup flows, checkout forms, admin panels, CRM entry screens, QA regression runs, demo environments, staging data entry.

MockFill fills forms only when you ask it to. It never auto-fills, never submits forms, and never touches pages on its own.
```

**Screenshots (1280×800), in order:**
1. `screenshots/1-hero.png`
2. `screenshots/2-rules.png`
3. `screenshots/3-fill.png`
4. `screenshots/4-pricing.png`

**Small promo tile (440×280):** `screenshots/promo-small-440x280.jpg`
**Marquee promo tile (1400×560):** `screenshots/promo-marquee-1400x560.jpg`

**Homepage URL:** `https://zoneoutreal.github.io/getrichfast/mockfill/`
**Support URL:** `https://github.com/ZoneoutReal/getrichfast/issues`

**Additional fields:** Official URL: None · Mature content: off

---

## Privacy tab

**Single purpose description:**
```
MockFill fills the form fields on the user's current page with locally generated fake test data when the user explicitly requests it.
```

**Permission justifications:**

- `activeTab`:
```
Filling forms requires access to the current page's DOM, granted only when the user explicitly invokes MockFill via its toolbar button, keyboard shortcut, or context menu entry. The extension has no access to any page otherwise.
```

- `scripting`:
```
Used together with activeTab to inject the local fill routine into the page the user asked to fill. No code is ever injected without an explicit user action.
```

- `storage`:
```
Stores the user's settings (email domain, custom field rules, seed) locally. Nothing is transmitted anywhere.
```

- `contextMenus`:
```
Adds the "Fill forms with fake data" entry to the right-click menu as one of the three ways to invoke the extension.
```

- Host permission `https://extensionpay.com/*`:
```
Required by the ExtensionPay payment library solely to complete the optional one-time Pro purchase flow.
```

**Remote code:** No, I am not using remote code.

**Data usage disclosures:** check NONE of the data types. Certify all three disclosures.

**Privacy policy URL:** `https://zoneoutreal.github.io/getrichfast/mockfill/privacy.html`

---

## Distribution tab

- Visibility: Public · Regions: All · Pricing: Free (Pro handled in-extension via ExtensionPay/Stripe)

---

## After approval

1. Copy the live store URL.
2. Replace the `ADD_TO_CHROME` href in `docs/mockfill/index.html`.
3. Reply to reviews weekly; requests feed the roadmap.

## Roadmap candidates (post-traction)

- Locale packs (UK/DE/FR addresses & phone formats)
- Named data profiles (switch between rule sets per project)
- Fill-on-load option for dev environments (opt-in, per-origin)
- Firefox/Edge ports
