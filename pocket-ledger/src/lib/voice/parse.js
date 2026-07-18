/* Voice / free-text entry parser (Quick-Add + Siri intake).
   Turns phrases like "بنزين 250 ريال من الراجحي" or "lunch 95 aed visa"
   into a prefilled transaction. Deterministic, offline, bilingual (ar/en).
   SAFETY RULE: this only PREFILLS the form — the user always reviews and
   taps Save. Nothing is ever committed automatically. */

const AR_DIGITS = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9", "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9" };

export function toEnDigits(s) {
  return s.replace(/[٠-٩۰-۹]/g, (d) => AR_DIGITS[d]).replace(/٫/g, ".").replace(/٬/g, ",");
}

/* Arabic normalization for matching only (original text is kept as the note). */
export function normAr(s) {
  return toEnDigits(String(s))
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "") // diacritics + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي");
}

/* Currency detection: Arabic words match as substrings; short Latin codes
   (aed/sr/le…) must be standalone tokens so "nestle" ≠ LE. */
const CUR_SUBSTR = [
  ["AED", ["درهم", "دراهم", "dirham"]],
  ["SAR", ["ريال", "ريالات", "riyal"]],
  ["EGP", ["جنيه", "جنيهات", "geneh", "pound"]],
  ["USD", ["دولار", "دولارات", "dollar"]],
];
const CUR_TOKENS = [
  ["AED", ["aed", "dhs", "dh"]],
  ["SAR", ["sar", "sr"]],
  ["EGP", ["egp", "le"]],
  ["USD", ["usd", "$"]],
];

export function findCurrency(norm) {
  for (const [code, words] of CUR_SUBSTR)
    for (const w of words) if (norm.includes(w)) return code;
  const toks = new Set(norm.split(/[^a-z0-9\u0600-\u06FF$]+/));
  for (const [code, words] of CUR_TOKENS)
    for (const w of words) if (toks.has(w)) return code;
  return null;
}

const INCOME_WORDS = ["قبضت", "استلمت", "مرتب", "راتب", "دخل", "ايراد", "حصلت", "salary", "received", "income", "paid me", "got paid", "deposit"];

/* Owner detection (batch 5): "…لعبير" tags Abeer, "…للولاد" tags the kids.
   Null when no owner is named — the form keeps its current default. */
const OWNER_WORDS = [
  ["abeer", ["عبير", "لعبير", "مراتي", "لمراتي", "abeer"]],
  ["kids", ["الولاد", "للولاد", "الاولاد", "للاولاد", "العيال", "للعيال", "ولادي", "لولادي", "kids", "the kids"]],
  ["me", ["ليا", "بتاعي", "بتاعتي", "for me", "mine"]],
];
export function findOwner(norm) {
  for (const [id, words] of OWNER_WORDS)
    for (const w of words) if (norm.includes(w)) return id;
  return null;
}
const TRANSFER_WORDS = ["حولت", "حول", "تحويل", "نقلت", "transfer", "transferred", "moved", "sent"];

/* keyword -> category. Order matters: specific before generic. */
export const CAT_KEYWORDS = [
  ["Groceries", ["كارفور", "لولو", "بقاله", "سوبرماركت", "سوبر ماركت", "خضار", "تموين", "carrefour", "lulu", "spinneys", "grocer", "supermarket", "grocery"]],
  ["Transport", ["بنزين", "وقود", "جاز", "سولار", "تاكسي", "اوبر", "كريم", "مواصلات", "باركينج", "ركنه", "سياره", "fuel", "petrol", "gas", "shell", "adnoc", "enoc", "aramco", "محطه", "uber", "careem", "taxi", "parking", "salik", "metro"]],
  ["Housing & Bills", ["ايجار", "كهربا", "كهرباء", "ميه", "مياه", "فاتوره", "فواتير", "نت", "انترنت", "واي فاي", "ديوا", "rent", "dewa", "sewa", "bill", "electricity", "water", "internet", "wifi", "etisalat", "du "]],
  ["Health", ["دكتور", "طبيب", "صيدليه", "دوا", "دواء", "علاج", "تحاليل", "مستشفي", "doctor", "pharmacy", "medicine", "clinic", "hospital", "dental"]],
  ["Education", ["مدرسه", "مدارس", "دروس", "كورس", "جامعه", "كتب", "school", "course", "tuition", "university", "books"]],
  ["Family", ["هديه", "هدايا", "عيله", "اهل", "ولاد", "اطفال", "gift", "family", "kids"]],
  ["Travel", ["سفر", "طيران", "تذكره", "فندق", "رحله", "فيزا سفر", "travel", "flight", "hotel", "ticket", "airbnb"]],
  ["Subscriptions", ["اشتراك", "اشتراكات", "نتفلكس", "netflix", "spotify", "icloud", "subscription", "يوتيوب بريميوم"]],
  ["Installments", ["قسط", "اقساط", "installment", "emi"]],
  ["Shopping", ["تسوق", "ملابس", "جزمه", "امازون", "نون", "shopping", "amazon", "noon", "clothes", "shein", "ikea"]],
  ["Food & Dining", ["غدا", "غداء", "عشا", "عشاء", "فطار", "فطور", "اكل", "مطعم", "قهوه", "كافيه", "كوفي", "برجر", "بيتزا", "وجبه", "طلبات", "lunch", "dinner", "breakfast", "food", "restaurant", "coffee", "cafe", "burger", "pizza", "talabat", "deliveroo", "starbucks", "mcdonald"]],
];

const INCOME_CAT_KEYWORDS = [
  ["Salary", ["مرتب", "راتب", "salary", "payroll"]],
  ["Business", ["ارباح", "شغل", "مشروع", "business", "profit", "invoice"]],
  ["Investments", ["استثمار", "اسهم", "عائد", "dividend", "investment", "stocks"]],
];

function findAmount(norm) {
  const cleaned = norm.replace(/,(?=\d{3}(\D|$))/g, "");
  const m = /(\d+(?:\.\d+)?)/.exec(cleaned);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
}

/* Match an account by name tokens or generic type words. */
function findAccount(norm, accounts, exclude) {
  const pool = accounts.filter((a) => !a.archived && a.id !== exclude);
  let best = null;
  for (const a of pool) {
    const words = normAr(a.name).split(/\s+/).filter((w) => w.length >= 3);
    for (const w of words) {
      /* try the word as-is and with the definite article stripped —
         "للراجحي" parses to "راجحي" because لل consumes ال */
      for (const cand of new Set([w, w.replace(/^ال/, "")])) {
        if (cand.length >= 3 && norm.includes(cand) && (!best || cand.length > best.len))
          best = { id: a.id, len: cand.length };
      }
    }
  }
  if (best) return best.id;
  if (/(كاش|نقدي|نقدا|كارت كاش|cash)/.test(norm)) return pool.find((a) => a.type === "cash")?.id || null;
  if (/(فيزا|بطاقه|ائتمان|كريدت|visa|credit|card|master)/.test(norm)) return pool.find((a) => a.type === "credit")?.id || null;
  return null;
}

export function guessCategory(norm, type = "expense") {
  const table = type === "income" ? INCOME_CAT_KEYWORDS : CAT_KEYWORDS;
  for (const [cat, words] of table)
    for (const w of words) if (norm.includes(w)) return cat;
  return type === "income" ? "Other income" : null;
}

/**
 * parseVoice(text, accounts, settings) -> prefill object or null
 * { type, amount, currency, accountId, toAccountId, category, note }
 * Missing pieces stay null — the form keeps its defaults for those.
 */
export function parseVoice(text, accounts = [], settings = {}) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const norm = normAr(raw);

  let type = "expense";
  if (INCOME_WORDS.some((w) => norm.includes(w))) type = "income";

  const amount = findAmount(norm);
  let currency = findCurrency(norm);

  /* transfer: keyword AND a clear "from X to Y" shape.
     Arabic "to" can be a spaced word (الى/الي) or an attached lam prefix (لـ / للـ). */
  const fromTo =
    /من\s+(.+?)\s+(?:الي\s+|لل?)(\S.*)$/.exec(norm) ||
    /(?:from)\s+(.+?)\s+(?:to)\s+(.+)$/.exec(norm);
  const wantsTransfer = TRANSFER_WORDS.some((w) => norm.includes(w));
  if (fromTo) {
    const src = findAccount(fromTo[1], accounts);
    const dst = findAccount(fromTo[2], accounts, src);
    if (wantsTransfer && src && dst) {
      return {
        type: "transfer", amount, currency: currency, accountId: src, toAccountId: dst,
        category: null, note: raw,
      };
    }
  }

  let accountId = findAccount(norm, accounts);
  const category = guessCategory(norm, type);
  if (!currency && accountId) currency = accounts.find((a) => a.id === accountId)?.currency || null;
  if (!currency && settings.lastAccount) currency = accounts.find((a) => a.id === settings.lastAccount)?.currency || null;

  return { type, amount, currency, accountId, toAccountId: null, category, note: raw, owner: findOwner(norm) };
}
