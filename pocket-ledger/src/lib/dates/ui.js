import { todayISO, diffDays, parseISO } from "./localDate.js";
import { dateLocale, uiLang } from "../../i18n/index.js";

export const daysUntilFromToday = (iso) => diffDays(todayISO(), iso);

/* "Jan 2027" — used for installment finish dates. */
export function monthYear(iso) {
  const p = parseISO(iso);
  if (!p) return iso;
  return new Date(p.y, p.m - 1, p.d).toLocaleDateString(dateLocale(), { month: "short", year: "numeric" });
}

export function humanDay(iso) {
  const d = daysUntilFromToday(iso);
  const ar = uiLang() === "ar";
  if (d === 0) return ar ? "النهارده" : "Today";
  if (d === -1) return ar ? "إمبارح" : "Yesterday";
  if (d === 1) return ar ? "بكرة" : "Tomorrow";
  const p = parseISO(iso);
  if (!p) return iso;
  return new Date(p.y, p.m - 1, p.d).toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short" });
}
