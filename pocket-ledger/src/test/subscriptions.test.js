import { describe, it, expect } from "vitest";
import { syncSubscriptionOnTx } from "../lib/finance/subscriptions.js";

let n = 0;
const uid = () => `t${++n}`;

const netflix = {
  id: "r1", kind: "subscription", name: "Netflix", amount: 56, currency: "AED",
  cycle: "monthly", nextDue: "2026-08-01", accountId: "a1", owner: "me", paused: false, toCancel: false,
};
const carLoan = {
  id: "r2", kind: "installment", name: "Car loan", amount: 2000, currency: "AED",
  cycle: "monthly", nextDue: "2026-08-05", accountId: "a1", owner: "me", paused: false, toCancel: false,
  monthsTotal: 24, monthsPaid: 3,
};
const tx = (over = {}) => ({
  id: "x1", type: "expense", date: "2026-07-22", amount: 56, currency: "AED",
  accountId: "a1", category: "Subscriptions", note: "Netflix", owner: "me", ...over,
});

describe("syncSubscriptionOnTx", () => {
  it("ignores non-subscription transactions", () => {
    const recurrs = [netflix];
    expect(syncSubscriptionOnTx(recurrs, tx({ category: "Food" }), uid).recurrs).toBe(recurrs);
    expect(syncSubscriptionOnTx(recurrs, tx({ type: "income", category: "Salary" }), uid).recurrs).toBe(recurrs);
  });

  it("ignores a subscription expense with no note — nothing to name or match", () => {
    const recurrs = [netflix];
    const out = syncSubscriptionOnTx(recurrs, tx({ note: "" }), uid);
    expect(out.recurrs).toBe(recurrs);
    expect(out.toast).toBeNull();
  });

  it("renews a matching planned subscription one cycle forward", () => {
    const out = syncSubscriptionOnTx([netflix], tx(), uid);
    expect(out.recurrs[0].nextDue).toBe("2026-09-01");
    expect(out.toast).toBe("Renewed: Netflix");
  });

  it("matches case-insensitively and by partial note", () => {
    const out = syncSubscriptionOnTx([netflix], tx({ note: "netflix family plan" }), uid);
    expect(out.recurrs[0].nextDue).toBe("2026-09-01");
    expect(out.recurrs).toHaveLength(1);
  });

  it("respects the sub's own cycle when renewing", () => {
    const yearly = { ...netflix, name: "iCloud", cycle: "yearly", nextDue: "2026-08-01" };
    const out = syncSubscriptionOnTx([yearly], tx({ note: "iCloud" }), uid);
    expect(out.recurrs[0].nextDue).toBe("2027-08-01");
  });

  it("never renews or duplicates a paused subscription", () => {
    const recurrs = [{ ...netflix, paused: true }];
    const out = syncSubscriptionOnTx(recurrs, tx(), uid);
    expect(out.recurrs).toBe(recurrs);
    expect(out.toast).toBeNull();
  });

  it("never matches installments — a same-named installment stays untouched", () => {
    const out = syncSubscriptionOnTx([carLoan], tx({ note: "Car loan" }), uid);
    expect(out.recurrs.find((r) => r.id === "r2").nextDue).toBe("2026-08-05");
    expect(out.recurrs).toHaveLength(2);
    expect(out.recurrs[1].kind).toBe("subscription");
  });

  it("auto-adds an unknown subscription from the transaction", () => {
    const out = syncSubscriptionOnTx([netflix], tx({ note: "Spotify", amount: 20 }), uid);
    expect(out.recurrs).toHaveLength(2);
    const sub = out.recurrs[1];
    expect(sub).toMatchObject({
      kind: "subscription", name: "Spotify", amount: 20, currency: "AED",
      cycle: "monthly", accountId: "a1", owner: "me", paused: false, toCancel: false,
    });
    expect(sub.nextDue).toBe("2026-08-22");
    expect(out.toast).toBe("Added to planned: Spotify");
  });

  it("clamps the auto-added next renewal at month end", () => {
    const out = syncSubscriptionOnTx([], tx({ note: "Gym", date: "2026-01-31" }), uid);
    expect(out.recurrs[0].nextDue).toBe("2026-02-28");
  });
});
