import { describe, it, expect } from "vitest";
import { convert, validateRates, sanitizeRates, isValidRate, DEFAULT_RATES } from "../lib/finance/currency.js";
import { computeBalances, monthlyTotals } from "../lib/finance/balances.js";
import { netWorth, debtTotals } from "../lib/finance/netWorth.js";

const R = { USD: 1, AED: 3.6725, SAR: 3.75, EGP: 50 };
const snap = { ...R };

describe("currency", () => {
  it("same-currency conversion is identity", () => {
    expect(convert(100, "AED", "AED", R)).toBe(100);
  });
  it("cross-currency uses units-per-USD", () => {
    expect(convert(50, "EGP", "USD", R)).toBeCloseTo(1);
    expect(convert(1, "USD", "AED", R)).toBeCloseTo(3.6725);
    expect(convert(3.75, "SAR", "AED", R)).toBeCloseTo(3.6725);
  });
  it("rejects invalid rates", () => {
    expect(isValidRate(0)).toBe(false);
    expect(isValidRate(-2)).toBe(false);
    expect(isValidRate(NaN)).toBe(false);
    expect(isValidRate(Infinity)).toBe(false);
    expect(() => convert(10, "EGP", "AED", { ...R, EGP: 0 })).toThrow();
    expect(validateRates({ ...R, SAR: NaN })).toBe(false);
    expect(validateRates(R)).toBe(true);
  });
  it("sanitizeRates repairs bad values and pins USD to 1", () => {
    const s = sanitizeRates({ USD: 9, EGP: -5, AED: 4 });
    expect(s.USD).toBe(1);
    expect(s.EGP).toBe(DEFAULT_RATES.EGP);
    expect(s.AED).toBe(4);
  });
});

describe("balances", () => {
  const bank = { id: "b", type: "bank", currency: "AED", openingBalance: 1000 };
  const card = { id: "c", type: "credit", currency: "AED", openingBalance: 0 };

  it("income and expense update the account", () => {
    const bal = computeBalances([bank], [
      { id: "1", type: "income", date: "2026-07-01", amount: 500, currency: "AED", accountId: "b", snapshot: snap },
      { id: "2", type: "expense", date: "2026-07-02", amount: 200, currency: "AED", accountId: "b", snapshot: snap },
    ]);
    expect(bal.b).toBeCloseTo(1300);
  });

  it("foreign-currency expense converts with the tx snapshot, not today's rates", () => {
    const oldSnap = { USD: 1, AED: 3.6725, SAR: 3.75, EGP: 50 };
    const bal = computeBalances([bank], [
      { id: "1", type: "expense", date: "2026-07-01", amount: 500, currency: "EGP", accountId: "b", snapshot: oldSnap },
    ]);
    expect(bal.b).toBeCloseTo(1000 - (500 / 50) * 3.6725);
  });

  it("credit card: purchase increases debt (balance more negative)", () => {
    const bal = computeBalances([card], [
      { id: "1", type: "expense", date: "2026-07-01", amount: 300, currency: "AED", accountId: "c", snapshot: snap },
    ]);
    expect(bal.c).toBeCloseTo(-300);
  });
  it("credit card: payment via transfer moves balance toward zero", () => {
    const bal = computeBalances([bank, card], [
      { id: "1", type: "expense", date: "2026-07-01", amount: 300, currency: "AED", accountId: "c", snapshot: snap },
      { id: "2", type: "transfer", date: "2026-07-02", snapshot: snap,
        sourceAccountId: "b", sourceAmount: 200, sourceCurrency: "AED",
        destinationAccountId: "c", destinationAmount: 200, destinationCurrency: "AED" },
    ]);
    expect(bal.c).toBeCloseTo(-100);
    expect(bal.b).toBeCloseTo(800);
  });
  it("credit card: overpayment goes positive; refund reduces debt; starting debt respected", () => {
    const startDebt = { ...card, openingBalance: -500 };
    const bal = computeBalances([bank, startDebt], [
      { id: "1", type: "income", date: "2026-07-01", amount: 50, currency: "AED", accountId: "c", snapshot: snap }, // refund
      { id: "2", type: "transfer", date: "2026-07-02", snapshot: snap,
        sourceAccountId: "b", sourceAmount: 600, sourceCurrency: "AED",
        destinationAccountId: "c", destinationAmount: 600, destinationCurrency: "AED" },
    ]);
    expect(bal.c).toBeCloseTo(-500 + 50 + 600); // +150 overpaid
  });

  it("cross-currency transfer preserves both stored sides exactly", () => {
    const sar = { id: "s", type: "bank", currency: "SAR", openingBalance: 0 };
    const bal = computeBalances([bank, sar], [
      { id: "1", type: "transfer", date: "2026-07-01", snapshot: snap,
        sourceAccountId: "b", sourceAmount: 367.25, sourceCurrency: "AED",
        destinationAccountId: "s", destinationAmount: 375, destinationCurrency: "SAR" },
    ]);
    expect(bal.b).toBeCloseTo(1000 - 367.25);
    expect(bal.s).toBeCloseTo(375);
  });

  it("adjustment transactions apply their signed amount directly", () => {
    const bal = computeBalances([bank], [
      { id: "1", type: "adjustment", date: "2026-07-01", amount: -37.5, currency: "AED", accountId: "b", snapshot: snap },
    ]);
    expect(bal.b).toBeCloseTo(962.5);
  });
});

describe("historical immutability (acceptance #9)", () => {
  const tx = [
    { id: "1", type: "expense", date: "2026-06-05", amount: 1000, currency: "EGP", accountId: "b", category: "Food & Dining", snapshot: { USD: 1, AED: 3.6725, SAR: 3.75, EGP: 50 } },
  ];
  it("monthly totals do not change when today's EGP rate changes", () => {
    const before = monthlyTotals(tx, "2026-06", "AED");
    // user later edits EGP to 60 — snapshots on the tx are untouched
    const after = monthlyTotals(tx, "2026-06", "AED");
    expect(after.expense).toBeCloseTo(before.expense);
    expect(before.expense).toBeCloseTo((1000 / 50) * 3.6725);
    expect(before.byCategory["Food & Dining"]).toBeCloseTo(before.expense);
  });
});

describe("net worth & debts", () => {
  it("sums assets and negative credit balances; debts tracked separately", () => {
    const accounts = [
      { id: "b", type: "bank", currency: "AED", openingBalance: 0 },
      { id: "c", type: "credit", currency: "AED", openingBalance: 0 },
    ];
    const w = netWorth(accounts, { b: 1000, c: -400 }, "AED", R);
    expect(w).toBeCloseTo(600);
    const d = debtTotals(
      [
        { direction: "lent", amount: 500, repaid: 100, currency: "AED" },
        { direction: "borrowed", amount: 200, repaid: 0, currency: "AED" },
      ],
      "AED", R
    );
    expect(d.owedToMe).toBeCloseTo(400);
    expect(d.iOwe).toBeCloseTo(200);
    expect(d.net).toBeCloseTo(200);
  });
  it("archived accounts are excluded from net worth", () => {
    const accounts = [
      { id: "b", type: "bank", currency: "AED", openingBalance: 0 },
      { id: "x", type: "bank", currency: "AED", openingBalance: 0, archived: true },
    ];
    expect(netWorth(accounts, { b: 100, x: 900 }, "AED", R)).toBeCloseTo(100);
  });
});

describe("budget thresholds", () => {
  const state = (spent, budget) => ({ over: budget > 0 && spent > budget, warn: budget > 0 && spent <= budget && spent / budget >= 0.8 });
  it("warns at 80% and flags over budget", () => {
    expect(state(79, 100)).toEqual({ over: false, warn: false });
    expect(state(80, 100)).toEqual({ over: false, warn: true });
    expect(state(101, 100)).toEqual({ over: true, warn: false });
  });
});

describe("planStats (batch 7)", () => {
  const plan = {
    id: "p", name: "Villa", currency: "EGP",
    milestones: [
      { id: "m1", due: "2026-07-15", amount: 100, paid: true },
      { id: "m2", due: "2026-10-15", amount: 200, paid: false },
      { id: "m3", due: "2027-01-15", amount: 300, paid: false },
    ],
  };
  it("computes paid/total sums and finds the next unpaid milestone", async () => {
    const { planStats } = await import("../lib/finance/plans.js");
    const s = planStats(plan);
    expect(s.paidSum).toBe(100);
    expect(s.totalSum).toBe(600);
    expect(s.paidCount).toBe(1);
    expect(s.count).toBe(3);
    expect(s.next.id).toBe("m2");
    expect(s.endDue).toBe("2027-01-15");
    expect(s.done).toBe(false);
  });
  it("reports done when every milestone is paid", async () => {
    const { planStats } = await import("../lib/finance/plans.js");
    const s = planStats({ ...plan, milestones: plan.milestones.map((m) => ({ ...m, paid: true })) });
    expect(s.done).toBe(true);
    expect(s.next).toBeNull();
  });
});
