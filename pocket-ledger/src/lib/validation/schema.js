import { CURRENCIES, DEFAULT_RATES, sanitizeRates, snapshotRates } from "../finance/currency.js";
import { isValidISO, todayISO } from "../dates/localDate.js";

/* Schema v3 (handoff §4.4). Deep normalization with repair + quarantine.
   Migration is a pipeline: v1 (desktop dashboard) -> v2 (single-file app) -> v3. */
export const SCHEMA_VERSION = 3;

export const ACCOUNT_TYPES = ["bank", "cash", "debit", "credit"];
export const TX_TYPES = ["expense", "income", "transfer", "adjustment"];
export const EXPENSE_CATEGORIES = [
  "Food & Dining", "Groceries", "Transport", "Housing & Bills", "Health", "Family",
  "Education", "Shopping", "Travel", "Subscriptions", "Installments", "Adjustment", "Other",
];
export const INCOME_CATEGORIES = ["Salary", "Business", "Investments", "Adjustment", "Other income"];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const str = (v, fb = "") => (typeof v === "string" ? v : fb);
const num = (v, fb = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
const bool = (v) => v === true;
const cur = (v) => (CURRENCIES.includes(v) ? v : "AED");

export function blankData(now = todayISO()) {
  return {
    schemaVersion: SCHEMA_VERSION,
    accounts: [],
    transactions: [],
    recurrs: [],
    debts: [],
    budgets: {},
    pending: [],
    settings: {
      base: "AED",
      rates: { ...DEFAULT_RATES },
      ratesUpdatedAt: null,
      lastAccount: null,
      language: "en",
      theme: "light",
      includeIousInNetWorth: false,
    },
    meta: { createdAt: now, updatedAt: now, quarantine: [] },
  };
}

export function normalizeAccount(a, report) {
  if (!a || typeof a !== "object" || !str(a.name).trim()) {
    report.quarantined.push({ kind: "account", raw: a });
    return null;
  }
  const type = ACCOUNT_TYPES.includes(a.type) ? a.type : "bank";
  /* Credit convention (handoff §4.6): openingBalance is a signed asset value —
     credit debt is stored NEGATIVE. Forms show Math.abs and re-sign on save. */
  let opening = num(a.openingBalance, num(a.opening, 0));
  if (type === "credit" && opening > 0) {
    opening = -opening;
    report.repaired.push(`account:${a.name}:credit-opening-sign`);
  }
  const rawDigits = Array.isArray(a.cardDigits)
    ? a.cardDigits
    : str(a.cardDigits).split(/[\s,]+/);
  const cardDigits = [...new Set(rawDigits.map((d) => str(d).trim()).filter((d) => /^\d{4}$/.test(d)))];
  return {
    id: str(a.id) || uid(),
    name: str(a.name).trim(),
    type,
    currency: cur(a.currency),
    openingBalance: opening,
    cardDigits,
    creditLimit: Math.max(0, num(a.creditLimit, 0)),
    color: /^#[0-9A-Fa-f]{6}$/.test(str(a.color)) ? a.color : "#1F4E5F",
    archived: bool(a.archived),
    sortOrder: num(a.sortOrder, NaN),
  };
}

export function normalizeTransaction(t, report, accountIds, rates) {
  if (!t || typeof t !== "object") {
    report.quarantined.push({ kind: "transaction", raw: t });
    return null;
  }
  const type = TX_TYPES.includes(t.type) ? t.type : null;
  const date = isValidISO(t.date) ? t.date : null;
  const snapshot = snapshotRates(t.snapshot || rates);
  const base = { id: str(t.id) || uid(), date, note: str(t.note), snapshot };

  if (type === "transfer") {
    const sourceAccountId = str(t.sourceAccountId || t.accountId);
    const destinationAccountId = str(t.destinationAccountId || t.toAccountId);
    const sourceCurrency = cur(t.sourceCurrency || t.currency);
    const destinationCurrency = cur(t.destinationCurrency);
    const sourceAmount = num(t.sourceAmount, num(t.amount, NaN));
    let destinationAmount = num(t.destinationAmount, NaN);
    if (
      !date || !accountIds.has(sourceAccountId) || !accountIds.has(destinationAccountId) ||
      !(sourceAmount > 0)
    ) {
      report.quarantined.push({ kind: "transaction", raw: t });
      return null;
    }
    if (!(destinationAmount > 0)) {
      destinationAmount = (sourceAmount / snapshot[sourceCurrency]) * snapshot[destinationCurrency];
      report.repaired.push(`tx:${base.id}:derived-destination`);
    }
    return {
      ...base, type, sourceAccountId, destinationAccountId,
      sourceAmount, sourceCurrency, destinationAmount, destinationCurrency,
      /* legacy mirrors keep old readers working */
      accountId: sourceAccountId, toAccountId: destinationAccountId,
      amount: sourceAmount, currency: sourceCurrency, category: "Transfer",
    };
  }

  const amount = num(t.amount, NaN);
  const accountId = str(t.accountId);
  if (!type || !date || !accountIds.has(accountId) || !(type === "adjustment" ? amount !== 0 && Number.isFinite(amount) : amount > 0)) {
    report.quarantined.push({ kind: "transaction", raw: t });
    return null;
  }
  return {
    ...base, type, amount, currency: cur(t.currency), accountId,
    category: str(t.category) || (type === "income" ? "Other income" : type === "adjustment" ? "Adjustment" : "Other"),
  };
}

export function normalizeRecurring(r, report, accountIds) {
  if (!r || typeof r !== "object" || !str(r.name).trim() || !(num(r.amount, NaN) > 0) || !isValidISO(r.nextDue)) {
    report.quarantined.push({ kind: "recurring", raw: r });
    return null;
  }
  const kind = r.kind === "installment" ? "installment" : "subscription";
  const out = {
    id: str(r.id) || uid(),
    kind,
    name: str(r.name).trim(),
    amount: num(r.amount),
    currency: cur(r.currency),
    cycle: ["weekly", "monthly", "yearly"].includes(r.cycle) ? r.cycle : "monthly",
    nextDue: r.nextDue,
    accountId: accountIds.has(str(r.accountId)) ? r.accountId : null,
    paused: bool(r.paused),
  };
  if (kind === "installment") {
    out.monthsTotal = Math.max(1, Math.round(num(r.monthsTotal, 1)));
    out.monthsPaid = Math.min(out.monthsTotal, Math.max(0, Math.round(num(r.monthsPaid, 0))));
    out.cycle = "monthly";
  }
  return out;
}

export function normalizeDebt(d, report) {
  if (!d || typeof d !== "object" || !str(d.person).trim() || !(num(d.amount, NaN) > 0)) {
    report.quarantined.push({ kind: "debt", raw: d });
    return null;
  }
  const amount = num(d.amount);
  return {
    id: str(d.id) || uid(),
    person: str(d.person).trim(),
    direction: d.direction === "borrowed" ? "borrowed" : "lent",
    amount,
    currency: cur(d.currency),
    repaid: Math.min(amount, Math.max(0, num(d.repaid, 0))),
    note: str(d.note),
    date: isValidISO(d.date) ? d.date : todayISO(),
  };
}

export function normalizePending(p, report, accountIds) {
  if (!p || typeof p !== "object" || !(num(p.amount, NaN) > 0) || !str(p.rawText).trim()) {
    report.quarantined.push({ kind: "pending", raw: p });
    return null;
  }
  return {
    id: str(p.id) || uid(),
    rawText: str(p.rawText).trim(),
    amount: num(p.amount),
    currency: cur(p.currency),
    direction: p.direction === "income" ? "income" : "expense",
    cardLast4: /^\d{4}$/.test(str(p.cardLast4)) ? p.cardLast4 : "",
    merchant: str(p.merchant),
    accountId: accountIds.has(str(p.accountId)) ? p.accountId : null,
    category: str(p.category, null) || null,
    date: isValidISO(p.date) ? p.date : todayISO(),
  };
}

function normalizeSettings(s) {
  const d = blankData().settings;
  if (!s || typeof s !== "object") return d;
  return {
    base: cur(s.base ?? s.baseCurrency),
    rates: sanitizeRates(s.rates),
    ratesUpdatedAt: str(s.ratesUpdatedAt, null) || null,
    lastAccount: str(s.lastAccount, null) || null,
    language: s.language === "ar" ? "ar" : "en",
    theme: "light",
    includeIousInNetWorth: bool(s.includeIousInNetWorth),
  };
}

function detectVersion(raw) {
  if (!raw || typeof raw !== "object") return 0;
  if (raw.schemaVersion === SCHEMA_VERSION) return SCHEMA_VERSION;
  if (Array.isArray(raw.accounts) && Array.isArray(raw.recurrs)) return 2;
  if (Array.isArray(raw.transactions) && !Array.isArray(raw.accounts)) return 1;
  return 0;
}

/* v1 desktop dashboard: transactions had no accounts — create per-currency
   "Imported" cash accounts, exactly like the original one-off migration. */
function liftV1(raw) {
  const perCur = {};
  const accounts = [];
  const transactions = [];
  for (const t of raw.transactions || []) {
    const c = CURRENCIES.includes(t?.currency) ? t.currency : "AED";
    if (!perCur[c]) {
      perCur[c] = { id: uid(), name: `Imported (${c})`, type: "cash", currency: c, openingBalance: 0 };
      accounts.push(perCur[c]);
    }
    transactions.push({ ...t, accountId: perCur[c].id, type: t?.type === "income" ? "income" : "expense" });
  }
  return {
    accounts,
    transactions,
    recurrs: [],
    debts: [],
    budgets: raw.budgets || {},
    settings: { base: raw.settings?.baseCurrency, rates: raw.settings?.rates },
  };
}

export function normalizeData(raw) {
  const report = { migratedFrom: detectVersion(raw), repaired: [], quarantined: [] };
  const out = blankData();
  let src = raw && typeof raw === "object" ? raw : {};
  if (report.migratedFrom === 1) src = liftV1(src);
  if (report.migratedFrom === 0) src = {};

  out.settings = normalizeSettings(src.settings);
  out.accounts = (Array.isArray(src.accounts) ? src.accounts : [])
    .map((a) => normalizeAccount(a, report))
    .filter(Boolean);
  out.accounts.forEach((a, i) => { if (!Number.isFinite(a.sortOrder)) a.sortOrder = i; });
  out.accounts.sort((x, y) => x.sortOrder - y.sortOrder);
  out.accounts.forEach((a, i) => { a.sortOrder = i; });
  const ids = new Set(out.accounts.map((a) => a.id));
  out.transactions = (Array.isArray(src.transactions) ? src.transactions : [])
    .map((t) => normalizeTransaction(t, report, ids, out.settings.rates))
    .filter(Boolean);
  out.recurrs = (Array.isArray(src.recurrs) ? src.recurrs : [])
    .map((r) => normalizeRecurring(r, report, ids))
    .filter(Boolean);
  out.debts = (Array.isArray(src.debts) ? src.debts : []).map((d) => normalizeDebt(d, report)).filter(Boolean);
  out.pending = (Array.isArray(src.pending) ? src.pending : [])
    .map((x) => normalizePending(x, report, ids))
    .filter(Boolean);
  out.budgets = {};
  if (src.budgets && typeof src.budgets === "object") {
    for (const [k, v] of Object.entries(src.budgets)) if (num(v, 0) > 0) out.budgets[k] = num(v);
  }
  if (out.settings.lastAccount && !ids.has(out.settings.lastAccount)) out.settings.lastAccount = null;
  out.meta = {
    createdAt: str(src.meta?.createdAt) || todayISO(),
    updatedAt: todayISO(),
    quarantine: report.quarantined.map((q) => q.kind),
  };
  return { data: out, report };
}
