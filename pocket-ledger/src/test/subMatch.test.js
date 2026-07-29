import { describe, it, expect } from "vitest";
import { matchPendingToSub, subAfterPayment } from "../lib/finance/subMatch.js";
import { addCycle, todayISO, addDays } from "../lib/dates/localDate.js";

const rates = { USD: 1, EGP: 50, AED: 3.67, SAR: 3.75 };
const today = todayISO();
const subs = [
  { id: "s-netflix", kind: "subscription", name: "Netflix", amount: 175.1, currency: "EGP", cycle: "monthly", nextDue: addDays(today, 2), paused: false },
  { id: "s-claude", kind: "subscription", name: "Claude Pro (Anthropic direct)", amount: 22.8, currency: "USD", cycle: "monthly", nextDue: addDays(today, 1), paused: false },
  { id: "s-gym", kind: "subscription", name: "Gym", amount: 800, currency: "EGP", cycle: "monthly", nextDue: addDays(today, 60), paused: false },
];

describe("SMS → subscription matching (batch 15)", () => {
  it("matches by name even with a different amount", () => {
    const p = { rawText: "خصم 200.00 جم لدى NETFLIX.COM بطاقة ****9972", merchant: "NETFLIX.COM", amount: 200, currency: "EGP", date: today };
    const m = matchPendingToSub(p, subs, rates);
    expect(m?.sub.id).toBe("s-netflix");
    expect(m?.byName).toBe(true);
  });
  it("matches by amount + renewal proximity when the SMS has no name", () => {
    const p = { rawText: "خصم مبلغ 176.00 جم من بطاقة ****3889", merchant: "", amount: 176, currency: "EGP", date: today };
    const m = matchPendingToSub(p, subs, rates);
    expect(m?.sub.id).toBe("s-netflix");
    expect(m?.byName).toBe(false);
  });
  it("matches across currencies (USD sub charged in EGP)", () => {
    const p = { rawText: "خصم 1140.00 جم", merchant: "", amount: 1140, currency: "EGP", date: today };
    const m = matchPendingToSub(p, subs, rates);
    expect(m?.sub.id).toBe("s-claude"); // 1140/50 = 22.8 USD exactly
  });
  it("refuses far-off dates and far-off amounts", () => {
    const farDate = { rawText: "خصم 800 جم", merchant: "", amount: 800, currency: "EGP", date: today }; // gym due in 60d
    expect(matchPendingToSub(farDate, subs, rates)).toBeNull();
    const farAmount = { rawText: "خصم 900 جم", merchant: "", amount: 900, currency: "EGP", date: today };
    expect(matchPendingToSub(farAmount, subs, rates)).toBeNull();
  });
  it("subAfterPayment advances the cycle and adopts a same-currency price change", () => {
    const out = subAfterPayment(subs[0], { amount: 200, currency: "EGP" }, addCycle);
    expect(out.nextDue).toBe(addCycle(subs[0].nextDue, "monthly"));
    expect(out.amount).toBe(200);
    const fx = subAfterPayment(subs[1], { amount: 1140, currency: "EGP" }, addCycle);
    expect(fx.amount).toBe(22.8); // FX charge ≠ price change
  });
});

describe("Talabat food orders must not claim Talabat Pro (Adham's real SMS)", () => {
  const talabatSubs = [
    { id: "s-tpro", kind: "subscription", name: "Talabat Pro", amount: 99, currency: "EGP", cycle: "monthly", nextDue: addDays(today, 30), paused: false },
  ];
  it("a 334.80 food order at Talabat does NOT match the 99 EGP sub", () => {
    const p = { rawText: "تم خصم EGP 334.80 باستخدام Apple Pay عند Talabat", merchant: "Talabat", amount: 334.8, currency: "EGP", date: today };
    expect(matchPendingToSub(p, talabatSubs, rates)).toBeNull();
  });
  it("the real talabat pro 99 EGP charge still matches by name+amount", () => {
    const p = { rawText: "تم خصم مبلغ EGP 99.00 عند talabat pro", merchant: "talabat pro", amount: 99, currency: "EGP", date: today };
    const m = matchPendingToSub(p, talabatSubs, rates);
    expect(m?.sub.id).toBe("s-tpro");
    expect(m?.byName).toBe(true);
  });
});
