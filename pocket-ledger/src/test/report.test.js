import { describe, it, expect } from "vitest";
import { monthReport, monthsWithData, monthLabel, prevMonthKey, nextMonthKey } from "../lib/finance/report.js";
import { thisMonthKey, todayISO, addMonthsClamped } from "../lib/dates/localDate.js";

const SNAP = { USD: 1, AED: 3.6725, SAR: 3.75, EGP: 50 };
const tx = (over) => ({
  id: over.id || Math.random().toString(36).slice(2),
  type: "expense", date: "2026-07-10", amount: 100, currency: "EGP",
  accountId: "a1", category: "Groceries", note: "", owner: "me", snapshot: SNAP,
  ...over,
});

describe("month keys and labels", () => {
  it("labels a month key in plain English", () => {
    expect(monthLabel("2026-07")).toBe("July 2026");
    expect(monthLabel("2026-01")).toBe("January 2026");
  });
  it("steps across year boundaries", () => {
    expect(prevMonthKey("2026-01")).toBe("2025-12");
    expect(nextMonthKey("2025-12")).toBe("2026-01");
    expect(prevMonthKey("2026-07")).toBe("2026-06");
    expect(nextMonthKey("2026-07")).toBe("2026-08");
  });
  it("monthsWithData: sorted, deduped, always includes the current month", () => {
    const months = monthsWithData(
      [tx({ date: "2026-05-03" }), tx({ date: "2026-05-28" }), tx({ date: "2026-07-01" }), tx({ date: "bad" })],
      "2026-07"
    );
    expect(months).toEqual(["2026-05", "2026-07"]);
    expect(monthsWithData([], "2026-07")).toEqual(["2026-07"]);
  });
});

describe("monthReport", () => {
  it("totals income/expense/net in base using each transaction's own snapshot", () => {
    const oldSnap = { ...SNAP, EGP: 25 }; // 1 USD = 25 EGP back then
    const r = monthReport(
      {
        transactions: [
          tx({ amount: 100, currency: "EGP" }),
          // 100 AED at the OLD snapshot → 100/3.6725*25 ≈ 680.74 EGP, not today's 50-rate value
          tx({ amount: 100, currency: "AED", snapshot: oldSnap }),
          tx({ type: "income", amount: 1000, currency: "EGP", category: "Salary" }),
        ],
      },
      "2026-07", "EGP"
    );
    expect(r.income).toBeCloseTo(1000);
    expect(r.expense).toBeCloseTo(100 + (100 / 3.6725) * 25, 1);
    expect(r.net).toBeCloseTo(r.income - r.expense);
    expect(r.txCount).toBe(3);
  });

  it("ignores transfers, adjustments and other months", () => {
    const r = monthReport(
      {
        transactions: [
          tx({}),
          tx({ type: "transfer", sourceAmount: 500, amount: 500 }),
          tx({ type: "adjustment", amount: -30, category: "Adjustment" }),
          tx({ date: "2026-06-30" }),
        ],
      },
      "2026-07", "EGP"
    );
    expect(r.txCount).toBe(1);
    expect(r.expense).toBeCloseTo(100);
  });

  it("sorts categories by spend and attaches budgets only where set", () => {
    const r = monthReport(
      {
        transactions: [tx({ category: "Transport", amount: 50 }), tx({ category: "Groceries", amount: 300 })],
        budgets: { Groceries: 250, Travel: 900 },
      },
      "2026-07", "EGP"
    );
    expect(r.categories.map((c) => c.key)).toEqual(["Groceries", "Transport"]);
    expect(r.categories[0].budget).toBe(250); // over it — the UI colors that
    expect(r.categories[1].budget).toBeNull();
  });

  it("splits spending by owner (missing owner counts as me) and by account", () => {
    const r = monthReport(
      {
        transactions: [
          tx({ amount: 100, owner: undefined }),
          tx({ amount: 200, owner: "abeer", accountId: "a2" }),
          tx({ amount: 50, owner: "abeer" }),
        ],
      },
      "2026-07", "EGP"
    );
    expect(r.owners).toEqual([
      { key: "abeer", v: 250 },
      { key: "me", v: 100 },
    ]);
    expect(r.accounts.map((a) => a.key)).toEqual(["a2", "a1"]);
  });

  it("keeps only the five largest expenses, biggest first", () => {
    const txs = [10, 60, 20, 90, 40, 30, 80].map((amount, i) => tx({ id: `t${i}`, amount }));
    const r = monthReport({ transactions: txs }, "2026-07", "EGP");
    expect(r.largest.map((x) => x.amount)).toEqual([90, 80, 60, 40, 30]);
    expect(r.largest[0].baseValue).toBeCloseTo(90);
  });

  it("lists subscription charges by name, stripping the SMS tag", () => {
    const r = monthReport(
      {
        transactions: [
          tx({ category: "Subscriptions", note: "Netflix · SMS", date: "2026-07-15" }),
          tx({ category: "Subscriptions", note: "iCloud", date: "2026-07-02" }),
          tx({ category: "Subscriptions", note: "", date: "2026-07-20" }),
        ],
      },
      "2026-07", "EGP"
    );
    expect(r.subsCharged.map((s) => s.name)).toEqual(["iCloud", "Netflix", "Subscription"]);
  });

  it("shows still-due subscriptions only for the running month", () => {
    const cur = thisMonthKey();
    const due = todayISO();
    const recurrs = [
      { id: "s1", kind: "subscription", name: "Spotify", amount: 20, currency: "AED", nextDue: due, paused: false },
      { id: "s2", kind: "subscription", name: "Paused", amount: 9, currency: "AED", nextDue: due, paused: true },
      { id: "s3", kind: "installment", name: "Car", amount: 900, currency: "AED", nextDue: due, paused: false },
      { id: "s4", kind: "subscription", name: "Later", amount: 5, currency: "AED", nextDue: addMonthsClamped(due, 2), paused: false },
    ];
    const now = monthReport({ transactions: [], recurrs }, cur, "EGP");
    expect(now.subsDue.map((s) => s.name)).toEqual(["Spotify"]);
    const past = monthReport({ transactions: [], recurrs }, prevMonthKey(cur), "EGP");
    expect(past.subsDue).toEqual([]);
  });

  it("compares against the whole previous month", () => {
    const r = monthReport(
      { transactions: [tx({ amount: 300 }), tx({ date: "2026-06-05", amount: 100 }), tx({ date: "2026-06-28", amount: 50 })] },
      "2026-07", "EGP"
    );
    expect(r.prevExpense).toBeCloseTo(150);
    expect(r.prevHadExpense).toBe(true);
    const empty = monthReport({ transactions: [tx({})] }, "2026-09", "EGP");
    expect(empty.prevHadExpense).toBe(false);
  });
});
