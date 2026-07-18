# Pocket Ledger · دفتر الجيب

Private, single-user personal finance PWA across **AED · SAR · EGP · USD** — accounts, cash, credit cards, subscriptions, installments, personal loans/IOUs and monthly budgets. Built mobile-first for a fast, calm, ADHD-friendly workflow: log a transaction in ~3 taps, see what's coming before it hits, never get punished for coming back after a break.

## Run it

```bash
npm install
npm run dev        # local development on http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve the production build locally
npm run test       # Vitest suite (finance, dates, schema, storage, export, UI)
npm run lint       # ESLint
```

Node 18+ required.

## Storage behavior

Data is one JSON document under the key `pfm:v3`, saved through an adapter with this priority:

1. **`window.storage`** — when running inside a Claude artifact
2. **IndexedDB** — normal browsers (primary)
3. **`localStorage`** — final fallback

Every successful save first preserves the previous value under `pfm:v3:bak` (last-known-good). If the main document is ever corrupted, the app loads the backup automatically. A failed save shows a persistent red banner — it never fails silently.

On first launch the app also looks for legacy keys `pfm:v2` and `pfm:data:v1` and migrates them through a versioned pipeline (`normalizeData`) that repairs what it can and quarantines what it can't, then writes the result back under `pfm:v3`.

### Historical correctness

Every transaction stores a **rate snapshot** taken at entry time. Balances, monthly totals and CSV base-equivalents are computed from each transaction's own snapshot — so editing today's EGP rate never changes last month's numbers. Transfers store **both** sides (`sourceAmount` / `destinationAmount`) immutably. Credit-card balances are signed asset values (debt is negative internally; the UI shows the absolute value labelled "owed"). "Adjust" on an account reconciles to the bank's actual figure by writing an adjustment transaction — history is never rewritten.

Dates are local-calendar `YYYY-MM-DD` strings handled by `src/lib/dates/localDate.js` — no UTC round-trips, so nothing shifts by a day between Cairo, Riyadh and Dubai, and monthly cycles clamp correctly (Jan 31 → Feb 28/29).

## Privacy model

- All data stays on this device (or in your Claude account when run as an artifact).
- No analytics, no ad SDKs, no third-party finance APIs, no bank credentials.
- The only external requests are Google Fonts for typography (no financial data is ever transmitted). Self-host the fonts if you want zero external requests.
- The service worker caches **application assets only** — never your financial data.
- Backup files (JSON/CSV) contain your full financial history in plain text. Store them somewhere safe.
- Data is **not encrypted at rest** in this version — an optional local app lock (PIN/WebAuthn) is a Phase 3 item.

## Backup & restore

Settings → **Export JSON backup** downloads the full document. **Restore from file** validates the backup, shows a summary, asks Replace-or-Merge, and writes an automatic pre-import copy to `pfm:v3:pre-import` before touching anything. CSV export ships with UTF-8 BOM (Excel/Arabic-safe), transaction IDs, both transfer sides, base-currency equivalents at entry-time rates, and the full rate snapshot per row.

**Moving data from the Claude artifact:** export a JSON backup inside the artifact, then restore it here.

## Deployment

Static hosting is all it needs:

```bash
npm run build
# deploy dist/ to Netlify, Vercel, Cloudflare Pages, GitHub Pages…
```

Serve over **HTTPS** (required for service worker + install prompt). SPA fallback to `index.html` is only needed if you add routing later. After first load, core screens work offline; on phones use "Add to Home Screen" to install.

## Project layout

```
src/
  app/App.jsx            orchestrator: load→migrate→derive→commit
  components/            common primitives, screens, bottom sheets
  lib/
    storage/             adapter + claude/indexeddb/localstorage backends
    finance/             currency (snapshots), balances, net worth
    dates/               local-calendar utilities
    validation/          schema v3, normalize + migration pipeline
    export/              CSV + JSON backup/restore
  i18n/                  en/ar dictionaries + RTL switching (foundation)
  test/                  38 tests across all of the above
public/                  manifest, service worker, icons
```

## Voice entry & Siri (iOS)

The Add sheet starts with a **Quick-Add** field. Type — or use the keyboard's mic — a phrase like `بنزين ٢٥٠ ريال من الراجحي` or `lunch 95 aed visa`; the bilingual parser prefills amount, currency, type (expense/income/transfer), category and account. **It never saves by itself** — you always review and tap Save.

The app also accepts `https://YOUR-SITE/#add=<text>` and opens the sheet prefilled — built for Apple Shortcuts:

1. Shortcuts → new shortcut → **Dictate Text** (language: Arabic)
2. **URL Encode** (input: Dictated Text)
3. **URL**: `https://YOUR-SITE/#add=` + Encoded Text variable
4. **Open URLs** — name it e.g. "سجل مصروف" and invoke via Siri.

iOS storage note: an installed home-screen PWA has storage separate from Safari. If you use the Siri URL flow, keep using the site in Safari. If you prefer the installed app, make the shortcut **Dictate → Copy to clipboard**, open the app, and tap the 📋 paste button in Quick-Add.

## Bank-SMS approval inbox

Bank purchase/withdrawal alerts can flow into a **pending inbox** — nothing posts to your accounts until you approve each item. The parser reads amount, currency, merchant, date and the **card last-4 digits**, and matches the source account from the digits you save on each account (Accounts → edit → "Card last-4 digits"). Unmatched items ask you to pick the account; approval creates a normal transaction with the current rate snapshot.

Entry points: the 📥 inbox badge in the header (paste inside), or `https://YOUR-SITE/#sms=<encoded messages>`.

### iOS capture via Shortcuts (no server, fully on-device)

iOS gives no app direct SMS access, so capture uses two Shortcuts:

**A. Auto-collect (one automation per bank sender):**
Shortcuts → Automation → **Message** → Sender: your bank (or Message Contains "بطاقة") → Run Immediately → action **Append to Text File**: `Shortcuts/pl-inbox.txt`, text = Shortcut Input + newline.

**B. "استورد المصاريف" shortcut:**
**Get File** `pl-inbox.txt` → **URL Encode** → **URL** `https://YOUR-SITE/#sms=` + encoded → **Open URLs** → then **Text** (empty) → **Save File** (replace `pl-inbox.txt`) to clear the queue.

Messages accumulate silently all week; run B when you want to review — the inbox opens with everything queued for approval.
