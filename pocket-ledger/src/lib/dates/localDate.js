/* Local-calendar date utilities (handoff §4.3).
   Financial dates are DATE-ONLY strings "YYYY-MM-DD" in the user's local
   calendar. Never round-trip them through Date#toISOString / UTC parsing —
   that shifts dates in GMT+2..+4 (Egypt, KSA, UAE). */
export function todayISO(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

export function parseISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
  return { y, m: mo, d };
}

export const isValidISO = (s) => parseISO(s) !== null;
export const toISO = (y, m, d) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function daysInMonth(y, m) {
  // m: 1-12. Day 0 of next month — computed in UTC so DST can never interfere.
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/* Difference in whole days, DST-safe (dates anchored at UTC midnight). */
export function diffDays(fromISO, toISOs) {
  const a = parseISO(fromISO), b = parseISO(toISOs);
  if (!a || !b) return NaN;
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}

export function addDays(iso, n) {
  const p = parseISO(iso);
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return toISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/* Month-end clamped: Jan 31 + 1 month = Feb 28/29 (handoff §4.3). */
export function addMonthsClamped(iso, n) {
  const p = parseISO(iso);
  const total = p.m - 1 + n;
  const y = p.y + Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12 + 1;
  return toISO(y, m, Math.min(p.d, daysInMonth(y, m)));
}

export function addCycle(iso, cycle) {
  if (cycle === "weekly") return addDays(iso, 7);
  if (cycle === "yearly") return addMonthsClamped(iso, 12);
  return addMonthsClamped(iso, 1);
}

export const monthKeyOf = (iso) => (iso || "").slice(0, 7);
export const thisMonthKey = (now = new Date()) => todayISO(now).slice(0, 7);
