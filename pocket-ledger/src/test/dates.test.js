import { describe, it, expect } from "vitest";
import { todayISO, parseISO, isValidISO, diffDays, addDays, addMonthsClamped, addCycle, daysInMonth } from "../lib/dates/localDate.js";
import { monthYear } from "../lib/dates/ui.js";

describe("local dates (handoff §4.3)", () => {
  it("todayISO uses the LOCAL calendar, never UTC", () => {
    // 00:30 local on 15 July — a UTC conversion in GMT+4 would say 14 July.
    const d = new Date(2026, 6, 15, 0, 30);
    expect(todayISO(d)).toBe("2026-07-15");
    const late = new Date(2026, 6, 15, 23, 45);
    expect(todayISO(late)).toBe("2026-07-15");
  });
  it("parses and validates strictly", () => {
    expect(parseISO("2026-02-29")).toBeNull(); // not a leap year
    expect(parseISO("2024-02-29")).toEqual({ y: 2024, m: 2, d: 29 }); // leap year
    expect(isValidISO("2026-13-01")).toBe(false);
    expect(isValidISO("garbage")).toBe(false);
  });
  it("diffDays counts whole days", () => {
    expect(diffDays("2026-07-15", "2026-07-18")).toBe(3);
    expect(diffDays("2026-07-18", "2026-07-15")).toBe(-3);
    expect(diffDays("2026-02-28", "2026-03-01")).toBe(1);
  });
  it("addDays crosses month boundaries", () => {
    expect(addDays("2026-07-30", 7)).toBe("2026-08-06");
  });
  it("month-end clamping: Jan 31 + 1 month = Feb 28 (Feb 29 in leap years)", () => {
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsClamped("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonthsClamped("2026-01-31", 2)).toBe("2026-03-31");
    expect(addMonthsClamped("2026-12-15", 1)).toBe("2027-01-15");
  });
  it("cycles: weekly / monthly / yearly", () => {
    expect(addCycle("2026-07-01", "weekly")).toBe("2026-07-08");
    expect(addCycle("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(addCycle("2024-02-29", "yearly")).toBe("2025-02-28");
  });
  it("daysInMonth", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 7)).toBe(31);
  });
  it("monthYear formats an installment finish month", () => {
    expect(monthYear("2027-01-15")).toBe("Jan 2027");
  });
});
