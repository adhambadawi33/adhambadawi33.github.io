/* Currency model (handoff §7.1)
   Rates are stored as units of each currency per 1 USD.
   amountInTarget = amount / rate[from] * rate[to] */
export const CURRENCIES = ["AED", "SAR", "EGP", "USD"];
export const DEFAULT_RATES = { USD: 1, AED: 3.6725, SAR: 3.75, EGP: 50 };

export const isValidRate = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
export const validateRates = (rates) =>
  !!rates && CURRENCIES.every((c) => isValidRate(rates[c])) && rates.USD === 1;

export function sanitizeRates(rates) {
  const out = { ...DEFAULT_RATES };
  if (rates && typeof rates === "object") {
    for (const c of CURRENCIES) if (isValidRate(rates[c])) out[c] = rates[c];
  }
  out.USD = 1;
  return out;
}

export function convert(amount, from, to, rates) {
  if (from === to) return amount;
  if (!isValidRate(rates?.[from]) || !isValidRate(rates?.[to])) {
    throw new Error(`Invalid exchange rate for ${from}->${to}`);
  }
  return (amount / rates[from]) * rates[to];
}

/* Historical correctness (handoff §7.5): every transaction carries the rate
   snapshot taken at entry time. Reports must convert with tx.snapshot, never
   with today's rates. */
export const snapshotRates = (rates) => sanitizeRates(rates);
export const convertWithSnapshot = (amount, from, to, snapshot) =>
  convert(amount, from, to, sanitizeRates(snapshot));
