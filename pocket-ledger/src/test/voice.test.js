import { describe, it, expect } from "vitest";
import { parseVoice, toEnDigits, normAr } from "../lib/voice/parse.js";

const accounts = [
  { id: "a1", name: "ADCB Current", type: "bank", currency: "AED" },
  { id: "a2", name: "الراجحي", type: "bank", currency: "SAR" },
  { id: "a3", name: "Cash Wallet", type: "cash", currency: "EGP" },
  { id: "a4", name: "Visa Signature", type: "credit", currency: "AED" },
];
const settings = { lastAccount: "a1" };

describe("voice parser — normalization", () => {
  it("converts Arabic-Indic digits and decimal separator", () => {
    expect(toEnDigits("٢٥٠٫٥")).toBe("250.5");
    expect(toEnDigits("۱۲۳")).toBe("123");
  });
  it("normalizes Arabic letter forms", () => {
    expect(normAr("قَهْوَة")).toBe("قهوه");
    expect(normAr("إلى")).toBe("الي");
  });
});

describe("voice parser — expenses", () => {
  it('parses "بنزين ٢٥٠ ريال من الراجحي"', () => {
    const p = parseVoice("بنزين ٢٥٠ ريال من الراجحي", accounts, settings);
    expect(p.type).toBe("expense");
    expect(p.amount).toBe(250);
    expect(p.currency).toBe("SAR");
    expect(p.accountId).toBe("a2");
    expect(p.category).toBe("Transport");
    expect(p.note).toBe("بنزين ٢٥٠ ريال من الراجحي");
  });
  it('parses "غدا 120 درهم كاش" with cash-type matching', () => {
    const p = parseVoice("غدا 120 درهم كاش", accounts, settings);
    expect(p.amount).toBe(120);
    expect(p.currency).toBe("AED");
    expect(p.accountId).toBe("a3");
    expect(p.category).toBe("Food & Dining");
  });
  it('parses "lunch 95 aed visa" with credit-type matching', () => {
    const p = parseVoice("lunch 95 aed visa", accounts, settings);
    expect(p.accountId).toBe("a4");
    expect(p.category).toBe("Food & Dining");
    expect(p.currency).toBe("AED");
  });
  it("falls back to matched account currency, then lastAccount currency", () => {
    expect(parseVoice("كارفور 300 الراجحي", accounts, settings).currency).toBe("SAR");
    expect(parseVoice("كارفور 300", accounts, settings).currency).toBe("AED"); // lastAccount a1
    expect(parseVoice("كارفور 300", accounts, settings).category).toBe("Groceries");
  });
  it("handles thousands separators and decimals", () => {
    expect(parseVoice("ايجار 4,500.75 درهم", accounts, settings).amount).toBe(4500.75);
  });
  it("returns nulls gracefully when pieces are missing", () => {
    const p = parseVoice("حاجات متفرقه", accounts, settings);
    expect(p.amount).toBeNull();
    expect(p.category).toBeNull();
    expect(p.type).toBe("expense");
  });
});

describe("voice parser — income", () => {
  it('parses "قبضت المرتب 38000 درهم"', () => {
    const p = parseVoice("قبضت المرتب 38000 درهم", accounts, settings);
    expect(p.type).toBe("income");
    expect(p.amount).toBe(38000);
    expect(p.category).toBe("Salary");
    expect(p.currency).toBe("AED");
  });
});

describe("voice parser — transfers", () => {
  it('parses "حولت 1000 من ADCB للراجحي"', () => {
    const p = parseVoice("حولت 1000 من ADCB للراجحي", accounts, settings);
    expect(p.type).toBe("transfer");
    expect(p.amount).toBe(1000);
    expect(p.accountId).toBe("a1");
    expect(p.toAccountId).toBe("a2");
  });
  it('parses "transfer 500 from cash to visa"', () => {
    const p = parseVoice("transfer 500 from cash to visa", accounts, settings);
    expect(p.type).toBe("transfer");
    expect(p.accountId).toBe("a3");
    expect(p.toAccountId).toBe("a4");
  });
  it("does not force transfer without a transfer keyword", () => {
    const p = parseVoice("جبت هديه من كارفور لماما 200 درهم", accounts, settings);
    expect(p.type).toBe("expense");
  });
});
