# Founder Setup — the only human steps in the pipeline

> **Shipping each product after the first (~25 min each):** the accounts
> below already exist after setting up SnipKey, so every later product is the
> same three moves:
> 1. ExtensionPay → "Add extension" → use the **ExtensionPay ID** from the
>    table below → one-time plan at the listed price (nickname `pro`) →
>    paste the ID into chat (it gets wired into that product's
>    `extension/src/lib/config.js` and a final zip built).
> 2. Dev console → New item → upload the zip from that product's `release/`
>    folder → copy-paste everything from its `store/listing.md` (including
>    both promo tiles) → Submit for review.
> 3. Tell Claude when it's approved, with the store URL.
>
> | # | Product | ExtensionPay ID | Pro price | Upload zip |
> |---|---------|-----------------|-----------|------------|
> | 2 | SnipShot (screenshot & annotate) | `getsnipshot` | $15 | `products/snipshot/release/` |
> | 3 | MockFill (test data form filler) | `mockfill` | $15 | `products/mockfill/release/` |
> | 4 | CopyMark (copy as Markdown) | `copymark` | $9 | `products/copymark/release/` |
> | 5 | JSONPeek (JSON viewer & formatter) | `jsonpeek` | $12 | `products/jsonpeek/release/` |
> | 6 | FocusFence (site blocker & focus) | `focusfence` | $15 | `products/focusfence/release/` |
> | 7 | PagePulse (auto refresh & monitor) | `pagepulse` | $9 | `products/pagepulse/release/` |
> | 8 | TypeVault (draft & version recovery) | `typevault` | $12 | `products/typevault/release/` |
> | 9 | Recall (search history by content) | `recall` | $15 | `products/recall/release/` |
> | 10 | ClipStack (clipboard history) | `clipstack` | $9 | `products/clipstack/release/` |
>
> All listings use the same privacy-first answers; permission justifications
> are pre-written in each product's `store/listing.md`. (If an ExtensionPay ID
> is already taken, prefix with `get`, e.g. `gettypevault` — same as SnipKey
> became `getsnipkey`.)

Everything in this repo is built, tested, and packaged. These are the steps
that legally and practically require a human identity — forms, not
conversations. **Total: roughly 60–75 minutes, once.** After this, the
operation is ~90% automated: Claude Code builds, tests, packages, and writes
listings; you click "upload" and approve.

Budget used: **$5** (Chrome developer fee). Everything else here is free.

---

## 1. Chrome Web Store developer account — 10 min, $5

1. Go to https://chrome.google.com/webstore/devconsole and sign in with a
   Google account.
2. Pay the one-time $5 registration fee.
3. In "Account", fill in a contact email and verify it. (This email is shown
   to users; a dedicated address like `snipkey.support@gmail.com` is fine.)

## 2. ExtensionPay + Stripe (payments) — 15 min, $0

1. Sign up at https://extensionpay.com (they handle Chrome-extension payments
   through Stripe; they take ~5% + Stripe fees, no monthly cost).
2. Create an extension in their dashboard, name it `snipkey`.
3. Connect your Stripe account when prompted (Stripe signup is part of the
   flow if you don't have one — identity/bank details required, ~10 min).
4. Set pricing: **one-time payment, $15**.
5. Copy the extension ID ExtensionPay gives you (it will look like `snipkey`
   or similar).

## 3. Wire the payment ID into the extension — 2 min

1. Edit `products/snipkey/extension/src/lib/config.js`.
2. Change `EXTPAY_ID: null` to `EXTPAY_ID: "your-extensionpay-id"`.
3. Commit, or just tell Claude the ID and it will wire it and rebuild.

## 4. Build the upload zip — 1 min

```bash
cd products/snipkey && npm install && npm run build
```

Output: `products/snipkey/dist/snipkey-v1.0.0.zip`
(Tests/icons/screenshots can be re-run any time: `npm test`, `npm run icons`,
`npm run shots`.)

## 5. Upload + fill the listing — 20 min

1. Developer Dashboard → "New item" → upload the zip.
2. Open `products/snipkey/store/listing.md` and copy-paste each field:
   store listing text, screenshots (in `store/screenshots/`), category,
   privacy tab answers (single purpose, permission justifications, "no remote
   code", zero data collection), privacy policy URL, distribution settings.
3. Submit for review. **Typical review time: 1–3 business days** (broad host
   permissions can sometimes take longer — the justifications provided are
   written for exactly this review).

## 6. Enable the website (GitHub Pages) — 3 min

1. GitHub repo → Settings → Pages.
2. Source: "Deploy from a branch" → branch `main`, folder `/docs` → Save.
3. Site goes live at `https://zoneoutreal.github.io/getrichfast/`
   (landing page + the privacy policy URL the store listing references).

## 7. After approval — 5 min

1. Copy the live Chrome Web Store URL.
2. Tell Claude: *"SnipKey is approved, store URL is …"* — the landing page
   button gets wired, and distribution assets (SEO pages, directory
   submissions list, Edge port) get generated.

---

## What to expect (honesty section)

- **Do not expect meaningful sales in week 1.** Store SEO takes weeks to
  index and rank; the first installs come slowly, then compound with reviews.
- Benchmarks to watch (dashboard → stats): impressions → installs
  (aim >8% conversion once the listing has reviews), weekly active users, and
  free→Pro conversion (1–4% of active users is typical for freemium tools).
- The 30-day rule from PLAYBOOK.md applies to SnipKey too: no traction after
  30 days of being live and indexed → we analyze, iterate the listing once,
  and if still flat, ship product #2 rather than polishing product #1.
- Every dollar of revenue lands in **your** Stripe account from day one.
