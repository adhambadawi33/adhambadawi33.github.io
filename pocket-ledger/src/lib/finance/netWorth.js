import { convert } from "./currency.js";

/* Net worth (handoff §7.3): positive bank/cash/debit balances plus negative
   credit-card balances. Personal IOUs are shown separately by default
   (Decision A); settings.includeIousInNetWorth flips that. Live positions use
   CURRENT rates — historical reports use snapshots instead. */
export function netWorth(accounts, balances, base, rates) {
  return accounts
    .filter((a) => !a.archived)
    .reduce((sum, a) => sum + convert(balances[a.id] || 0, a.currency, base, rates), 0);
}

export function debtTotals(debts, base, rates) {
  let owedToMe = 0;
  let iOwe = 0;
  for (const d of debts) {
    const left = Math.max(0, d.amount - d.repaid);
    const v = convert(left, d.currency, base, rates);
    if (d.direction === "lent") owedToMe += v;
    else iOwe += v;
  }
  return { owedToMe, iOwe, net: owedToMe - iOwe };
}
