# ClipStack — Chrome Web Store Listing Kit

Copy-paste everything below into the Chrome Web Store Developer Dashboard.

---

## Store listing

**Name (max 45 chars):**
```
ClipStack — Clipboard History
```

**Summary (max 132 chars):**
```
Private clipboard history — every copy kept locally, one search away. Paste from 20 copies ago, pin favorites. 100% local.
```

**Category:** Productivity → Tools
**Language:** English

**Description:**
```
Ever copied something, copied one more thing, and lost the first? ClipStack keeps a searchable history of everything you copy — so the address, tracking number, code snippet, or link from 20 copies ago is always one click away.

📋 EVERY COPY, REMEMBERED
Copy anything on any page and ClipStack quietly saves it to your local history. Open the popup to see your recent clips with their source site and time. Click any one to copy it straight back to your clipboard.

🔎 SEARCH INSTEAD OF SCROLL
Type a word and ClipStack filters your whole history in real time — across the text and the site you copied it from. Arrow keys to move, Enter to copy.

📌 PIN THE ONES YOU REUSE
Pin your signature, your address, a wallet ID, a support macro — pinned clips stay at the top and are never auto-removed as older copies age out.

🔒 100% LOCAL & PRIVATE
This is the whole point. Your copy history is stored only in Chrome's local storage on your device. It is never uploaded, never synced to a server, never sold — because there are no servers and no account. Pause capturing whenever you like, add sites to an ignore list (your bank, your password manager) so they're never recorded, and clear everything in one click.

💎 PRO — PAY ONCE, OWN IT FOREVER ($9)
• Unlimited history — keep every copy, not just the last 50
• Pinned collections
• Image clips — small copied images saved locally as well as text
• Export your entire history as JSON
No subscription. Every future update included.

Perfect for: writers and researchers collecting quotes and sources, developers copying snippets and commands, support and sales teams reusing macros, anyone who lives in their clipboard.

ClipStack captures the copy itself — it does not read your open pages, and it never watches the system clipboard in the background. Nothing leaves your machine.
```

**Screenshots (1280×800), in order:**
1. `screenshots/1-hero.png`
2. `screenshots/2-search.png`
3. `screenshots/3-manager.png`
4. `screenshots/4-pricing.png`

**Small promo tile (440×280):** `screenshots/promo-small-440x280.jpg`
**Marquee promo tile (1400×560):** `screenshots/promo-marquee-1400x560.jpg`

**Homepage URL:** `https://zoneoutreal.github.io/getrichfast/clipstack/`
**Support URL:** `https://github.com/ZoneoutReal/getrichfast/issues`

**Additional fields:** Official URL: None · Mature content: off

---

## Privacy tab

**Single purpose description:**
```
ClipStack keeps a local, searchable history of the text (and, for Pro, small images) the user copies, so they can find and re-copy something they copied earlier. Everything is stored on the user's device.
```

**Permission justifications:**

- `storage`:
```
Stores the user's clipboard history and settings locally in chrome.storage.local so it persists across sessions and browser restarts. Nothing is transmitted anywhere.
```

- `clipboardWrite`:
```
Used to copy a history item the user clicks back onto the system clipboard, so they can paste it. This is the extension's core output action and happens only in response to a user click.
```

- Content script on `<all_urls>`:
```
A lightweight content script listens for the browser's own copy/cut events so it can add what the user copied to their on-device history. It reads only the copied selection at the moment the user copies it, stores it locally, and never transmits it. It runs on all sites because people copy text everywhere; users can pause capture or exclude specific sites with the built-in ignore list.
```

- Host permission `https://extensionpay.com/*` (content script):
```
Required by the ExtensionPay payment library solely to complete the optional one-time Pro purchase flow.
```

**Remote code:** No, I am not using remote code.

**Data usage disclosures:** check NONE of the data types. Certify all three disclosures.

**Privacy policy URL:** `https://zoneoutreal.github.io/getrichfast/clipstack/privacy.html`

---

## Distribution tab

- Visibility: Public · Regions: All · Pricing: Free (Pro handled in-extension via ExtensionPay/Stripe)

---

## After approval

1. Copy the live store URL.
2. Replace the `ADD_TO_CHROME` href in `docs/clipstack/index.html`.
3. Reply to reviews weekly; requests feed the roadmap.

## Roadmap candidates (post-traction)

- Rich text / HTML clip fidelity
- Snippet folders and tags for pinned collections
- Quick-paste keyboard shortcut (open a searchable overlay anywhere)
- Optional local, passphrase-encrypted history
- Firefox/Edge ports
