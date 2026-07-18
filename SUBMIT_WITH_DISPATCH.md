# Chrome Web Store submission runbook (for a computer-use agent)

Point your computer-use agent ("dispatch") at this file. It automates the
manual Chrome Web Store upload **inside your own already-logged-in browser
session** — it does not need and must never ask for your password.

---

## PROMPT — paste this to dispatch

> You are submitting Chrome extensions to the Chrome Web Store on my behalf,
> using my browser which is **already signed in** to my developer account.
> Do the whole flow yourself; only stop to ask me if you hit a blocker you
> cannot resolve (e.g. a payment/verification wall or a CAPTCHA).
>
> **Before you start**, confirm all of these — if any fails, stop and tell me:
> 1. Open https://chrome.google.com/webstore/devconsole — you should see the
>    developer dashboard (an "Items" list), NOT a "pay $5 to register" screen.
>    If it asks for the $5 registration fee, stop and tell me.
> 2. In the dashboard's **Account** tab, a contact email must be present and
>    **verified**. If not, stop and tell me.
>
> **Submit the following item(s)** (I'll tell you which — default: PagePulse):
> for each one, download its ZIP, create a new item, fill every field by
> copy-pasting from its Listing Kit URL, upload its images, complete the
> Privacy tab exactly as the kit specifies, set Distribution to public/all
> regions/free, then click **Submit for review**.
>
> ### Per-item procedure (repeat for each product)
> 1. **Download the ZIP** from the "Download ZIP" URL in the table below and
>    save it locally.
> 2. Dashboard → **"+ New item"** → drag/drop or upload the ZIP → wait for it
>    to finish processing → it opens the item's draft.
> 3. Open the **Listing Kit URL** (raw text) in another tab. It contains every
>    field pre-written. On the **Store listing** tab, copy-paste:
>    - **Description** → the big text block under "Description:"
>    - **Category** → as stated (e.g. "Productivity")
>    - **Language** → English
>    - (Name and Summary auto-fill from the package; leave them.)
> 4. **Graphics** — upload from the "Screenshots URL" folder (open each file,
>    download, then upload in the dashboard):
>    - The 4 files named `1-*.png … 4-*.png` as **Screenshots** (1280×800).
>    - `promo-small-440x280.jpg` as the **Small promo tile**.
>    - `promo-marquee-1400x560.jpg` as the **Marquee promo tile**.
>    - Store icon auto-fills from the package; if asked, use the 128px icon.
> 5. Set **Homepage URL** and **Support URL** exactly as given in the kit
>    (under "Homepage URL" / "Support URL"). Official URL: None. Mature
>    content: off.
> 6. **Privacy practices** tab — this is the part reviewers scrutinize; copy it
>    verbatim from the kit's "Privacy tab" section:
>    - **Single purpose** → the one-sentence description.
>    - **Permission justifications** → paste the matching justification for
>      each permission the form lists (storage, activeTab, clipboardWrite,
>      the host/`<all_urls>` content script, and `extensionpay.com`).
>    - **Remote code** → select **"No, I am not using remote code."**
>    - **Data usage** → check **NONE** of the data-type boxes, then check the
>      three certification checkboxes at the bottom (the kit confirms: no data
>      is collected).
>    - **Privacy policy URL** → the `.../privacy.html` URL from the kit.
> 7. **Distribution** tab → Visibility: **Public**; Regions: **All**;
>    Pricing: **Free**.
> 8. Click **Save draft**, resolve any red "missing field" warnings it lists,
>    then click **Submit for review**.
> 9. Record the item's **ID** and its listing URL, and whether submission
>    succeeded. Move to the next product.
>
> ### When done
> Report back a short table: product → submitted? (yes/no) → item URL → any
> warning or error you saw. Do not invent success; if a submit button stayed
> disabled, say which field blocked it.
>
> ### If something goes wrong
> - "This extension ID is already in use" on a NEW item is not expected — stop
>   and tell me (don't overwrite an existing item).
> - Broad-host-permission review notice ("your item may require in-depth
>   review") is EXPECTED for several of these — click through / Submit anyway;
>   the justification is already in the Privacy tab.
> - Any request to pay, verify identity, add a phone, or a CAPTCHA → stop and
>   tell me; do not attempt to bypass it.

---

## Product table

Replace `main` in URLs is unnecessary — these point at the merged `main` branch.

| Product | Download ZIP | Listing Kit (raw) | Screenshots folder | Price | Payments |
|---------|--------------|-------------------|--------------------|-------|----------|
| **PagePulse** (auto refresh) | [zip](https://github.com/ZoneoutReal/getrichfast/raw/main/products/pagepulse/release/pagepulse-v1.0.0.zip) | [listing.md](https://raw.githubusercontent.com/ZoneoutReal/getrichfast/main/products/pagepulse/store/listing.md) | [screenshots](https://github.com/ZoneoutReal/getrichfast/tree/main/products/pagepulse/store/screenshots) | $9 | free-only\* |
| **TypeVault** (draft recovery) | [zip](https://github.com/ZoneoutReal/getrichfast/raw/main/products/typevault/release/typevault-v1.0.0.zip) | [listing.md](https://raw.githubusercontent.com/ZoneoutReal/getrichfast/main/products/typevault/store/listing.md) | [screenshots](https://github.com/ZoneoutReal/getrichfast/tree/main/products/typevault/store/screenshots) | $12 | **live** |
| **Recall** (content history search) | [zip](https://github.com/ZoneoutReal/getrichfast/raw/main/products/recall/release/recall-v1.0.0.zip) | [listing.md](https://raw.githubusercontent.com/ZoneoutReal/getrichfast/main/products/recall/store/listing.md) | [screenshots](https://github.com/ZoneoutReal/getrichfast/tree/main/products/recall/store/screenshots) | $15 | **live** |
| **ClipStack** (clipboard history) | [zip](https://github.com/ZoneoutReal/getrichfast/raw/main/products/clipstack/release/clipstack-v1.0.0.zip) | [listing.md](https://raw.githubusercontent.com/ZoneoutReal/getrichfast/main/products/clipstack/store/listing.md) | [screenshots](https://github.com/ZoneoutReal/getrichfast/tree/main/products/clipstack/store/screenshots) | $9 | **live** |
| SnipShot (screenshot+annotate) | [zip](https://github.com/ZoneoutReal/getrichfast/raw/main/products/snipshot/release/snipshot-v1.0.0.zip) | [listing.md](https://raw.githubusercontent.com/ZoneoutReal/getrichfast/main/products/snipshot/store/listing.md) | [screenshots](https://github.com/ZoneoutReal/getrichfast/tree/main/products/snipshot/store/screenshots) | $15 | free-only\* |
| MockFill (test data filler) | [zip](https://github.com/ZoneoutReal/getrichfast/raw/main/products/mockfill/release/mockfill-v1.0.0.zip) | [listing.md](https://raw.githubusercontent.com/ZoneoutReal/getrichfast/main/products/mockfill/store/listing.md) | [screenshots](https://github.com/ZoneoutReal/getrichfast/tree/main/products/mockfill/store/screenshots) | $15 | free-only\* |
| CopyMark (copy as Markdown) | [zip](https://github.com/ZoneoutReal/getrichfast/raw/main/products/copymark/release/copymark-v1.0.0.zip) | [listing.md](https://raw.githubusercontent.com/ZoneoutReal/getrichfast/main/products/copymark/store/listing.md) | [screenshots](https://github.com/ZoneoutReal/getrichfast/tree/main/products/copymark/store/screenshots) | $9 | free-only\* |
| JSONPeek (JSON viewer) | [zip](https://github.com/ZoneoutReal/getrichfast/raw/main/products/jsonpeek/release/jsonpeek-v1.0.0.zip) | [listing.md](https://raw.githubusercontent.com/ZoneoutReal/getrichfast/main/products/jsonpeek/store/listing.md) | [screenshots](https://github.com/ZoneoutReal/getrichfast/tree/main/products/jsonpeek/store/screenshots) | $12 | free-only\* |
| FocusFence (site blocker) | [zip](https://github.com/ZoneoutReal/getrichfast/raw/main/products/focusfence/release/focusfence-v1.0.0.zip) | [listing.md](https://raw.githubusercontent.com/ZoneoutReal/getrichfast/main/products/focusfence/store/listing.md) | [screenshots](https://github.com/ZoneoutReal/getrichfast/tree/main/products/focusfence/store/screenshots) | $15 | free-only\* |
| SnipKey (text expander) | [zip](https://github.com/ZoneoutReal/getrichfast/raw/main/products/snipkey/release/snipkey-v1.0.1.zip) | [listing.md](https://raw.githubusercontent.com/ZoneoutReal/getrichfast/main/products/snipkey/store/listing.md) | [screenshots](https://github.com/ZoneoutReal/getrichfast/tree/main/products/snipkey/store/screenshots) | $15 | **live** |

**\* free-only** = the release zip ships with payments dormant, so it lists and
works but can't take Pro purchases yet. That's fine for a first submission —
Pro can be switched on later with a version update. To sell Pro from day one
instead, register that product's ID on https://extensionpay.com first, tell
Claude the ID, and Claude will re-inject it and rebuild the zip before you
submit.

## Prerequisite the runbook depends on

The listing kits reference homepage/privacy URLs like
`https://zoneoutreal.github.io/getrichfast/<product>/`. **GitHub Pages must be
live** (Settings → Pages → deploy from `main` / `/docs`) or the store's
reachability check on the Homepage/Privacy URLs will fail. All product pages
and privacy policies are already in `/docs` and listed in `sitemap.xml`.
