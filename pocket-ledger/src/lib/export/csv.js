import { convertWithSnapshot } from "../finance/currency.js";
import { todayISO } from "../dates/localDate.js";

/* CSV export hardening (handoff §4.9): UTF-8 BOM for Excel/Arabic, ISO dates,
   safe escaping, IDs, both transfer sides, base equivalent + rate snapshot. */
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function buildCsv(data, accountName) {
  const base = data.settings.base;
  const head = [
    "id", "date", "type", "category", "amount", "currency", "account",
    "destination_account", "destination_amount", "destination_currency",
    `base_equivalent_${base}`, "rate_snapshot", "note",
  ];
  const rows = data.transactions.map((t) => {
    const isTr = t.type === "transfer";
    const amount = isTr ? t.sourceAmount : t.amount;
    const currency = isTr ? t.sourceCurrency : t.currency;
    const baseEq = convertWithSnapshot(amount, currency, base, t.snapshot);
    return [
      t.id, t.date, t.type, isTr ? "Transfer" : t.category, amount, currency,
      accountName(isTr ? t.sourceAccountId : t.accountId),
      isTr ? accountName(t.destinationAccountId) : "",
      isTr ? t.destinationAmount : "", isTr ? t.destinationCurrency : "",
      baseEq.toFixed(2), JSON.stringify(t.snapshot), t.note || "",
    ];
  });
  return "\uFEFF" + [head, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}

export function downloadText(text, filename, mime = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const stampedName = (prefix, ext) => {
  const d = new Date();
  const hm = `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  return `${prefix}-${todayISO(d).replaceAll("-", "")}-${hm}.${ext}`;
};
