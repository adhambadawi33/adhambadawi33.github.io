import {
  Utensils, ShoppingCart, Car, Zap, HeartPulse, Users, GraduationCap, ShoppingBag,
  Plane, Repeat, Layers, MoreHorizontal, Briefcase, Building2, TrendingUp,
  Landmark, Banknote, CreditCard, SlidersHorizontal,
} from "lucide-react";

/* "C+" calm palette: warm paper ground, deep forest header, single clay accent.
   Chosen with Adham for low visual noise (ADHD-friendly). */
export const T = {
  ink: "#2C3A2F", inkSoft: "#3A4A3E", paper: "#F1EEE7", surface: "#FBFAF6",
  line: "#E7E2D6", text: "#232A24", sub: "#6E7268", faint: "#A2A498",
  gold: "#B08D57", goldDeep: "#8A6A3B",
  green: "#3F8F6B", greenBg: "#E6F1EA", rose: "#A65C48", roseBg: "#F7EBE1",
  amber: "#A9853F", amberBg: "#F5EEDB",
};

/* Household owners (batch 4): subs, installments and expenses are tagged
   with whose they are — Adham / Abeer / the kids. */
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
/* Second row = bank-brand hues (Adham's real banks) so renamed accounts
   can pick their brand color right from the form. */
export const ACCOUNT_COLORS = [
  "#4C6350", "#5E7189", "#B08D57", "#9E6E6E", "#5E7D67", "#8A6A3B", "#6E4555", "#54606C",
  "#1D4E89", "#2469A8", "#17557F", "#4A6FA5", "#0B6B3A", "#2B3F8C",
];

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

export const fmtMoney = (n, cur, hide) => {
  if (hide) return "•••••";
  const v = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return cur === "USD" ? `$${v}` : `${v} ${cur}`;
};
export const inputCls = "ui w-full rounded-xl px-3.5 py-3 text-[15px] outline-none";
export const inputStyle = { background: T.paper, border: `1px solid ${T.line}`, color: T.text };
