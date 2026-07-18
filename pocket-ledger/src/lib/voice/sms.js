/* Bank-SMS parser for the approval Inbox.
   Input: one or many bank alert messages pasted/forwarded from iOS Shortcuts.
   Output: pending items — NOTHING becomes a transaction until the user
   approves it, and the matched account (via card last-4) is always shown
   for confirmation first. */
import { normAr, toEnDigits, findCurrency, guessCategory } from "./parse.js";
import { todayISO, isValidISO, toISO } from "../dates/localDate.js";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const INCOME_HINTS = /(ايداع|اضافه|تم اضافه|راتب|حواله وارده|deposit|credited|salary|received|refund|استرداد)/;
const EXPENSE_HINTS = /(خصم|شراء|سحب|دفع|عمليه|pos|purchase|debited|withdrawal|payment|spent)/;

/* amount + currency: "AED 95.00" | "95.00 درهم" | "بمبلغ ٢١٤٫٥٠ درهم" */
function findAmount(norm) {
  const cleaned = norm.replace(/,(?=\d{3}(\D|$))/g, "");
  let m = /(?:aed|sar|egp|usd|dhs)\s*([0-9]+(?:\.[0-9]+)?)/.exec(cleaned);
  if (!m) m = /([0-9]+(?:\.[0-9]+)?)\s*(?:درهم|ريال|جنيه|دولار|aed|sar|egp|usd|dhs|le\b)/.exec(cleaned);
  if (!m) m = /(?:بمبلغ|مبلغ|قيمه|amount of|of)\s*([0-9]+(?:\.[0-9]+)?)/.exec(cleaned);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
}

/* card last-4: ****1234 | xx1234 | تنتهي بـ1234 | بطاقة رقم 1234 | ending 1234 */
function findLast4(norm) {
  const pats = [
    /[*xX٭]{2,}\s*(\d{4})\b/,
    /(?:تنتهي\s*ب?\s*|ending\s*(?:in\s*|with\s*)?)\*?(\d{4})\b/,
    /بطاق\w*\s*(?:رقم\s*)?\*?(\d{4})\b/,
    /card\s*(?:no\.?\s*)?\*?(\d{4})\b/,
  ];
  for (const p of pats) {
    const m = p.exec(norm);
    if (m) return m[1];
  }
  return "";
}

/* merchant from the RAW text so "CARREFOUR MOE" keeps its casing */
function findMerchant(raw) {
  const m = /(?:لدى|لدي|عند|من عند|at|@|in)\s+([A-Za-z0-9&\u0600-\u06FF][A-Za-z0-9 &.\-'\u0600-\u06FF]{1,40})/i.exec(raw);
  if (!m) return "";
  return m[1]
    .split(/\s+(?:بطاقه|بطاقة|card|with|via|using|بواسطه|بواسطة|على|علي|on|تاريخ|date|بتاريخ|في\s+\d)/i)[0]
    .replace(/[.,;:]+$/, "")
    .trim();
}

function findDate(norm) {
  const m = /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/.exec(norm);
  if (!m) return todayISO();
  const now = new Date();
  let y = m[3] ? +m[3] : now.getFullYear();
  if (y < 100) y += 2000;
  const iso = toISO(y, +m[2], +m[1]); // dd/mm[/yy]
  return isValidISO(iso) ? iso : todayISO();
}

export function matchAccountByDigits(last4, accounts) {
  if (!last4) return null;
  return accounts.find((a) => !a.archived && (a.cardDigits || []).includes(last4))?.id || null;
}

/** Parse ONE bank message chunk -> pending item or null. */
export function parseBankSms(raw, accounts = []) {
  const text = String(raw || "").trim();
  if (!text) return null;
  const norm = normAr(toEnDigits(text));
  const amount = findAmount(norm);
  if (amount == null) return null; // no amount => not a money alert
  const currency = findCurrency(norm) || "AED";
  const direction = INCOME_HINTS.test(norm) && !EXPENSE_HINTS.test(norm) ? "income" : "expense";
  const cardLast4 = findLast4(norm);
  const merchant = findMerchant(text);
  return {
    id: uid(),
    rawText: text,
    amount,
    currency,
    direction,
    cardLast4,
    merchant,
    accountId: matchAccountByDigits(cardLast4, accounts),
    category:
      (merchant && guessCategory(normAr(merchant), direction)) ||
      guessCategory(norm, direction) ||
      (direction === "income" ? "Other income" : null),
    date: findDate(norm),
  };
}

/** Parse a pasted batch (multiple messages). Returns { items, skipped }.
    Bank alerts are one line each in practice; a failed line gets one merge
    attempt with the following line to catch two-line wrapped messages. */
export function parseSmsBatch(text, accounts = []) {
  const lines = String(text || "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const items = [];
  let skipped = 0;
  for (let i = 0; i < lines.length; i++) {
    const one = parseBankSms(lines[i], accounts);
    if (one) { items.push(one); continue; }
    const merged = i + 1 < lines.length ? parseBankSms(lines[i] + " " + lines[i + 1], accounts) : null;
    if (merged) { items.push(merged); i++; continue; }
    skipped++;
  }
  return { items, skipped };
}
