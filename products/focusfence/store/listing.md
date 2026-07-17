# FocusFence — Chrome Web Store Listing Kit

Copy-paste everything below into the Chrome Web Store Developer Dashboard.

---

## Store listing

**Name (max 45 chars):**
```
FocusFence — Site Blocker & Focus Mode
```

**Summary (max 132 chars):**
```
Block distracting sites, run focus sessions, keep your data. 100% local — no account, no tracking. Pay once, no subscription.
```

**Category:** Productivity → Workflow & Planning
**Language:** English

**Description:**
```
The big-name site blockers charge ~$11/month and run your browsing through their accounts. FocusFence does the job on your device, for a one-time price, and never sees a single URL you visit.

⏱️ FOCUS SESSIONS
Start a 25, 50, or 90-minute session from the toolbar. Your block list snaps into force, the badge counts down the minutes, and blocked sites land on a calm fence page instead of your feed.

🛡️ BLOCKING THAT ACTUALLY BLOCKS
FocusFence uses Chrome's built-in declarativeNetRequest engine — the navigation is stopped by the browser itself before the request even leaves. No flicker, no loopholes via new tabs.

➕ ONE-CLICK LIST BUILDING
"Block this site" adds the tab you're currently doom-scrolling. Wildcards cover subdomains (*.tiktok.com). Free tier fences 7 sites — enough to matter.

🔒 100% LOCAL & PRIVATE
No account, no analytics, no servers. Your block list and your browsing never leave your machine. FocusFence can't sell your data because it never sees it.

💎 PRO — PAY ONCE, OWN IT FOREVER ($15)
• Unlimited sites
• Weekly schedules — workdays 9:00–17:30, overnight spans like 22:00–06:00
• Strict mode — settings freeze while a session runs; no early exits
• Path patterns (reddit.com/r/all) and a custom message on the block page
That's less than five weeks of the incumbent's subscription — once.

FocusFence blocks only the sites you list, only when blocking is on. It never reads page content, never records history, and never phones home.
```

**Screenshots (1280×800), in order:**
1. `screenshots/1-hero.png`
2. `screenshots/2-schedules.png`
3. `screenshots/3-popup.png`
4. `screenshots/4-pricing.png`

**Small promo tile (440×280):** `screenshots/promo-small-440x280.jpg`
**Marquee promo tile (1400×560):** `screenshots/promo-marquee-1400x560.jpg`

**Homepage URL:** `https://zoneoutreal.github.io/getrichfast/focusfence/`
**Support URL:** `https://github.com/ZoneoutReal/getrichfast/issues`

**Additional fields:** Official URL: None · Mature content: off

---

## Privacy tab

**Single purpose description:**
```
FocusFence blocks navigation to the websites on the user's block list during the periods the user chooses (focus sessions, always-on, or schedules).
```

**Permission justifications:**

- `declarativeNetRequest`:
```
The core of the product: declarative rules generated from the user's block list stop navigations to those sites inside Chrome's own blocking engine. The extension never observes requests — rules are evaluated by the browser.
```

- Host permissions (`<all_urls>`):
```
Required by Chrome for declarativeNetRequest REDIRECT actions: when a listed site is blocked, the navigation is redirected to the extension's local block page (with the focus countdown) instead of a raw browser error. FocusFence runs no content scripts on websites, makes no network requests, and never reads page content or history. Blocking applies only to sites the user explicitly listed.
```

- `storage`:
```
Stores the user's block list, schedules and preferences locally. Nothing is transmitted anywhere.
```

- `alarms`:
```
Ends focus sessions on time and re-evaluates schedules once a minute so blocking switches on and off exactly when configured.
```

- Host permission `https://extensionpay.com/*` (content script):
```
Required by the ExtensionPay payment library solely to complete the optional one-time Pro purchase flow.
```

**Remote code:** No, I am not using remote code.

**Data usage disclosures:** check NONE of the data types. Certify all three disclosures.

**Privacy policy URL:** `https://zoneoutreal.github.io/getrichfast/focusfence/privacy.html`

---

## Distribution tab

- Visibility: Public · Regions: All · Pricing: Free (Pro handled in-extension via ExtensionPay/Stripe)

---

## After approval

1. Copy the live store URL.
2. Replace the `ADD_TO_CHROME` href in `docs/focusfence/index.html`.
3. Reply to reviews weekly; requests feed the roadmap.

## Roadmap candidates (post-traction)

- Allowlist mode (block everything except listed sites)
- Pomodoro cycles (auto-repeating session + break)
- Per-schedule site groups (work list vs evening list)
- Firefox/Edge ports
