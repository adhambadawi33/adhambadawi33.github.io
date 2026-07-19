import { describe, it, expect } from "vitest";
import { computeNudges, pickNudge } from "../lib/nudges.js";
import { todayISO, addDays } from "../lib/dates/localDate.js";

const rates = { USD: 1, EGP: 50, AED: 3.67, SAR: 3.75 };
const settings = { base: "EGP", rates, lastBackupAt: todayISO(), nudgeSnooze: {} };
const today = todayISO();

describe("gentle nudges (batch 10)", () => {
  it("warns when a card owes money and its due day is close", () => {
    const dueDay = Number(addDays(today, 3).slice(8, 10));
    const accounts = [{ id: "c1", name: "Arab Bank", type: "credit", currency: "EGP", dueDay, archived: false }];
    const n = computeNudges({ accounts, recurrs: [], plans: [], balances: { c1: -5000 }, settings });
    expect(n.some((x) => x.key === "card-due-c1")).toBe(true);
  });

  it("warns when an account can't cover its subscriptions due within 10 days", () => {
    const accounts = [{ id: "a1", name: "UAE", type: "debit", currency: "AED", archived: false }];
    const recurrs = [{ id: "s1", kind: "subscription", name: "Speechify", amount: 189, currency: "AED", nextDue: addDays(today, 5), accountId: "a1", paused: false }];
    const n = computeNudges({ accounts, recurrs, plans: [], balances: { a1: 50 }, settings });
    expect(n.some((x) => x.key === "low-a1")).toBe(true);
    const ok = computeNudges({ accounts, recurrs, plans: [], balances: { a1: 500 }, settings });
    expect(ok.some((x) => x.key === "low-a1")).toBe(false);
  });

  it("flags a heavy renewal week", () => {
    const accounts = [{ id: "a1", name: "Bank", type: "bank", currency: "EGP", archived: false }];
    const recurrs = [
      { id: "s1", kind: "subscription", name: "Claude", amount: 13000, currency: "EGP", nextDue: addDays(today, 2), accountId: null, paused: false },
      { id: "s2", kind: "subscription", name: "Netflix", amount: 175, currency: "EGP", nextDue: addDays(today, 4), accountId: null, paused: false },
    ];
    const n = computeNudges({ accounts, recurrs, plans: [], balances: { a1: 999999 }, settings });
    expect(n.some((x) => x.key === "heavy-week")).toBe(true);
  });

  it("nudges about a stale backup only when there is data worth losing", () => {
    const accounts = Array.from({ length: 5 }, (_, i) => ({ id: `a${i}`, name: `A${i}`, type: "bank", currency: "EGP", archived: false }));
    const stale = { ...settings, lastBackupAt: null };
    const n = computeNudges({ accounts, recurrs: [], plans: [], balances: {}, settings: stale });
    expect(n.some((x) => x.key === "backup")).toBe(true);
    const empty = computeNudges({ accounts: [], recurrs: [], plans: [], balances: {}, settings: stale });
    expect(empty.some((x) => x.key === "backup")).toBe(false);
  });

  it("pickNudge honors the 3-day snooze and falls through to the next nudge", () => {
    const nudges = [{ key: "a", text: "A" }, { key: "b", text: "B" }];
    expect(pickNudge(nudges, {}).key).toBe("a");
    expect(pickNudge(nudges, { a: today }).key).toBe("b");
    expect(pickNudge(nudges, { a: today, b: today })).toBeNull();
    expect(pickNudge(nudges, { a: addDays(today, -5) }).key).toBe("a");
  });
});
