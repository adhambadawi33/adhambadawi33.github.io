import { describe, it, expect } from "vitest";
import { parseBankSms, parseSmsBatch, matchAccountByDigits } from "../lib/voice/sms.js";

const accounts = [
  { id: "a1", name: "ADCB Current", type: "bank", currency: "AED", cardDigits: ["8891"] },
  { id: "a2", name: "الراجحي", type: "bank", currency: "SAR", cardDigits: ["3307"] },
  { id: "a4", name: "Visa Signature", type: "credit", currency: "AED", cardDigits: ["4523"] },
];

describe("bank SMS parser", () => {
  it("parses a UAE Arabic purchase alert and matches the card", () => {
    const p = parseBankSms("شراء بمبلغ 214.50 درهم لدى CARREFOUR MOE بطاقة ****4523 بتاريخ 16/07", accounts);
    expect(p.amount).toBe(214.5);
    expect(p.currency).toBe("AED");
    expect(p.direction).toBe("expense");
    expect(p.cardLast4).toBe("4523");
    expect(p.accountId).toBe("a4");
    expect(p.merchant).toBe("CARREFOUR MOE");
    expect(p.category).toBe("Groceries");
    expect(p.date).toBe("2026-07-16");
  });

  it("parses an English format with 'card ending'", () => {
    const p = parseBankSms("Purchase of SAR 89.00 at STARBUCKS KSA with card ending 3307", accounts);
    expect(p.amount).toBe(89);
    expect(p.currency).toBe("SAR");
    expect(p.accountId).toBe("a2");
    expect(p.merchant).toBe("STARBUCKS KSA");
    expect(p.category).toBe("Food & Dining");
  });

  it("parses Egyptian EGP with Arabic-Indic digits and unknown card stays unmatched", () => {
    const p = parseBankSms("تم خصم ٣٥٠٫٠٠ جنيه من بطاقتك ****9902 لدى VODAFONE", accounts);
    expect(p.amount).toBe(350);
    expect(p.currency).toBe("EGP");
    expect(p.cardLast4).toBe("9902");
    expect(p.accountId).toBeNull();
  });

  it("detects deposits as income", () => {
    const p = parseBankSms("تم ايداع 38000.00 درهم راتب في حسابك ****8891", accounts);
    expect(p.direction).toBe("income");
    expect(p.accountId).toBe("a1");
    expect(p.category).toBe("Salary");
  });

  it("ATM withdrawal without merchant still parses", () => {
    const p = parseBankSms("سحب نقدي بمبلغ AED 2000 بطاقة xx8891", accounts);
    expect(p.amount).toBe(2000);
    expect(p.accountId).toBe("a1");
    expect(p.merchant).toBe("");
  });

  it("returns null for non-money messages", () => {
    expect(parseBankSms("عرض خاص! خصم 50% على كل المنتجات", accounts)).toBeNull();
    expect(parseBankSms("Your OTP is 4523", accounts)).toBeNull();
  });

  it("matchAccountByDigits ignores archived accounts", () => {
    const withArchived = [{ id: "x", archived: true, cardDigits: ["1111"] }, ...accounts];
    expect(matchAccountByDigits("1111", withArchived)).toBeNull();
    expect(matchAccountByDigits("4523", withArchived)).toBe("a4");
  });
});

describe("SMS batch parsing", () => {
  it("splits multiple messages and skips junk lines", () => {
    const batch = [
      "شراء بمبلغ 95.00 درهم لدى TALABAT بطاقة ****4523",
      "",
      "Purchase of SAR 450.00 at SHELL with card ending 3307",
      "اعلان: افتح حسابك الجديد الآن",
    ].join("\n");
    const { items, skipped } = parseSmsBatch(batch, accounts);
    expect(items).toHaveLength(2);
    expect(skipped).toBe(1);
    expect(items[0].accountId).toBe("a4");
    expect(items[0].category).toBe("Food & Dining");
    expect(items[1].accountId).toBe("a2");
    expect(items[1].category).toBe("Transport");
  });
});

describe('Egyptian "جم" shorthand (real bank SMS)', () => {
  const egAccounts = [...accounts, { id: "a5", name: "CIB", type: "debit", currency: "EGP", cardDigits: ["9972"] }];
  it('parses "خصم مبلغ 250.50 جم" as EGP expense and matches the card', () => {
    const p = parseBankSms("تم خصم مبلغ 250.50 جم من بطاقة ****9972 لدى TALABAT", egAccounts);
    expect(p).not.toBeNull();
    expect(p.amount).toBe(250.5);
    expect(p.currency).toBe("EGP");
    expect(p.direction).toBe("expense");
    expect(p.accountId).toBe("a5");
  });
  it('never mistakes words containing جم (جمعية) for a currency', () => {
    const p = parseBankSms("تم خصم مبلغ 500 جنيه اشتراك جمعية بطاقة ****9972", egAccounts);
    expect(p.amount).toBe(500);
    expect(p.currency).toBe("EGP");
  });
});

describe("Arab Bank real formats", () => {
  const abAccounts = [...accounts, { id: "ab", name: "Arab Bank Card", type: "credit", currency: "EGP", cardDigits: ["3889"] }];
  it('parses the English "A Trx using Card XXXX3889 from X for EGP Y" format', () => {
    const p = parseBankSms("A Trx using Card XXXX3889 from APPLE COM BILL for EGP 940.28 on 29-Jul-2026 at 13:40 GMT+3. Available balance is EGP 44814.75.", abAccounts);
    expect(p).not.toBeNull();
    expect(p.amount).toBe(940.28);
    expect(p.currency).toBe("EGP");
    expect(p.direction).toBe("expense");
    expect(p.merchant).toBe("APPLE COM BILL");
    expect(p.accountId).toBe("ab");
  });
  it('classifies a reversal "تم عكس قيد حركة" as income (refund)', () => {
    const p = parseBankSms("تم عكس قيد حركة بمبلغ 51.93 جنيه لبطاقتك #3889 من APPLE.COM/BILL بتاريخ 26-يوليه-2026", abAccounts);
    expect(p).not.toBeNull();
    expect(p.direction).toBe("income");
    expect(p.amount).toBe(51.93);
  });
  it("statement-issued notices never queue as transactions", () => {
    const p = parseBankSms("تم اصدار كشف حساب البطاقة رقم #3889، الرصيد المستخدم 13660.56 جنيه مصري ، و الحد الادنى للسداد 684.00 جنيه مصري .", abAccounts);
    expect(p).toBeNull();
  });
});
