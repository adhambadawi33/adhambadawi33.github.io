import {
  Utensils, ShoppingCart, Car, Zap, HeartPulse, Users, GraduationCap, ShoppingBag,
  Plane, Repeat, Layers, MoreHorizontal, Briefcase, Building2, TrendingUp,
  Landmark, Banknote, CreditCard, SlidersHorizontal,
} from "lucide-react";

export const T = {
  ink: "#0F1B2D", inkSoft: "#1B2A41", paper: "#F2F4F7", surface: "#FFFFFF",
  line: "#E4E8EF", text: "#14202E", sub: "#5C6B7A", faint: "#93A0AE",
  gold: "#C9A96A", goldDeep: "#A9853F",
  green: "#0F8A63", greenBg: "#E7F5EF", rose: "#C6455C", roseBg: "#FAECEF",
  amber: "#B7791F", amberBg: "#FBF3E4",
};

export const ACCOUNT_TYPE_DEFS = [
  { id: "bank", label: "Bank", icon: Landmark },
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "debit", label: "Debit card", icon: CreditCard },
  { id: "credit", label: "Credit card", icon: CreditCard },
];
export const ACCOUNT_COLORS = ["#1F4E5F", "#4A3F6B", "#3D5A45", "#7A4B2E", "#3E5C76", "#8C6A3F", "#6E4555", "#54606C"];

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
