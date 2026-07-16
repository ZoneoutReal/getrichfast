# SnipShot — Chrome Web Store Listing Kit

Copy-paste everything below into the Chrome Web Store Developer Dashboard.

---

## Store listing

**Name (max 45 chars):**
```
SnipShot — Screenshot & Annotate
```

**Summary (max 132 chars):**
```
Capture the page, mark it up — arrows, boxes, text, blur — then copy or download. 100% local and private. Pay once, no subscription.
```

**Category:** Productivity → Tools
**Language:** English

**Description:**
```
Take a screenshot, say what you mean, ship it — all in a few seconds.

SnipShot captures the page you're on and opens a fast, clean annotation editor. Draw an arrow, box the bug, highlight the number, type a note — then copy to clipboard or download a PNG. Done.

⚡ FAST BY DESIGN
One click (or Alt+Shift+S) to capture. Keyboard shortcuts for every tool. Undo/redo. Crop. No accounts, no "sign in to continue", no watermarks.

🖊️ EVERYTHING YOU NEED TO MAKE A POINT
• Arrows that actually look good
• Boxes & highlights to focus attention
• Text with readable outlines on any background
• Crop to just the part that matters

🔒 100% LOCAL & PRIVATE
Your screenshots never leave your device. No upload, no cloud, no analytics, no tracking. SnipShot has no servers — there is nowhere for your images to go.

💎 PRO — PAY ONCE, OWN IT FOREVER ($15)
• Blur / pixelate — redact emails, revenue, tokens. The redaction is baked into the pixels, not layered on top.
• Numbered step badges — turn any screenshot into a 1-2-3 tutorial.
• Ellipses and custom colors.
No subscription. Every future update included.

Perfect for bug reports, documentation, support replies, tutorials, code reviews, design feedback — anyone who screenshots for a living.

Note: Chrome doesn't allow extensions to capture special pages (chrome:// pages, the Web Store itself). Everything else is fair game.
```

**Screenshots (1280×800), in order:**
1. `screenshots/1-hero.png`
2. `screenshots/2-redact.png`
3. `screenshots/3-editor.png`
4. `screenshots/4-pricing.png`

**Small promo tile (440×280):** `screenshots/promo-small-440x280.jpg`
**Marquee promo tile (1400×560):** `screenshots/promo-marquee-1400x560.jpg`

**Homepage URL:** `https://zoneoutreal.github.io/getrichfast/snipshot/`
**Support URL:** `https://github.com/ZoneoutReal/getrichfast/issues`

**Additional fields:** Official URL: None · Mature content: off

---

## Privacy tab

**Single purpose description:**
```
SnipShot captures a screenshot of the user's current tab when they request it and lets them annotate and export the image locally.
```

**Permission justifications:**

- `activeTab`:
```
Capturing the visible tab requires activeTab, granted only when the user explicitly clicks the SnipShot icon or presses its keyboard shortcut. The extension has no access to any page otherwise.
```

- `storage`:
```
Briefly stores the captured image locally so it can be handed from the background worker to the editor tab, plus user preferences. Nothing is transmitted anywhere.
```

- `clipboardWrite`:
```
Lets the user copy their finished, annotated screenshot to the clipboard with the "Copy" button.
```

- Host permission `https://extensionpay.com/*`:
```
Required by the ExtensionPay payment library solely to complete the optional one-time Pro purchase flow.
```

**Remote code:** No, I am not using remote code.

**Data usage disclosures:** check NONE of the data types. Certify all three disclosures.

**Privacy policy URL:** `https://zoneoutreal.github.io/getrichfast/snipshot/privacy.html`

---

## Distribution tab

- Visibility: Public · Regions: All · Pricing: Free (Pro handled in-extension via ExtensionPay/Stripe)

---

## After approval

1. Copy the live store URL.
2. Replace the `ADD_TO_CHROME` href in `docs/snipshot/index.html`.
3. Reply to reviews weekly; requests feed the roadmap.

## Roadmap candidates (post-traction)

- Full-page (scrolling) capture
- Region capture (drag-select before shooting)
- Arrow/box resize handles
- Recent captures gallery (local only)
