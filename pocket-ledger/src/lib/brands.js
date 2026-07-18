/* Brand registry — maps account/subscription names to visual marks.
   Pure data + matchers; rendering lives in components/common/brand.jsx.
   Matching is substring-based on a normalized name, Arabic-aware. */

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[^a-z0-9؀-ۿ]+/g, " ")
    .trim();

/* Bank marks: `domain` fetches the real logo online (Google favicon service);
   the text wordmark (label/color/accent) is the offline fallback. */
const BANKS = [
  { m: ["emirates nbd", "enbd", "الاهلي الاماراتي"], label: "NBD", color: "#0A3A8C", accent: "#E21836", domain: "emiratesnbd.com" },
  { m: ["cib", "التجاري الدولي"], label: "CIB", color: "#123B70", accent: "#C8102E", domain: "cibeg.com" },
  { m: ["adcb"], label: "ADCB", color: "#D22630", accent: "#D22630", domain: "adcb.com" },
  { m: ["fab", "first abu dhabi"], label: "FAB", color: "#00379C", accent: "#00379C", domain: "bankfab.com" },
  { m: ["hsbc"], label: "HSBC", color: "#DB0011", accent: "#DB0011", domain: "hsbc.ae" },
  { m: ["qnb"], label: "QNB", color: "#5C2D91", accent: "#5C2D91", domain: "qnb.com" },
  { m: ["rajhi", "الراجحي"], label: "Rajhi", color: "#175CA9", accent: "#3FA9F5", domain: "alrajhibank.com.sa" },
  { m: ["nbe", "الاهلي المصري", "national bank of egypt"], label: "NBE", color: "#0B6B3A", accent: "#0B6B3A", domain: "nbe.com.eg" },
  { m: ["banque misr", "بنك مصر"], label: "BM", color: "#7A1F1F", accent: "#C8102E", domain: "banquemisr.com" },
  { m: ["mashreq"], label: "Mashreq", color: "#FF5E00", accent: "#FF5E00", domain: "mashreqbank.com" },
  { m: ["arab bank", "البنك العربي", "العربي"], label: "AB", color: "#0E7A3E", accent: "#0E7A3E", domain: "arabbank.com.eg" },
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

/* Subscription brands: `domain` fetches the real logo online; the colored
   glyph chip (bg/fg/ch) is the offline fallback. */
const SUBS = [
  { m: ["netflix", "نتفلكس", "نتفليكس"], bg: "#141414", fg: "#E50914", ch: "N", serif: true, domain: "netflix.com" },
  { m: ["spotify", "سبوتيفاي"], bg: "#1DB954", fg: "#101010", ch: "♫", domain: "spotify.com" },
  { m: ["adobe"], bg: "#FA0F00", fg: "#FFFFFF", ch: "A", domain: "adobe.com" },
  { m: ["icloud", "apple", "ابل", "آبل"], bg: "#101014", fg: "#FFFFFF", ch: "", domain: "apple.com" },
  { m: ["prime", "amazon", "امازون"], bg: "#00A8E1", fg: "#FFFFFF", ch: "prime", small: true, domain: "primevideo.com" },
  { m: ["claude", "anthropic", "كلود"], bg: "#DA7756", fg: "#FFFFFF", ch: "✳", domain: "claude.ai" },
  { m: ["chatgpt", "openai"], bg: "#10A37F", fg: "#FFFFFF", ch: "◎", domain: "openai.com" },
  { m: ["youtube", "يوتيوب"], bg: "#FF0000", fg: "#FFFFFF", ch: "▶", domain: "youtube.com" },
  { m: ["shahid", "شاهد"], bg: "#0B1B4A", fg: "#22D4AE", ch: "ش", domain: "shahid.mbc.net" },
  { m: ["anghami", "انغامي", "انجامي"], bg: "#7B2CBF", fg: "#FFFFFF", ch: "a", domain: "anghami.com" },
  { m: ["osn"], bg: "#0F0F0F", fg: "#FFFFFF", ch: "OSN", small: true, domain: "osnplus.com" },
  { m: ["ikea", "ايكيا"], bg: "#0058A3", fg: "#FFDB00", ch: "IKEA", small: true, domain: "ikea.com" },
  { m: ["iphone", "ايفون"], bg: "#101014", fg: "#FFFFFF", ch: "", domain: "apple.com" },
  { m: ["spinneys", "carrefour", "كارفور"], bg: "#004E9F", fg: "#FFFFFF", ch: "C", domain: "carrefouruae.com" },
];

/* Real logo via Google's favicon service — free, keyless, cached. */
export const logoUrl = (domain, sz = 64) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${sz}`;

export const subBrandFor = (name) => {
  const n = norm(name);
  if (!n) return null;
  return SUBS.find((b) => b.m.some((w) => n.includes(w))) || null;
};
