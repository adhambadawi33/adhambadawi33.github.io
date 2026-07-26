import { addCycle } from "../dates/localDate.js";

/* Logging a "Subscriptions" expense keeps the Planned list honest (Adham):
   a note matching a planned sub counts as its renewal (next due moves one
   cycle); an unknown name becomes a new planned subscription on the spot.
   Returns { recurrs, toast } — recurrs unchanged (same reference) when the
   transaction shouldn't touch the planned list. */
export function syncSubscriptionOnTx(recurrs, tx, uid) {
  const none = { recurrs, toast: null };
  if (tx.type !== "expense" || tx.category !== "Subscriptions") return none;
  const note = (tx.note || "").trim();
  if (!note) return none;
  const needle = note.toLowerCase();
  const match = recurrs.find(
    (r) =>
      r.kind === "subscription" &&
      (r.name.toLowerCase().includes(needle) || needle.includes(r.name.toLowerCase()))
  );
  if (match) {
    /* A paused sub matching by name: leave it alone rather than duplicate
       it or silently resume it — the user paused it on purpose. */
    if (match.paused) return none;
    return {
      recurrs: recurrs.map((r) =>
        r.id === match.id ? { ...r, nextDue: addCycle(r.nextDue, r.cycle) } : r
      ),
      toast: `Renewed: ${match.name}`,
    };
  }
  const sub = {
    id: uid(), kind: "subscription", name: note, amount: tx.amount, currency: tx.currency,
    cycle: "monthly", nextDue: addCycle(tx.date, "monthly"), accountId: tx.accountId || null,
    owner: tx.owner || "me", paused: false, toCancel: false,
  };
  return { recurrs: [...recurrs, sub], toast: `Added to planned: ${sub.name}` };
}
