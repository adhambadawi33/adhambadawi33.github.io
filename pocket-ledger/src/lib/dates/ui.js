import { todayISO, diffDays, parseISO } from "./localDate.js";

export const daysUntilFromToday = (iso) => diffDays(todayISO(), iso);

/* "Jan 2027" — used for installment finish dates. */
export function monthYear(iso) {
  const p = parseISO(iso);
  if (!p) return iso;
  return new Date(p.y, p.m - 1, p.d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function humanDay(iso) {
  const d = daysUntilFromToday(iso);
  if (d === 0) return "Today";
  if (d === -1) return "Yesterday";
  if (d === 1) return "Tomorrow";
  const p = parseISO(iso);
  if (!p) return iso;
  return new Date(p.y, p.m - 1, p.d).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}
