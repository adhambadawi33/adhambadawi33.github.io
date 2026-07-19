import { describe, it, expect } from "vitest";
import { parseVoice, toEnDigits, normAr, learnableTokens } from "../lib/voice/parse.js";
import { todayISO, addDays } from "../lib/dates/localDate.js";

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

describe("voice parser — owner tagging (batch 5)", () => {
  it("tags Abeer from لعبير", () => {
    const p = parseVoice("دفعت ٢٠٠ جنيه سوبر ماركت لعبير", accounts, settings);
    expect(p.owner).toBe("abeer");
    expect(p.amount).toBe(200);
  });
  it("tags the kids from للولاد", () => {
    expect(parseVoice("مدرسه ٥٠٠ جنيه للولاد", accounts, settings).owner).toBe("kids");
  });
  it("leaves owner null when nobody is named", () => {
    expect(parseVoice("غدا ١٢٠ درهم", accounts, settings).owner).toBeNull();
  });
});

describe("voice parser — debt phrases (batch 6)", () => {
  it('parses "سلفت احمد ٥٠٠ جنيه" as a lent debt', () => {
    const p = parseVoice("سلفت احمد ٥٠٠ جنيه", accounts, settings);
    expect(p.type).toBe("debt");
    expect(p.direction).toBe("lent");
    expect(p.person).toBe("احمد");
    expect(p.amount).toBe(500);
    expect(p.currency).toBe("EGP");
  });
  it('parses "استلفت من احمد ٥٠٠ دولار" as borrowed — استلفت is not سلفت', () => {
    const p = parseVoice("استلفت من احمد ٥٠٠ دولار", accounts, settings);
    expect(p.type).toBe("debt");
    expect(p.direction).toBe("borrowed");
    expect(p.person).toBe("احمد");
    expect(p.currency).toBe("USD");
  });
  it('parses "lent ahmed 300 aed"', () => {
    const p = parseVoice("lent Ahmed 300 aed", accounts, settings);
    expect(p.type).toBe("debt");
    expect(p.direction).toBe("lent");
    expect(p.person).toBe("ahmed");
    expect(p.amount).toBe(300);
    expect(p.currency).toBe("AED");
  });
  it('parses "borrowed 200 from sara"', () => {
    const p = parseVoice("borrowed 200 from Sara", accounts, settings);
    expect(p.type).toBe("debt");
    expect(p.direction).toBe("borrowed");
    expect(p.person).toBe("sara");
  });
  it("falls back to the base currency when none is spoken", () => {
    const p = parseVoice("سلفت منى ١٠٠٠", accounts, { ...settings, base: "EGP" });
    expect(p.type).toBe("debt");
    expect(p.currency).toBe("EGP");
  });
  it("ordinary expenses never become debts", () => {
    expect(parseVoice("غدا ١٢٠ درهم", accounts, settings).type).toBe("expense");
    expect(parseVoice("كارفور 300", accounts, settings).type).toBe("expense");
  });
});

describe("Egyptian car & maintenance words (Adham: صيانة عربية landed in Food)", () => {
  it('classifies "صيانه عربيه ٥٠٠ جنيه" as Transport', () => {
    const p = parseVoice("صيانه عربيه ٥٠٠ جنيه", accounts, settings);
    expect(p.category).toBe("Transport");
    expect(p.amount).toBe(500);
  });
  it("bare maintenance/plumber words go to Housing & Bills", () => {
    expect(parseVoice("صيانه تكييف ٣٠٠ جنيه", accounts, settings).category).toBe("Housing & Bills");
    expect(parseVoice("سباك ٢٠٠ جنيه", accounts, settings).category).toBe("Housing & Bills");
  });
  it("leaves category null for truly unknown text (UI shows Other)", () => {
    expect(parseVoice("حاجات متنوعه ١٥٠ جنيه", accounts, settings).category).toBeNull();
  });
});

describe("spoken dates (batch 13)", () => {
  it('"امبارح" sets yesterday and never eats the amount', () => {
    const p = parseVoice("دفعت ٢٠٠ بنزين امبارح", accounts, settings);
    expect(p.date).toBe(addDays(todayISO(), -1));
    expect(p.amount).toBe(200);
    expect(p.category).toBe("Transport");
  });
  it('"من ٣ ايام" strips before amount detection', () => {
    const p = parseVoice("من ٣ ايام دفعت ٢٠٠ كارفور", accounts, settings);
    expect(p.date).toBe(addDays(todayISO(), -3));
    expect(p.amount).toBe(200);
  });
  it('"من يومين" word-number works', () => {
    expect(parseVoice("غدا ١٥٠ جنيه من يومين", accounts, settings).date).toBe(addDays(todayISO(), -2));
  });
  it("weekday resolves to the most recent past occurrence", () => {
    const p = parseVoice("دفعت ٥٠٠ كارفور يوم الجمعه اللي فات", accounts, settings);
    const d = new Date(p.date + "T00:00:00");
    expect(d.getDay()).toBe(5); // Friday
    expect(p.date < todayISO()).toBe(true);
  });
  it("no date words → date stays null (today)", () => {
    expect(parseVoice("غدا ١٢٠ درهم", accounts, settings).date).toBeNull();
  });
});

describe("self-learning categories (batch 13)", () => {
  it("extracts merchant-ish tokens, skipping verbs/currencies/owners", () => {
    const t = learnableTokens("دفعت ٥٠٠ جنيه فلاش تكنولوجيز لعبير امبارح");
    expect(t).toContain("فلاش");
    expect(t).toContain("تكنولوجيز");
    expect(t).not.toContain("دفعت");
    expect(t).not.toContain("جنيه");
    expect(t).not.toContain("لعبير");
    expect(t).not.toContain("امبارح");
  });
  it("learned keywords beat built-in guesses", () => {
    const learned = { "كارفور": "Shopping" };
    const p = parseVoice("كارفور ٣٠٠ جنيه", accounts, { ...settings, learnedCats: learned });
    expect(p.category).toBe("Shopping"); // builtin says Groceries — user's lesson wins
  });
  it("unknown merchant becomes known after learning", () => {
    const before = parseVoice("فلاش تكنولوجيز ٥٠٠ جنيه", accounts, settings);
    expect(before.category).toBeNull();
    const after = parseVoice("فلاش تكنولوجيز ٥٠٠ جنيه", accounts, { ...settings, learnedCats: { "فلاش": "Shopping" } });
    expect(after.category).toBe("Shopping");
  });
});
