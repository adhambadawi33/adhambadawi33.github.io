/* Brand registry — maps account/subscription names to visual marks.
   Pure data + matchers; rendering lives in components/common/brand.jsx.
   Matching is substring-based on a normalized name, Arabic-aware. */

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[^a-z0-9؀-ۿ]+/g, " ")
    .trim();

/* Bank wordmarks: label rendered as text, `color` = text, `accent` = mark. */
const BANKS = [
  { m: ["emirates nbd", "enbd", "الاهلي الاماراتي"], label: "NBD", color: "#0A3A8C", accent: "#E21836" },
  { m: ["cib", "التجاري الدولي"], label: "CIB", color: "#123B70", accent: "#C8102E" },
  { m: ["adcb"], label: "ADCB", color: "#D22630", accent: "#D22630" },
  { m: ["fab", "first abu dhabi"], label: "FAB", color: "#00379C", accent: "#00379C" },
  { m: ["hsbc"], label: "HSBC", color: "#DB0011", accent: "#DB0011" },
  { m: ["qnb"], label: "QNB", color: "#5C2D91", accent: "#5C2D91" },
  { m: ["rajhi", "الراجحي"], label: "Rajhi", color: "#175CA9", accent: "#3FA9F5" },
  { m: ["nbe", "الاهلي المصري", "national bank of egypt"], label: "NBE", color: "#0B6B3A", accent: "#0B6B3A" },
  { m: ["banque misr", "بنك مصر"], label: "BM", color: "#7A1F1F", accent: "#C8102E" },
  { m: ["mashreq"], label: "Mashreq", color: "#FF5E00", accent: "#FF5E00" },
];

export const bankFor = (name) => {
  const n = norm(name);
  if (!n) return null;
  return BANKS.find((b) => b.m.some((w) => n.includes(w))) || null;
};

/* Card network inferred from explicit field first, then the account name. */
export const networkFor = (account) => {
  if (account?.network === "visa" || account?.network === "mastercard") return account.network;
  const n = norm(account?.name);
  if (n.includes("visa")) return "visa";
  if (n.includes("master")) return "mastercard";
  return null;
};

/* Subscription brand chips: bg/fg colors + a short glyph or wordmark. */
const SUBS = [
  { m: ["netflix", "نتفلكس", "نتفليكس"], bg: "#141414", fg: "#E50914", ch: "N", serif: true },
  { m: ["spotify", "سبوتيفاي"], bg: "#1DB954", fg: "#101010", ch: "♫" },
  { m: ["adobe"], bg: "#FA0F00", fg: "#FFFFFF", ch: "A" },
  { m: ["icloud", "apple", "ابل", "آبل"], bg: "#101014", fg: "#FFFFFF", ch: "" },
  { m: ["prime", "amazon", "امازون"], bg: "#00A8E1", fg: "#FFFFFF", ch: "prime", small: true },
  { m: ["claude", "anthropic", "كلود"], bg: "#DA7756", fg: "#FFFFFF", ch: "✳" },
  { m: ["chatgpt", "openai"], bg: "#10A37F", fg: "#FFFFFF", ch: "◎" },
  { m: ["youtube", "يوتيوب"], bg: "#FF0000", fg: "#FFFFFF", ch: "▶" },
  { m: ["shahid", "شاهد"], bg: "#0B1B4A", fg: "#22D4AE", ch: "ش" },
  { m: ["anghami", "انغامي", "انجامي"], bg: "#7B2CBF", fg: "#FFFFFF", ch: "a" },
  { m: ["osn"], bg: "#0F0F0F", fg: "#FFFFFF", ch: "OSN", small: true },
  { m: ["ikea", "ايكيا"], bg: "#0058A3", fg: "#FFDB00", ch: "IKEA", small: true },
  { m: ["iphone", "ايفون"], bg: "#101014", fg: "#FFFFFF", ch: "" },
  { m: ["spinneys", "carrefour", "كارفور"], bg: "#004E9F", fg: "#FFFFFF", ch: "C" },
];

export const subBrandFor = (name) => {
  const n = norm(name);
  if (!n) return null;
  return SUBS.find((b) => b.m.some((w) => n.includes(w))) || null;
};
