import {
  Utensils, ShoppingCart, Car, Zap, HeartPulse, Users, GraduationCap, ShoppingBag,
  Plane, Repeat, Layers, MoreHorizontal, Briefcase, Building2, TrendingUp,
  Landmark, Banknote, CreditCard, SlidersHorizontal,
} from "lucide-react";

/* "C+" calm palette: warm paper ground, deep forest header, single clay accent.
   Chosen for low visual noise. Two palettes share one shape; `T` is a live
   view onto whichever is active, so every inline style follows the theme. */
export const LIGHT = {
  /* grounds */
  paper: "#F1EEE7", surface: "#FBFAF6", raised: "#FFFFFF", sunken: "#EAE6DC",
  /* lines */
  line: "#E4DFD3", lineStrong: "#CFC9BA",
  /* text: 14.8 / 6.1 / 4.7 : 1 on surface */
  text: "#1F261F", sub: "#5B6159", faint: "#6E7268", textDisabled: "#A3A69C",
  /* primary action */
  ink: "#2C3A2F", inkHover: "#243128", inkPressed: "#1B251E", inkSoft: "#3A4A3E", inkText: "#2C3A2F",
  /* the one accent: brass. goldDeep is the text-safe one (4.8:1), gold is decorative */
  gold: "#B08D57", goldDeep: "#8A6A3B", goldBg: "#F3EBDD",
  /* state colors, all ≥ 4.9:1 on surface */
  green: "#2E7A57", greenBg: "#E3F0E8", rose: "#9E4D3A", roseBg: "#F7E8E1",
  amber: "#8A6425", amberBg: "#F5ECD9", info: "#3E5C76", infoBg: "#E6ECF2",
  focus: "#B08D57", shadow1: "0 1px 2px rgba(31,38,31,.06), 0 4px 14px rgba(31,38,31,.05)",
  scrim: "rgba(31,38,31,0.45)", shell: "#E7EAEF", placeholder: "#93A0AE", navBg: "rgba(251,250,246,0.84)",
};
/* Night: the forest becomes the ground, paper becomes ink. Same one accent. */
export const DARK = {
  paper: "#151A17", surface: "#1E2520", raised: "#242C26", sunken: "#10140F",
  line: "#2C352F", lineStrong: "#3D4741",
  text: "#EDEBE3", sub: "#B4B8AE", faint: "#9A9F95", textDisabled: "#6C716A",
  ink: "#3A4A3E", inkHover: "#45564A", inkPressed: "#2F3D33", inkSoft: "#465750", inkText: "#EDEBE3",
  gold: "#C9A96A", goldDeep: "#D6BC86", goldBg: "rgba(214,188,134,0.14)",
  green: "#7CC49F", greenBg: "rgba(124,196,159,0.14)", rose: "#DE9585", roseBg: "rgba(222,149,133,0.14)",
  amber: "#DCB874", amberBg: "rgba(220,184,116,0.14)", info: "#9DB4CB", infoBg: "rgba(157,180,203,0.14)",
  focus: "#C9A96A", shadow1: "0 1px 2px rgba(0,0,0,.35), 0 6px 18px rgba(0,0,0,.28)",
  scrim: "rgba(0,0,0,0.6)", shell: "#0E120F", placeholder: "#6F756D", navBg: "rgba(30,37,32,0.86)",
};
let active = LIGHT;
export const THEME_MODES = ["system", "light", "dark"];
/* Mirror every token to CSS variables (--pl-*) so stylesheets and Tailwind
   arbitrary values can use the same source of truth as inline styles. */
const KEBAB = (k) => k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
const syncCssVars = () => {
  if (typeof document === "undefined") return;
  const st = document.documentElement.style;
  for (const [k, v] of Object.entries(active)) st.setProperty(`--pl-${KEBAB(k)}`, v);
};
export const setTheme = (mode) => { active = mode === "dark" ? DARK : LIGHT; syncCssVars(); };
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
export const inputCls = "ui pl-input w-full rounded-xl px-3.5 text-[15px] outline-none";
/* Live like T: inputs follow the theme even though callers spread this object. */
const inputStyleOf = () => ({ background: T.surface, border: `1px solid ${T.lineStrong}`, color: T.text });
export const inputStyle = new Proxy({}, { get: (_, k) => inputStyleOf()[k], ownKeys: () => Object.keys(inputStyleOf()), getOwnPropertyDescriptor: (_, k) => ({ value: inputStyleOf()[k], enumerable: true, configurable: true }) });
