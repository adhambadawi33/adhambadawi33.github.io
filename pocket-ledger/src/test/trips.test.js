import { describe, it, expect } from "vitest";
import { normalizeData, SCHEMA_VERSION } from "../lib/validation/schema.js";
import { tripStats, openTrip } from "../lib/finance/trips.js";
import { mergeData } from "../lib/export/backup.js";

const rates = { USD: 1, AED: 3.6725, SAR: 3.75, EGP: 50, EUR: 0.9 };
const raw = {
  schemaVersion: SCHEMA_VERSION,
  accounts: [
    { id: "card", name: "Arab Card", type: "credit", currency: "EGP", openingBalance: 0 },
    { id: "cash", name: "Cash USD", type: "cash", currency: "USD", openingBalance: 10000 },
  ],
  trips: [{ id: "dubai", name: "Dubai — Aug 2026", currency: "AED", startDate: "2026-08-16", open: true }],
  transactions: [
    { id: "t1", type: "expense", date: "2026-08-17", amount: 12219, currency: "EGP", accountId: "card", category: "Travel", tripId: "dubai", tripKind: "work", snapshot: rates },
    { id: "t2", type: "expense", date: "2026-08-18", amount: 478, currency: "USD", accountId: "cash", category: "Shopping", tripId: "dubai", tripKind: "personal", snapshot: rates },
    { id: "t3", type: "expense", date: "2026-08-18", amount: 100, currency: "EGP", accountId: "card", category: "Food & Dining", snapshot: rates },
    { id: "t4", type: "expense", date: "2026-08-18", amount: 5, currency: "EGP", accountId: "card", category: "Other", tripId: "ghost", tripKind: "work", snapshot: rates },
  ],
  settings: { base: "EGP", rates },
};

describe("trips (Aug 2026)", () => {
  it("normalizes trips and keeps the trip tag on transactions; drops orphan tags", () => {
    const { data } = normalizeData(raw);
    expect(data.trips).toHaveLength(1);
    expect(data.trips[0]).toMatchObject({ id: "dubai", currency: "AED", open: true, endDate: null, settledDebtId: null });
    const t1 = data.transactions.find((t) => t.id === "t1");
    expect(t1.tripId).toBe("dubai");
    expect(t1.tripKind).toBe("work");
    const t3 = data.transactions.find((t) => t.id === "t3");
    expect(t3.tripId).toBeUndefined();
    const t4 = data.transactions.find((t) => t.id === "t4");
    expect(t4.tripId).toBeUndefined(); // orphan trip id dropped
  });
  it("sums personal vs work in the trip currency", () => {
    const { data } = normalizeData(raw);
    const s = tripStats(data.trips[0], data.transactions, rates);
    expect(s.count).toBe(2);
    expect(s.work).toBeCloseTo(12219 / 50 * 3.6725, 0); // ≈ 897 AED
    expect(s.personal).toBeCloseTo(478 * 3.6725, 0);   // ≈ 1755 AED
    expect(s.total).toBeCloseTo(s.work + s.personal, 6);
    expect(openTrip(data.trips).id).toBe("dubai");
  });
  it("backup merge unions trips by id", () => {
    const { data: a } = normalizeData(raw);
    const { data: b } = normalizeData({ ...raw, trips: [...raw.trips, { id: "ksa", name: "Riyadh", currency: "SAR", startDate: "2026-09-01", open: false }] });
    const m = mergeData(a, b);
    expect(m.trips.map((x) => x.id).sort()).toEqual(["dubai", "ksa"]);
  });
});
