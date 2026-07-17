# JSONPeek — Chrome Web Store Listing Kit

Copy-paste everything below into the Chrome Web Store Developer Dashboard.

---

## Store listing

**Name (max 45 chars):**
```
JSONPeek — JSON Viewer & Formatter
```

**Summary (max 132 chars):**
```
Fast JSON viewer: collapsible tree, search, paths, big files. Pro adds queries, CSV export & diff. 100% local, pay once.
```

**Category:** Developer Tools
**Language:** English

**Description:**
```
Stop squinting at minified API responses.

Click the JSONPeek icon on any JSON tab (or press Alt+Shift+J, or paste/drop a file) and get a fast, readable, collapsible tree — with search that actually finds things and the exact path to any node.

🌳 A TREE THAT KEEPS UP
• Collapsible nodes with item/key counts and type-colored values
• Lazy rendering — deep, wide payloads stay smooth
• Click any node to get its exact path ($.users[2].email), copy it in one click
• Raw view with pretty-printed output, copy & download

🔎 SEARCH THAT EXPANDS TO THE HIT
Type a key or value fragment and JSONPeek unfolds the tree to every match and highlights it. No more expanding nodes one by one.

🧭 GRAB FROM ANY TAB
On a JSON API tab, one click loads it instantly. On restricted pages, the paste/drop UI opens instead — nothing breaks.

🔒 100% LOCAL & PRIVATE
Your payloads never leave the tab. No servers, no account, no analytics. JSONPeek reads a page only when you explicitly invoke it there (activeTab).

💎 PRO — PAY ONCE, OWN IT FOREVER ($12)
• No file size limit (free handles up to 2 MB)
• JSONPath queries: $.users[*].name, $..email, negative indexes
• CSV export — flatten arrays of objects for spreadsheets
• Structural diff — paste two payloads, see every added/removed/changed path
The subscription incumbent charges $4.99/month for big-file support. JSONPeek Pro is $12 once — less than three months of that, forever.

Perfect for: API debugging, webhook payloads, config archaeology, staging-vs-prod comparisons, log spelunking — every developer's daily JSON.
```

**Screenshots (1280×800), in order:**
1. `screenshots/1-hero.png`
2. `screenshots/2-query.png`
3. `screenshots/3-diff.png`
4. `screenshots/4-pricing.png`

**Small promo tile (440×280):** `screenshots/promo-small-440x280.jpg`
**Marquee promo tile (1400×560):** `screenshots/promo-marquee-1400x560.jpg`

**Homepage URL:** `https://zoneoutreal.github.io/getrichfast/jsonpeek/`
**Support URL:** `https://github.com/ZoneoutReal/getrichfast/issues`

**Additional fields:** Official URL: None · Mature content: off

---

## Privacy tab

**Single purpose description:**
```
JSONPeek displays JSON (from the user's current tab, pasted text, or a local file) as a readable, searchable tree, entirely locally.
```

**Permission justifications:**

- `activeTab`:
```
Loading the JSON from the current tab requires reading that page's text, granted only when the user explicitly clicks the JSONPeek icon or presses its keyboard shortcut. The extension has no access to any page otherwise.
```

- `scripting`:
```
Used together with activeTab to read the invoked tab's JSON text so it can be displayed in the local viewer. No code is ever injected without an explicit user action.
```

- `storage`:
```
Briefly holds the grabbed JSON text locally so it can be handed from the background worker to the viewer tab, plus user preferences. Nothing is transmitted anywhere.
```

- Host permission `https://extensionpay.com/*`:
```
Required by the ExtensionPay payment library solely to complete the optional one-time Pro purchase flow.
```

**Remote code:** No, I am not using remote code.

**Data usage disclosures:** check NONE of the data types. Certify all three disclosures.

**Privacy policy URL:** `https://zoneoutreal.github.io/getrichfast/jsonpeek/privacy.html`

---

## Distribution tab

- Visibility: Public · Regions: All · Pricing: Free (Pro handled in-extension via ExtensionPay/Stripe)

---

## After approval

1. Copy the live store URL.
2. Replace the `ADD_TO_CHROME` href in `docs/jsonpeek/index.html`.
3. Reply to reviews weekly; requests feed the roadmap.

## Roadmap candidates (post-traction)

- Auto-detect JSON tabs (optional per-site content script, opt-in)
- JSON5 / NDJSON support
- Saved queries
- Firefox/Edge ports
