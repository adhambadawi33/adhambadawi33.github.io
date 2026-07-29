/* Match an approved bank-SMS item to the subscription it pays (batch 15).
   Adham's flow: subscriptions charge via SMS → approving the expense should
   also tick the subscription as paid. The SMS doesn't always carry the
   service name, so matching works two ways:
     1. by NAME — a word from the subscription's name appears in the message;
     2. by SHAPE — the amount is close (±15%, converted across currencies)
        AND the charge lands near the renewal date (±7 days).
   The inbox card SHOWS the match before approval, so a wrong guess is
   visible and unlinkable — nothing silent. */
import { normAr } from "../voice/parse.js";
import { convert } from "./currency.js";
import { diffDays } from "../dates/localDate.js";

const AMOUNT_TOLERANCE = 0.15;
const DATE_WINDOW_DAYS = 7;

const nameTokens = (name) =>
  normAr(String(name)).split(/[^a-z0-9؀-ۿ]+/).filter((w) => w.length >= 4);

export function matchPendingToSub(pending, recurrs, rates) {
  const subs = recurrs.filter((r) => r.kind === "subscription" && !r.paused);
  if (!subs.length || !(pending?.amount > 0)) return null;
  const text = normAr(`${pending.rawText || ""} ${pending.merchant || ""}`);

  /* 1 — name match wins, but the name alone isn't enough: a Talabat FOOD
     order must not claim the "Talabat Pro" subscription. The amount must be
     in the neighbourhood (±25%) or the charge must land near the renewal. */
  for (const s of subs) {
    if (!nameTokens(s.name).some((t) => text.includes(t))) continue;
    const paid = convert(pending.amount, pending.currency, s.currency, rates);
    const amtDiff = Math.abs(paid - s.amount) / s.amount;
    const dateDiff = Math.abs(diffDays(pending.date, s.nextDue));
    if (amtDiff <= 0.25 || (!Number.isNaN(dateDiff) && dateDiff <= DATE_WINDOW_DAYS)) {
      return { sub: s, byName: true };
    }
  }

  /* 2 — closest by amount shape + renewal proximity */
  let best = null;
  for (const s of subs) {
    const paid = convert(pending.amount, pending.currency, s.currency, rates);
    const amtDiff = Math.abs(paid - s.amount) / s.amount;
    if (amtDiff > AMOUNT_TOLERANCE) continue;
    const dateDiff = Math.abs(diffDays(pending.date, s.nextDue));
    if (Number.isNaN(dateDiff) || dateDiff > DATE_WINDOW_DAYS) continue;
    const score = dateDiff + amtDiff * 20;
    if (!best || score < best.score) best = { sub: s, byName: false, score };
  }
  return best ? { sub: best.sub, byName: false } : null;
}

/* Advance the matched subscription one cycle; adopt the newly charged price
   when it moved (same currency only — FX noise is not a price change). */
export function subAfterPayment(sub, pending, addCycle) {
  const out = { ...sub, nextDue: addCycle(sub.nextDue, sub.cycle) };
  if (pending.currency === sub.currency && Math.abs(pending.amount - sub.amount) > 0.5) {
    out.amount = pending.amount;
  }
  return out;
}
