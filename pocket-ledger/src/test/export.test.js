import { describe, it, expect } from "vitest";
import { buildCsv } from "../lib/export/csv.js";
import { buildBackup, parseBackup, mergeData } from "../lib/export/backup.js";
import { normalizeData } from "../lib/validation/schema.js";

const seed = () =>
  normalizeData({
    schemaVersion: 3,
    accounts: [
      { id: "a", name: "Bank", type: "bank", currency: "AED", openingBalance: 0 },
      { id: "s", name: "Riyadh", type: "bank", currency: "SAR", openingBalance: 0 },
    ],
    transactions: [
      { id: "t1", type: "expense", date: "2026-07-01", amount: 100, currency: "AED", accountId: "a", category: "Food & Dining", note: 'he said "hi", ok' },
      { id: "t2", type: "transfer", date: "2026-07-02", sourceAccountId: "a", sourceAmount: 36.725, sourceCurrency: "AED", destinationAccountId: "s", destinationAmount: 37.5, destinationCurrency: "SAR", snapshot: { USD: 1, AED: 3.6725, SAR: 3.75, EGP: 50 } },
    ],
    settings: { base: "AED" },
  }).data;

describe("CSV export (handoff §4.9)", () => {
  it("starts with UTF-8 BOM, uses CRLF, escapes quotes, includes both transfer sides + base equivalent + snapshot", () => {
    const data = seed();
    const csv = buildCsv(data, (id) => data.accounts.find((a) => a.id === id)?.name || "—");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("\r\n");
    expect(csv).toContain('"he said ""hi"", ok"');
    const transferLine = csv.split("\r\n").find((l) => l.includes("t2"));
    expect(transferLine).toContain("Riyadh");
    expect(transferLine).toContain("37.5");
    expect(transferLine).toContain("SAR");
    expect(csv).toContain("base_equivalent_AED");
    expect(csv).toContain("3.6725");
  });
});

describe("JSON backup & restore (handoff §5.6)", () => {
  it("round-trips through buildBackup -> parseBackup with a summary", () => {
    const data = seed();
    const res = parseBackup(buildBackup(data));
    expect(res.error).toBeUndefined();
    expect(res.summary.accounts).toBe(2);
    expect(res.summary.transactions).toBe(2);
    expect(res.data.transactions.find((t) => t.id === "t2").destinationAmount).toBeCloseTo(37.5);
  });
  it("rejects invalid files with a clear error", () => {
    expect(parseBackup("not json").error).toBeTruthy();
    expect(parseBackup('{"hello":1}').error).toBeTruthy();
  });
  it("merge keeps current records and unions new ids", () => {
    const cur = seed();
    const incoming = seed();
    incoming.transactions.push({ ...incoming.transactions[0], id: "t3" });
    const merged = mergeData(cur, incoming);
    expect(merged.transactions).toHaveLength(3);
    expect(merged.accounts).toHaveLength(2);
  });
});
