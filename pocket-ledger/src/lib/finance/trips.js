/* Trips (Aug 2026): a trip is a tag, not an account. Spends tagged with the
   trip id are summed in the trip's currency (converted per transaction), split
   personal vs work. Work total = what the company owes back. */
import { convert } from "./currency.js";

export function tripStats(trip, transactions, rates) {
  let personal = 0, work = 0, count = 0;
  const items = [];
  for (const t of transactions) {
    if (t.tripId !== trip.id || t.type !== "expense") continue;
    const v = convert(t.amount, t.currency, trip.currency, t.snapshot || rates);
    if (t.tripKind === "work") work += v; else personal += v;
    count++;
    items.push(t);
  }
  items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return { personal, work, total: personal + work, count, items };
}

export const openTrip = (trips) => (trips || []).find((t) => t.open) || null;
