import { convert } from "./currency.js";

/* Gifts live in two places: money handed over (a People entry marked "no return")
   and things bought for someone (an ordinary expense). This pulls both into one
   list so the People screen can show every gift together.

   Tagging is opt-in via `gift: true`, but existing entries are picked up from
   their note as well — the ledger is already full of "هدية …" lines and nobody
   should have to re-tag two hundred rows to see them. */
const GIFT_WORDS = /(هدية|هديه|هدايا|gift)/i;

export function isGift(x) {
  if (!x) return false;
  if (x.gift === true) return true;
  return GIFT_WORDS.test(x.note || "");
}

/* A gift entry is normalised to one shape whatever it came from, so the row
   component never has to branch on the source. */
function fromDebt(d) {
  return {
    id: `debt:${d.id}`,
    source: "debt",
    who: d.person,
    what: d.note || "",
    amount: d.amount,
    currency: d.currency,
    date: d.date,
    owner: "me",
    ref: d,
  };
}

function fromTransaction(t) {
  return {
    id: `tx:${t.id}`,
    source: "transaction",
    who: "",
    what: t.note || "",
    amount: t.amount,
    currency: t.currency,
    date: t.date,
    owner: t.owner || "me",
    ref: t,
  };
}

/* Only outgoing money counts: a gift you gave. Money given with no return is a
   debt row; a gift you bought is an expense. Nothing else qualifies. */
export function collectGifts(debts = [], transactions = []) {
  const out = [];
  for (const d of debts) {
    if (d && d.direction === "lent" && d.noReturn && isGift(d)) out.push(fromDebt(d));
  }
  /* The same gift is often recorded twice on purpose — once as money leaving
     an account (expense) and once as a People entry naming who got it. Show
     it once: the People entry wins because it carries the name. */
  const seen = new Set(out.map((g) => `${g.date}|${g.currency}|${Math.round(g.amount * 100)}`));
  for (const t of transactions) {
    if (!(t && t.type === "expense" && isGift(t))) continue;
    const key = `${t.date}|${t.currency}|${Math.round(t.amount * 100)}`;
    if (seen.has(key)) continue;
    out.push(fromTransaction(t));
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function giftsTotal(gifts, base, rates) {
  return gifts.reduce((sum, g) => sum + convert(g.amount, g.currency, base, rates), 0);
}
