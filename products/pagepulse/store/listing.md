# PagePulse — Chrome Web Store Listing Kit

Copy-paste everything below into the Chrome Web Store Developer Dashboard.

---

## Store listing

**Name (max 45 chars):**
```
PagePulse — Auto Refresh & Page Monitor
```

**Summary (max 132 chars):**
```
Auto-refresh any tab on your schedule, with a live countdown badge. Pro adds custom intervals, jitter & change alerts. 100% local.
```

**Category:** Productivity → Tools
**Language:** English

**Description:**
```
Stop hammering F5.

PagePulse refreshes any tab on the schedule you choose — ticket queues, dashboards, order status, drops, scores, build pipelines — with a live countdown right on the toolbar badge.

↻ PER-TAB AUTO REFRESH
Pick a preset (10s, 30s, 1m, 5m, 15m, 30m) and that tab refreshes itself until you say stop. Each tab gets its own interval. Close the tab and its job cleans up automatically.

⏱️ LIVE COUNTDOWN BADGE
The toolbar badge shows exactly how long until the next refresh — 9s, 45s, 3m — so you always know the pulse is alive.

🗂️ ONE LIST, TOTAL CONTROL
The popup shows every refreshing tab with its host and interval. Stop one, or stop all in one click. Jobs survive browser restarts.

🔒 100% LOCAL & PRIVATE
No account, no analytics, no servers. PagePulse reloads tabs by their id — it doesn't read your pages or history. Monitor mode (Pro) asks for permission per-site, only when you enable it there.

💎 PRO — PAY ONCE, OWN IT FOREVER ($9)
• Custom intervals from seconds to hours — type "45s", "2m", "1.5h"
• Change alerts: after each refresh, get a notification when the page changes — or only when your keyword appears or disappears ("in stock", "tickets available", "passed")
• ±20% jitter so your polling doesn't look like a metronome
No subscription. Every future update included.

Perfect for: support queues, CI dashboards, stock/restock pages, auction endings, ticket releases, order tracking, live scores, log viewers.
```

**Screenshots (1280×800), in order:**
1. `screenshots/1-hero.png`
2. `screenshots/2-monitor.png`
3. `screenshots/3-jobs.png`
4. `screenshots/4-pricing.png`

**Small promo tile (440×280):** `screenshots/promo-small-440x280.jpg`
**Marquee promo tile (1400×560):** `screenshots/promo-marquee-1400x560.jpg`

**Homepage URL:** `https://zoneoutreal.github.io/getrichfast/pagepulse/`
**Support URL:** `https://github.com/ZoneoutReal/getrichfast/issues`

**Additional fields:** Official URL: None · Mature content: off

---

## Privacy tab

**Single purpose description:**
```
PagePulse automatically reloads the tabs the user selects, at the interval the user selects, and (optionally, Pro) notifies the user when a monitored page's content changes.
```

**Permission justifications:**

- `storage`:
```
Stores the user's refresh jobs (tab, interval, next fire time) locally so they survive browser restarts. Nothing is transmitted anywhere.
```

- `alarms`:
```
A recovery alarm re-arms the refresh timers if Chrome suspends the extension's service worker, so intervals stay accurate.
```

- `scripting` (with optional host permissions):
```
Used only by the optional Pro monitor feature to read the monitored page's text after a refresh, so the extension can tell whether it changed. Runs only on sites where the user explicitly enabled monitoring and granted access.
```

- `notifications`:
```
Shows the Pro monitor's alert ("your keyword appeared") as a system notification.
```

- Optional host permissions (`<all_urls>`, requested per-site):
```
Monitoring a page's content requires reading that page. PagePulse requests access for the specific site only at the moment the user enables monitoring there — never broadly, never at install.
```

- Host permission `https://extensionpay.com/*` (content script):
```
Required by the ExtensionPay payment library solely to complete the optional one-time Pro purchase flow.
```

**Remote code:** No, I am not using remote code.

**Data usage disclosures:** check NONE of the data types. Certify all three disclosures.

**Privacy policy URL:** `https://zoneoutreal.github.io/getrichfast/pagepulse/privacy.html`

---

## Distribution tab

- Visibility: Public · Regions: All · Pricing: Free (Pro handled in-extension via ExtensionPay/Stripe)

---

## After approval

1. Copy the live store URL.
2. Replace the `ADD_TO_CHROME` href in `docs/pagepulse/index.html`.
3. Reply to reviews weekly; requests feed the roadmap.

## Roadmap candidates (post-traction)

- Scheduled start/stop (refresh only 9–5)
- Sound alerts + alert history
- Per-URL auto-resume (re-attach job when you revisit a site)
- Firefox/Edge ports
