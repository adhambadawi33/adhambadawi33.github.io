import {
  Utensils, ShoppingCart, Car, Zap, HeartPulse, Users, GraduationCap, ShoppingBag,
  Plane, Repeat, Layers, MoreHorizontal, Briefcase, Building2, TrendingUp,
  Landmark, Banknote, CreditCard, SlidersHorizontal,
} from "lucide-react";

/* "C+" calm palette: warm paper ground, deep forest header, single clay accent.
   Chosen for low visual noise. Two palettes share one shape; `T` is a live
   view onto whichever is active, so every inline style follows the theme. */
export const LIGHT = {
  ink: "#2C3A2F", inkSoft: "#3A4A3E", inkText: "#2C3A2F", paper: "#F1EEE7", surface: "#FBFAF6",
  line: "#E7E2D6", text: "#232A24", sub: "#6E7268", faint: "#858880",
  gold: "#B08D57", goldDeep: "#8A6A3B",
  green: "#3F8F6B", greenBg: "#E6F1EA", rose: "#A65C48", roseBg: "#F7EBE1",
  amber: "#A9853F", amberBg: "#F5EEDB",
  shell: "#E7EAEF", placeholder: "#93A0AE", navBg: "rgba(251,250,246,0.82)",
};
/* Night: the forest becomes the ground, paper becomes ink. Same one accent. */
export const DARK = {
  ink: "#33423A", inkSoft: "#465750", inkText: "#ECE9E0", paper: "#151A17", surface: "#1E2520",
  line: "#2C352F", text: "#ECE9E0", sub: "#ABB0A5", faint: "#82877D",
  gold: "#C9A96A", goldDeep: "#D6BC86",
  green: "#6FB994", greenBg: "rgba(111,185,148,0.16)", rose: "#D48F7B", roseBg: "rgba(212,143,123,0.16)",
  amber: "#D3B26E", amberBg: "rgba(211,178,110,0.16)",
  shell: "#0E120F", placeholder: "#6F756D", navBg: "rgba(30,37,32,0.84)",
};
let active = LIGHT;
export const THEME_MODES = ["system", "light", "dark"];
export const setTheme = (mode) => { active = mode === "dark" ? DARK : LIGHT; };
export const currentTheme = () => (active === DARK ? "dark" : "light");
export const T = new Proxy({}, { get: (_, k) => active[k], ownKeys: () => Reflect.ownKeys(active), getOwnPropertyDescriptor: (_, k) => ({ value: active[k], enumerable: true, configurable: true }) });

/* Household owners (batch 4): subs, installments and expenses are tagged
   with whose they are. */
export const OWNERS = [
  { id: "me", label: "Me", c: "#4C6350", bg: "rgba(76,99,80,.13)" },
  { id: "abeer", label: "Abeer", c: "#9E5E77", bg: "rgba(158,94,119,.13)" },
  { id: "kids", label: "Kids", c: "#5E7189", bg: "rgba(94,113,137,.13)" },
];
export const ownerDef = (id) => OWNERS.find((o) => o.id === id) || OWNERS[0];

export const ACCOUNT_TYPE_DEFS = [
  { id: "bank", label: "Bank", icon: Landmark },
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "debit", label: "Debit card", icon: CreditCard },
  { id: "credit", label: "Credit card", icon: CreditCard },
];
/* Second row = bank-brand hues (common regional banks) so renamed accounts
   can pick their brand color right from the form. */
export const ACCOUNT_COLORS = [
  "#4C6350", "#5E7189", "#B08D57", "#9E6E6E", "#5E7D67", "#8A6A3B", "#6E4555", "#54606C",
  "#1D4E89", "#2469A8", "#17557F", "#4A6FA5", "#0B6B3A", "#2B3F8C",
  "#E8752A", "#4FA3D8", "#AEB9C4", "#C93A3A",
];

/* Account keyline paint: two brand colors blend into a gradient (batch 11). */
export const accountStripe = (a, deg = 180) =>
  a?.color2 ? `linear-gradient(${deg}deg, ${a.color}, ${a.color2})` : a?.color;

export const EXP_CATS = [
  { n: "Food & Dining", I: Utensils, c: "#B4744B" },
  { n: "Groceries", I: ShoppingCart, c: "#6B8E6E" },
  { n: "Transport", I: Car, c: "#3E5C76" },
  { n: "Housing & Bills", I: Zap, c: "#1F6F78" },
  { n: "Health", I: HeartPulse, c: "#B5657A" },
  { n: "Family", I: Users, c: "#7A6C99" },
  { n: "Education", I: GraduationCap, c: "#4E7A9B" },
  { n: "Shopping", I: ShoppingBag, c: "#A9556B" },
  { n: "Travel", I: Plane, c: "#5E8B7E" },
  { n: "Subscriptions", I: Repeat, c: "#94794A" },
  { n: "Installments", I: Layers, c: "#8C5A5A" },
  { n: "Other", I: MoreHorizontal, c: "#8A96A3" },
];
export const INC_CATS = [
  { n: "Salary", I: Briefcase, c: "#0F8A63" },
  { n: "Business", I: Building2, c: "#1F6F78" },
  { n: "Investments", I: TrendingUp, c: "#4E7A9B" },
  { n: "Other income", I: MoreHorizontal, c: "#5E8B7E" },
];
export const ADJ_CAT = { n: "Adjustment", I: SlidersHorizontal, c: "#54606C" };
export const catDef = (name) =>
  [...EXP_CATS, ...INC_CATS, ADJ_CAT].find((c) => c.n === name) || EXP_CATS[EXP_CATS.length - 1];

const AR_CUR = { EGP: "ج.م", AED: "د.إ", SAR: "ر.س" };
/* Currency label follows the UI language (set by App via setCurrencyLang);
   digits stay Western everywhere so numbers line up in the mono column. */
let curLang = "en";
export const setCurrencyLang = (l) => { curLang = l === "ar" ? "ar" : "en"; };
export const curLabel = (cur) => (curLang === "ar" && AR_CUR[cur] ? AR_CUR[cur] : cur);
export const fmtMoney = (n, cur, hide) => {
  if (hide) return "•••••";
  const v = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return cur === "USD" ? `$${v}` : cur === "EUR" ? `€${v}` : `${v} ${curLabel(cur)}`;
};
export const inputCls = "ui w-full rounded-xl px-3.5 py-3 text-[15px] outline-none";
/* Live like T: inputs follow the theme even though callers spread this object. */
const inputStyleOf = () => ({ background: T.paper, border: `1px solid ${T.line}`, color: T.text });
export const inputStyle = new Proxy({}, { get: (_, k) => inputStyleOf()[k], ownKeys: () => Object.keys(inputStyleOf()), getOwnPropertyDescriptor: (_, k) => ({ value: inputStyleOf()[k], enumerable: true, configurable: true }) });
