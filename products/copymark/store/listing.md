# CopyMark — Chrome Web Store Listing Kit

Copy-paste everything below into the Chrome Web Store Developer Dashboard.

---

## Store listing

**Name (max 45 chars):**
```
CopyMark — Copy as Markdown
```

**Summary (max 132 chars):**
```
Copy any selection or page as clean Markdown — headings, lists, links, code, tables. Perfect for Obsidian & Notion. 100% local.
```

**Category:** Productivity → Tools
**Language:** English

**Description:**
```
Paste from the web into Obsidian, Notion, or GitHub — and get clean Markdown instead of a formatting mess.

Select anything on a page and hit Alt+Shift+M (or right-click → "Copy selection as Markdown"). CopyMark converts what you selected into tidy, readable Markdown and puts it on your clipboard.

✂️ WHAT IT GETS RIGHT
• Headings → #, ## at the correct levels
• Bold, italic, strikethrough, inline code
• Links resolved to absolute URLs
• Nested bullet and numbered lists (start numbers respected)
• Code blocks with language-tagged fences (```bash …)
• Blockquotes, task lists, images, horizontal rules
• Special characters escaped so your Markdown renders exactly like the page read

🔗 PAGE LINKS TOO
"Copy page as Markdown link" gives you [Page title](url) in one click — the fastest way to cite a source in your notes.

🔒 100% LOCAL & PRIVATE
The conversion happens inside your browser. No account, no servers, no analytics — pages and clippings never leave your machine. CopyMark only touches a page when you invoke it there (Chrome's activeTab permission).

💎 PRO — PAY ONCE, OWN IT FOREVER ($9)
• Tables → real GFM pipe tables
• Full-page clip: convert the whole article, with a front-matter template ({{title}}, {{url}}, {{date}}) and a one-click Obsidian preset
• Copy all open tabs as a Markdown link list — session notes in one keystroke
No subscription. Every future update included.

Perfect for: Obsidian & Notion users, PKM builders, technical writers, developers writing docs, researchers collecting sources, anyone tired of paste-then-reformat.
```

**Screenshots (1280×800), in order:**
1. `screenshots/1-hero.png`
2. `screenshots/2-obsidian.png`
3. `screenshots/3-popup.png`
4. `screenshots/4-pricing.png`

**Small promo tile (440×280):** `screenshots/promo-small-440x280.jpg`
**Marquee promo tile (1400×560):** `screenshots/promo-marquee-1400x560.jpg`

**Homepage URL:** `https://zoneoutreal.github.io/getrichfast/copymark/`
**Support URL:** `https://github.com/ZoneoutReal/getrichfast/issues`

**Additional fields:** Official URL: None · Mature content: off

---

## Privacy tab

**Single purpose description:**
```
CopyMark converts the user's current selection or page into Markdown text and copies it to the clipboard when the user explicitly requests it.
```

**Permission justifications:**

- `activeTab`:
```
Reading the selection/page to convert it to Markdown requires access to the current page, granted only when the user explicitly invokes CopyMark via its toolbar button, keyboard shortcut, or context menu. The extension has no access to any page otherwise.
```

- `scripting`:
```
Used together with activeTab to run the local Markdown converter on the page the user asked to copy from. No code is ever injected without an explicit user action.
```

- `storage`:
```
Stores the user's Markdown style settings (bullet character, code fence, image handling, front-matter template) locally. Nothing is transmitted anywhere.
```

- `contextMenus`:
```
Adds the "Copy selection/page as Markdown" entries to the right-click menu as one of the ways to invoke the extension.
```

- `clipboardWrite`:
```
Writes the generated Markdown to the clipboard — that is the product's entire output path.
```

- `tabs`:
```
Used solely by the optional "Copy all tabs as Markdown link list" feature to read the titles and URLs of the user's open tabs at the moment they click it. No tab information is stored or transmitted.
```

- Host permission `https://extensionpay.com/*`:
```
Required by the ExtensionPay payment library solely to complete the optional one-time Pro purchase flow.
```

**Remote code:** No, I am not using remote code.

**Data usage disclosures:** check NONE of the data types. Certify all three disclosures.

**Privacy policy URL:** `https://zoneoutreal.github.io/getrichfast/copymark/privacy.html`

---

## Distribution tab

- Visibility: Public · Regions: All · Pricing: Free (Pro handled in-extension via ExtensionPay/Stripe)

---

## After approval

1. Copy the live store URL.
2. Replace the `ADD_TO_CHROME` href in `docs/copymark/index.html`.
3. Reply to reviews weekly; requests feed the roadmap.

## Roadmap candidates (post-traction)

- Reference-style link output option
- Readability-style article extraction for cleaner full-page clips
- Direct "download as .md file" action
- Firefox/Edge ports
