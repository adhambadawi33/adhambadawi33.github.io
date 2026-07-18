/* Live FX rates (batch 3). Free, keyless, CORS-open endpoint that returns
   units-per-1-USD — exactly our rate model (currency.js). The app refreshes
   once a day and on demand; offline it just keeps the last saved rates.
   Historical correctness is unaffected: transactions carry rate snapshots. */
import { CURRENCIES, sanitizeRates } from "./currency.js";

const ENDPOINT = "https://open.er-api.com/v6/latest/USD";

export async function fetchLiveRates(fetchImpl) {
  const f = fetchImpl || (typeof fetch === "function" ? fetch : null);
  if (!f) throw new Error("fetch unavailable");
  const res = await f(ENDPOINT, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`FX fetch failed: ${res.status}`);
  const json = await res.json();
  if (json?.result !== "success" || !json.rates) throw new Error("FX payload malformed");
  const next = { USD: 1 };
  for (const c of CURRENCIES) {
    if (c === "USD") continue;
    const v = Number(json.rates[c]);
    if (!(Number.isFinite(v) && v > 0)) throw new Error(`FX missing ${c}`);
    next[c] = Math.round(v * 10000) / 10000;
  }
  return sanitizeRates(next);
}
