import { describe, it, expect } from "vitest";
import { isGift, collectGifts, giftsTotal } from "../lib/finance/gifts.js";

const rates = { USD: 1, AED: 3.6725, SAR: 3.75, EGP: 50.8808, EUR: 0.856 };

describe("isGift", () => {
  it("takes the explicit flag", () => {
    expect(isGift({ gift: true, note: "" })).toBe(true);
  });
  it("reads an Arabic note", () => {
    expect(isGift({ note: "هدية عيد ميلاد عبير" })).toBe(true);
    expect(isGift({ note: "هدايا الأولاد" })).toBe(true);
    expect(isGift({ note: "Gift for Sameh" })).toBe(true);
  });
  it("does not fire on lookalikes", () => {
    /* "هداية ستور" is a shop name, not a gift. */
    expect(isGift({ note: "هداية ستور" })).toBe(false);
    expect(isGift({ note: "طلبات المعادي" })).toBe(false);
    expect(isGift(null)).toBe(false);
  });
});

describe("collectGifts", () => {
  const debts = [
    { id: "d1", person: "أحمد علاء", direction: "lent", noReturn: true, amount: 350000, currency: "EGP", note: "هدية فرح", date: "2026-09-06" },
    { id: "d2", person: "محمد أيمن", direction: "lent", noReturn: true, amount: 70020, currency: "EGP", note: "مستشفى", date: "2026-08-23" },
    { id: "d3", person: "هادي", direction: "lent", noReturn: false, amount: 300000, currency: "EGP", note: "هدية", date: "2026-08-13" },
  ];
  const txs = [
    { id: "t1", type: "expense", amount: 630, currency: "AED", note: "سواروفسكي — هدية لعبير", date: "2026-09-04", owner: "me" },
    { id: "t2", type: "expense", amount: 99, currency: "EGP", note: "طلبات برو", date: "2026-09-01", owner: "abeer" },
    { id: "t3", type: "income", amount: 500, currency: "EGP", note: "هدية واردة", date: "2026-09-02" },
  ];

  it("pulls gifts from both sides and leaves the rest", () => {
    const g = collectGifts(debts, txs);
    expect(g.map((x) => x.id)).toEqual(["debt:d1", "tx:t1"]);
  });
  it("excludes help given, loans, non-expenses and ordinary spend", () => {
    const g = collectGifts(debts, txs);
    expect(g.find((x) => x.id === "debt:d2")).toBeUndefined();
    expect(g.find((x) => x.id === "debt:d3")).toBeUndefined();
    expect(g.find((x) => x.id === "tx:t2")).toBeUndefined();
    expect(g.find((x) => x.id === "tx:t3")).toBeUndefined();
  });
  it("sorts newest first", () => {
    const g = collectGifts(debts, txs);
    expect(g[0].date >= g[1].date).toBe(true);
  });
  it("totals across currencies in the base", () => {
    const g = collectGifts(debts, txs);
    const total = giftsTotal(g, "EGP", rates);
    expect(Math.round(total)).toBe(350000 + Math.round((630 / 3.6725) * 50.8808));
  });
  it("copes with empty input", () => {
    expect(collectGifts()).toEqual([]);
    expect(giftsTotal([], "EGP", rates)).toBe(0);
  });
});
