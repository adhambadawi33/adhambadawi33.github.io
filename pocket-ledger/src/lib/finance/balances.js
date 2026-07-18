import { convertWithSnapshot } from "./currency.js";

/* Account balance model (handoff §7.2)
   balance = openingBalance + income - expense - outgoing transfers
             + incoming transfers +/- adjustments
   Credit cards: balance is a SIGNED ASSET value — debt is negative.
   A purchase decreases the balance; a card payment (transfer in) increases it
   toward zero. The UI shows Math.abs(balance) labelled "owed".
   Foreign-currency lines convert into the ACCOUNT currency using the
   transaction's own rate snapshot, so history never moves with today's rates. */
export function computeBalances(accounts, transactions) {
  const cur = {};
  const bal = {};
  for (const a of accounts) {
    cur[a.id] = a.currency;
    bal[a.id] = Number(a.openingBalance) || 0;
  }
  for (const t of transactions) {
    const snap = t.snapshot;
    if (t.type === "expense") {
      if (bal[t.accountId] === undefined) continue;
      bal[t.accountId] -= convertWithSnapshot(t.amount, t.currency, cur[t.accountId], snap);
    } else if (t.type === "income") {
      if (bal[t.accountId] === undefined) continue;
      bal[t.accountId] += convertWithSnapshot(t.amount, t.currency, cur[t.accountId], snap);
    } else if (t.type === "adjustment") {
      if (bal[t.accountId] === undefined) continue;
      bal[t.accountId] += t.amount; // signed, already in account currency
    } else if (t.type === "transfer") {
      /* Transfers store BOTH sides immutably (handoff §7.4). */
      if (bal[t.sourceAccountId] !== undefined) bal[t.sourceAccountId] -= t.sourceAmount;
      if (bal[t.destinationAccountId] !== undefined)
        bal[t.destinationAccountId] += t.destinationAmount;
    }
  }
  return bal;
}

/* Monthly totals for reports — uses snapshots only, so editing today's EGP
   rate never changes a past month (acceptance criterion 9). */
export function monthlyTotals(transactions, monthKey, base) {
  let income = 0;
  let expense = 0;
  const byCategory = {};
  for (const t of transactions) {
    if (!t.date?.startsWith(monthKey)) continue;
    if (t.type === "income") income += convertWithSnapshot(t.amount, t.currency, base, t.snapshot);
    else if (t.type === "expense") {
      const v = convertWithSnapshot(t.amount, t.currency, base, t.snapshot);
      expense += v;
      byCategory[t.category] = (byCategory[t.category] || 0) + v;
    }
  }
  return { income, expense, net: income - expense, byCategory };
}
