import { convertWithSnapshot } from "./currency.js";
import { monthKeyOf, thisMonthKey } from "../dates/localDate.js";

/* Monthly report (handoff §5.5).
   All money converts into the BASE currency using each transaction's own rate
   snapshot — same rule as monthlyTotals, so a past month's report is frozen
   forever no matter what today's rates say. */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const monthLabel = (key) => {
  const m = /^(\d{4})-(\d{2})$/.exec(key || "");
  return m ? `${MONTHS[+m[2] - 1]} ${+m[1]}` : key || "";
};

export const prevMonthKey = (key) => {
  const [y, m] = key.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};
export const nextMonthKey = (key) => {
  const [y, m] = key.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

/* Which months the ‹ › arrows may visit: from the earliest transaction up to
   the current month (an empty ledger still gets the current month). */
export function monthsWithData(transactions, currentKey = thisMonthKey()) {
  const keys = new Set([currentKey]);
  for (const t of transactions) {
    const k = monthKeyOf(t.date);
    if (/^\d{4}-\d{2}$/.test(k)) keys.add(k);
  }
  return [...keys].sort();
}

export function monthReport({ transactions, recurrs = [], budgets = {} }, monthKey, base) {
  let income = 0;
  let expense = 0;
  let txCount = 0;
  const byCategory = {};
  const byOwner = {};
  const byAccount = {};
  const expenses = [];
  const subsCharged = [];

  for (const t of transactions) {
    if (!t.date?.startsWith(monthKey)) continue;
    if (t.type === "income") {
      income += convertWithSnapshot(t.amount, t.currency, base, t.snapshot);
      txCount++;
    } else if (t.type === "expense") {
      const v = convertWithSnapshot(t.amount, t.currency, base, t.snapshot);
      expense += v;
      txCount++;
      byCategory[t.category] = (byCategory[t.category] || 0) + v;
      const owner = t.owner || "me";
      byOwner[owner] = (byOwner[owner] || 0) + v;
      byAccount[t.accountId] = (byAccount[t.accountId] || 0) + v;
      expenses.push({ ...t, baseValue: v });
      if (t.category === "Subscriptions") {
        /* "Netflix · SMS" → "Netflix" — keep the human name, drop the tag. */
        const name = (t.note || "").replace(/\s*·\s*SMS\s*$/i, "").trim() || "Subscription";
        subsCharged.push({ id: t.id, name, date: t.date, baseValue: v });
      }
    }
  }

  const sortDesc = (obj) =>
    Object.entries(obj).map(([k, v]) => ({ key: k, v })).sort((a, b) => b.v - a.v);

  const categories = sortDesc(byCategory).map((c) => ({
    ...c,
    budget: budgets[c.key] > 0 ? budgets[c.key] : null,
  }));

  /* Subscriptions still to come only make sense for the running month:
     once a sub is paid its nextDue rolls past the month, and for past
     months every due date has already resolved one way or the other. */
  const subsDue =
    monthKey === thisMonthKey()
      ? recurrs
          .filter((r) => r.kind === "subscription" && !r.paused && monthKeyOf(r.nextDue) === monthKey)
          .map((r) => ({ id: r.id, name: r.name, due: r.nextDue, amount: r.amount, currency: r.currency }))
          .sort((a, b) => a.due.localeCompare(b.due))
      : [];

  const prevKey = prevMonthKey(monthKey);
  let prevExpense = 0;
  let prevHadExpense = false;
  for (const t of transactions) {
    if (t.type !== "expense" || !t.date?.startsWith(prevKey)) continue;
    prevExpense += convertWithSnapshot(t.amount, t.currency, base, t.snapshot);
    prevHadExpense = true;
  }

  return {
    monthKey,
    income,
    expense,
    net: income - expense,
    txCount,
    categories,
    owners: sortDesc(byOwner),
    accounts: sortDesc(byAccount),
    largest: expenses.sort((a, b) => b.baseValue - a.baseValue).slice(0, 5),
    subsCharged: subsCharged.sort((a, b) => a.date.localeCompare(b.date)),
    subsDue,
    prevExpense,
    prevHadExpense,
  };
}
