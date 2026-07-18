import { normalizeData } from "../validation/schema.js";

/* Full JSON backup + validated restore with summary (handoff §5.6).
   Restore modes: "replace" or "merge" (merge = union by id, imported wins on new ids only). */
export const buildBackup = (data) =>
  JSON.stringify({ app: "pocket-ledger", exportedAt: new Date().toISOString(), data }, null, 2);

export function parseBackup(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { return { error: "This file is not valid JSON." }; }
  const payload = raw && typeof raw === "object" && "data" in raw ? raw.data : raw;
  const { data, report } = normalizeData(payload);
  if (!data.accounts.length && !data.transactions.length && !data.debts.length && !data.recurrs.length && !data.plans.length) {
    return { error: "No recognizable Pocket Ledger data found in this file." };
  }
  return {
    data, report,
    summary: {
      accounts: data.accounts.length,
      transactions: data.transactions.length,
      recurring: data.recurrs.length,
      debts: data.debts.length,
      plans: data.plans.length,
    },
  };
}

export function mergeData(current, incoming) {
  const byId = (arr) => new Set(arr.map((x) => x.id));
  const merged = { ...incoming, meta: current.meta, settings: current.settings };
  for (const k of ["accounts", "transactions", "recurrs", "debts", "plans"]) {
    const have = byId(current[k] || []);
    merged[k] = [...(current[k] || []), ...(incoming[k] || []).filter((x) => !have.has(x.id))];
  }
  merged.budgets = { ...incoming.budgets, ...current.budgets };
  return merged;
}
