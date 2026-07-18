import { describe, it, expect } from "vitest";
import { normalizeData, SCHEMA_VERSION } from "../lib/validation/schema.js";

describe("schema & migration pipeline (handoff §4.4)", () => {
  it("blank input yields valid empty v3", () => {
    const { data, report } = normalizeData(null);
    expect(data.schemaVersion).toBe(SCHEMA_VERSION);
    expect(data.accounts).toEqual([]);
    expect(report.migratedFrom).toBe(0);
  });

  it("migrates v2 single-file data, repairing credit sign and quarantining junk", () => {
    const v2 = {
      accounts: [
        { id: "a", name: "Bank", type: "bank", currency: "AED", openingBalance: 100 },
        { id: "c", name: "Card", type: "credit", currency: "AED", openingBalance: 250 }, // wrong sign
        { name: "" }, // invalid -> quarantine
      ],
      transactions: [
        { id: "t1", type: "expense", date: "2026-07-01", amount: 50, currency: "AED", accountId: "a", category: "Food & Dining" },
        { id: "t2", type: "transfer", date: "2026-07-02", amount: 10, currency: "AED", accountId: "a", toAccountId: "c" }, // legacy transfer
        { id: "bad", type: "expense", date: "2026-07-03", amount: -5, currency: "AED", accountId: "a" }, // invalid amount
        { id: "orphan", type: "expense", date: "2026-07-03", amount: 5, currency: "AED", accountId: "ghost" }, // missing account
      ],
      recurrs: [{ id: "r1", kind: "installment", name: "Car", amount: 100, currency: "AED", nextDue: "2026-08-01", monthsTotal: 12, monthsPaid: 30 }],
      debts: [{ id: "d1", person: "Ali", direction: "lent", amount: 100, repaid: 500 }],
      settings: { base: "AED", rates: { USD: 1, AED: 3.6725, SAR: 3.75, EGP: 0 } }, // invalid EGP
    };
    const { data, report } = normalizeData(v2);
    expect(report.migratedFrom).toBe(2);
    expect(data.accounts).toHaveLength(2);
    expect(data.accounts.find((a) => a.id === "c").openingBalance).toBe(-250);
    // legacy transfer lifted to dual-side structure
    const tr = data.transactions.find((t) => t.id === "t2");
    expect(tr.sourceAccountId).toBe("a");
    expect(tr.destinationAccountId).toBe("c");
    expect(tr.sourceAmount).toBe(10);
    expect(tr.destinationAmount).toBeCloseTo(10);
    expect(tr.snapshot.AED).toBeCloseTo(3.6725);
    // invalid rows quarantined
    expect(data.transactions.find((t) => t.id === "bad")).toBeUndefined();
    expect(data.transactions.find((t) => t.id === "orphan")).toBeUndefined();
    expect(report.quarantined.length).toBeGreaterThanOrEqual(3);
    // installment months clamped, debt repaid clamped, rates repaired
    expect(data.recurrs[0].monthsPaid).toBe(12);
    expect(data.debts[0].repaid).toBe(100);
    expect(data.settings.rates.EGP).toBe(50);
  });

  it("migrates v1 dashboard data by creating imported per-currency accounts", () => {
    const v1 = {
      transactions: [
        { id: "1", type: "expense", date: "2026-06-01", amount: 100, currency: "EGP", category: "Groceries" },
        { id: "2", type: "income", date: "2026-06-02", amount: 5000, currency: "AED", category: "Salary" },
      ],
      budgets: { Groceries: 2000 },
      settings: { baseCurrency: "AED", rates: { USD: 1, AED: 3.6725, SAR: 3.75, EGP: 48 } },
    };
    const { data, report } = normalizeData(v1);
    expect(report.migratedFrom).toBe(1);
    expect(data.accounts).toHaveLength(2);
    expect(data.transactions).toHaveLength(2);
    expect(data.transactions.every((t) => data.accounts.some((a) => a.id === t.accountId))).toBe(true);
    expect(data.budgets.Groceries).toBe(2000);
    expect(data.settings.base).toBe("AED");
    expect(data.settings.rates.EGP).toBe(48);
  });

  it("existing v3 passes through and every tx carries a snapshot", () => {
    const first = normalizeData({ schemaVersion: 3, accounts: [{ id: "a", name: "X", type: "cash", currency: "AED" }], transactions: [{ id: "t", type: "income", date: "2026-07-01", amount: 5, currency: "AED", accountId: "a" }] }).data;
    const { data, report } = normalizeData(first);
    expect(report.migratedFrom).toBe(3);
    expect(data.transactions[0].snapshot).toBeTruthy();
    expect(data.transactions[0].snapshot.USD).toBe(1);
  });
});
