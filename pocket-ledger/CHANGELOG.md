# Changelog

## 2.0.0 — Phase 1 "Stabilize" (2026-07-17)

Full implementation of the Phase 1 scope from `Pocket-Ledger-Claude-Handoff.md`, refactoring the single-file artifact into a production Vite project while preserving the Pocket Ledger identity (navy/gold, Fraunces/Inter/IBM Plex Mono, 4 tabs + gold FAB, bottom sheets, 3-tap entry).

### Fixed (critical, §4)
- **§4.1 Storage** — adapter with priority `window.storage → IndexedDB → localStorage`, last-known-good backup on every write, visible non-blocking banner on save failure, malformed-data recovery.
- **§4.2 Project** — complete Vite + Tailwind + ESLint + Prettier + Vitest + RTL setup; `install/dev/build/test/lint` all pass.
- **§4.3 Dates** — all date logic moved to local-calendar utilities; no UTC round-trips; month-end clamping (Jan 31 → Feb 28/29); leap-year safe; DST-safe day diffs.
- **§4.4 Normalization** — schema v3, deep `normalizeData/Account/Transaction/Recurring/Debt`, versioned migration pipeline (v1 dashboard → v2 artifact → v3), automatic repair, quarantine of irreparable records, migration persisted back on load.
- **§4.5 Rates** — draft inputs, validation (no 0/negative/NaN/∞), clear error, reset-to-defaults, `ratesUpdatedAt` timestamp, confirmation when a change affects displayed totals. USD pinned to 1.
- **§4.6 Credit cards** — one explicit convention (signed asset value; debt negative) documented in code and tests; forms display owed as positive; edit form separates *starting* vs *current calculated* balance and points to **Adjust**, which reconciles via an adjustment transaction instead of rewriting history (pulls §5.2 forward into Phase 1).
- **§4.7 Error boundary** — friendly recovery screen, reload, recovery-data export, technical details behind a disclosure.
- **§4.8 Destructive actions** — undo toast (6 s) for transaction/recurring/debt deletion and account hide; typed **RESET** confirmation for full wipe.
- **§4.9 CSV** — UTF-8 BOM, CRLF, safe escaping, IDs, both transfer sides, base-equivalent at entry-time rates, rate snapshot column, timestamped filename, URL revoked after click. Plus full JSON backup/restore with validation, summary, merge/replace and automatic pre-import backup (§5.6).
- **§4.10 PWA** — manifest, generated icons (incl. maskable + apple-touch), service worker caching **assets only**, theme color, installable over HTTPS. (Pulled forward from Phase 2 since §4 marks it critical.)

### Financial correctness (§7)
- Rate snapshot stored on **every** transaction; balances, monthly totals and exports compute from snapshots → historical reports never change when today's rates are edited (acceptance #9).
- Transfers store immutable dual sides (`sourceAmount`/`destinationAmount` + currencies + snapshot) with legacy mirror fields for backward readers; migrated legacy transfers are marked with current rates as allowed by §7.5.
- Net worth = assets + negative credit balances; personal IOUs excluded by default (**Decision A**, flag `settings.includeIousInNetWorth` reserved).
- 38 tests cover conversion, invalid rates, credit purchase/payment/overpayment/refund/starting debt, cross-currency transfers, adjustments, snapshot immutability, net worth, debt totals, budget thresholds, dates, migrations, storage fallback/corruption, CSV/backup, and UI flows.

### UX (§6, partial)
- Sheets initialize only on the closed→open transition (§6.2).
- Dialog semantics, Escape-to-close, focus restore, aria labels/pressed states, keypad + physical-keyboard digits and Enter-to-save, reduced-motion support, screen-reader money-direction hints.
- Date & note collapsed by default behind a disclosure; currency pills in the entry flow; last-used account preselected.
- i18n foundation (en/ar dictionaries, RTL switch) wired for chrome strings; **Decision B**: English default.

### Decisions applied (§14, recommended defaults)
A: IOUs excluded from net worth · B: English default · C: manual rates + timestamp · D/E: deferred to Phase 2 flows.

### Known limitations (Phase 2 queue)
- No edit flows yet for transactions/recurring/debts (§5.1) — delete + re-add for now.
- Missed recurring cycles: "Paid" advances exactly one cycle; the record-one / catch-up / skip chooser (§5.3, Decision E) is not built yet. Pause/skip/end actions likewise.
- Debt repayments are tracking-only; the optional linked account transaction (§5.4, Decision D) is Phase 2.
- Monthly report view + print layout (§5.5), full Activity filters (date range/type/currency, §5.7) and budget rollover (§5.8) pending.
- Arabic dictionary covers core chrome only; full copy coverage is Phase 2.
- Google Fonts are not cached by the SW — offline falls back to system fonts; self-hosting planned.
- No encryption at rest / app lock yet (Phase 3).

## 2.1.0 — Voice Quick-Add + Siri intake (2026-07-17)

- **Quick-Add field** in the Add sheet: bilingual (ar/en) deterministic parser — Arabic-Indic digits, currency words, income/transfer detection incl. attached lam (`للراجحي`), account matching (names + cash/visa words, definite-article tolerant), 60+ category keywords. Prefill-only by design: the user always reviews and taps Save; original phrase is kept as the note.
- **Siri / Shortcuts intake**: `#add=<text>` opens the sheet prefilled once data is loaded, then cleans the URL. Clipboard paste button covers the installed-PWA flow.
- 13 new tests (12 parser + 1 UI flow) → **51 total, all passing**. Lint clean, build clean.
- Known limitation: parser is keyword-based — freeform sentences without a number still need manual amounts; a Claude-API fallback for messy phrases is a Phase 3 option.

## 2.2.0 — Bank-SMS approval inbox (2026-07-17)

- **Pending inbox**: bank alerts queue as pending items and post **only after explicit approval** — per item or "Approve all matched". Dismiss has undo. Header badge shows the waiting count.
- **SMS parser** (`lib/voice/sms.js`): Arabic/English bank formats, Arabic-Indic digits, amount+currency, merchant (original casing), date (dd/mm), income vs expense hints, card last-4 in 4 notations; junk (OTP/ads) skipped; batch splitting with two-line-wrap merge; duplicate raw messages ignored on re-import.
- **Account ↔ card matching**: accounts store card last-4 digits (new form field, schema-normalized); matched items show the source account pre-confirmed in green — answering "اتأكد هو ساحب منين" before anything is saved.
- **Intake paths**: `#sms=` hash for the Shortcuts automation flow + clipboard paste inside the inbox.
- Category keyword fix: transactional verbs (شراء) no longer masquerade as Shopping; merchant name takes priority in category guessing; fuel brands added.
- 9 new tests (8 parser + full inbox UI flow) → **60 total, all passing**. Lint clean, build clean.
- Honest limitation: iOS offers no direct SMS API to any app — capture relies on the documented Shortcuts automation; first run may ask iOS for confirmation per bank sender.
