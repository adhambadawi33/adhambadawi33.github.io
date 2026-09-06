/* Gentle nudges (batch 10): at most ONE calm, dismissible hint on Home.
   Priority: a card payment about to be due > an account that can't cover
   its own upcoming subscriptions > a heavy renewal week > a stale backup.
   Dismissing snoozes that nudge for 3 days. */
import { convert } from "./finance/currency.js";
import { daysUntilFromToday, humanDay } from "./dates/ui.js";
import { todayISO, toISO, daysInMonth, diffDays } from "./dates/localDate.js";
import { planStats } from "./finance/plans.js";
import { uiLang } from "../i18n/index.js";
import { curLabel } from "../styles/tokens.js";

const HEAVY_WEEK_BASE = 5000; // in base currency

function nextDueISO(dueDay) {
  const t = todayISO();
  const y = +t.slice(0, 4), m = +t.slice(5, 7), d = +t.slice(8, 10);
  const thisMonth = Math.min(dueDay, daysInMonth(y, m));
  if (d <= thisMonth) return toISO(y, m, thisMonth);
  const [yy, mm] = m === 12 ? [y + 1, 1] : [y, m + 1];
  return toISO(yy, mm, Math.min(dueDay, daysInMonth(yy, mm)));
}

const fmt = (n, cur) => `${Math.round(n).toLocaleString("en-US")} ${curLabel(cur)}`;
/* Copy in both languages; the nudge is rebuilt whenever settings change. */
const AR = {
  cardDue: (a, owed, due) => `${a} محتاج ${owed} قبل ${due} — ادفعه وريّح دماغك.`,
  low: (a, bal, due) => `${a} فيه ${bal} بس هيتخصم منه ${due} خلال 10 أيام — زوّده عشان مفيش حاجة ترتد.`,
  heavy: (n, total) => `خلّي بالك: ${n} تجديدات هتتخصم خلال 7 أيام — حوالي ${total} إجمالي.`,
  reconcileFirst: "مراجعة شهرية: هات كشوف البنك وطابق كل رصيد — استخدم «طابق» على الحساب، أو ادّي الكشوف لـ Claude.",
  reconcile: (d) => `${d} يوم من آخر مطابقة أرصدة — هات كشوف جديدة وطابقها («طابق»، أو ادّيها لـ Claude).`,
  backupFirst: "بياناتك على الجهاز ده بس — خد 10 ثواني: الإعدادات ← تصدير نسخة احتياطية.",
  backup: (d) => `آخر نسخة احتياطية من ${d} يوم — الإعدادات ← تصدير نسخة احتياطية تحمي أرقامك.`,
};
const EN = {
  cardDue: (a, owed, due) => `${a} needs ${owed} by ${due} — pay it and it's off your mind.`,
  low: (a, bal, due) => `${a} holds ${bal} but ${due} in charges land within 10 days — top it up so nothing bounces.`,
  heavy: (n, total) => `Heads up: ${n} renewals land within 7 days — about ${total} total.`,
  reconcileFirst: "Monthly check-up: pull your bank statements and match each balance — use Adjust on the account, or hand the statements to Claude.",
  reconcile: (d) => `${d} days since the last balance check — pull fresh bank statements and match them (Adjust, or hand them to Claude).`,
  backupFirst: "Your data lives only on this device — take 10 seconds: Settings → Export backup.",
  backup: (d) => `Last backup was ${d} days ago — Settings → Export backup keeps your numbers safe.`,
};
const copy = () => (uiLang() === "ar" ? AR : EN);

export function computeNudges({ accounts, recurrs, plans = [], balances, settings }) {
  const nudges = [];
  const rates = settings.rates;
  const base = settings.base;
  const active = accounts.filter((a) => !a.archived);
  const liveSubs = recurrs.filter((r) => !r.paused && !(r.kind === "installment" && r.monthsPaid >= r.monthsTotal));

  /* Every upcoming charge in the next N days: subs + next plan milestones. */
  const chargesWithin = (days, accountId = null) => {
    const items = [];
    for (const r of liveSubs) {
      const d = daysUntilFromToday(r.nextDue);
      if (d >= 0 && d <= days && (accountId === null || r.accountId === accountId)) {
        items.push({ amount: r.amount, currency: r.currency });
      }
    }
    for (const p of plans) {
      const s = planStats(p);
      if (!s.next) continue;
      const d = daysUntilFromToday(s.next.due);
      if (d >= 0 && d <= days && (accountId === null || p.accountId === accountId)) {
        items.push({ amount: s.next.amount, currency: p.currency });
      }
    }
    return items;
  };

  /* 1 — a credit card with money owed and a due day around the corner */
  for (const a of active) {
    if (a.type !== "credit" || !(a.dueDay > 0)) continue;
    const owed = Math.max(0, -(balances[a.id] || 0));
    if (owed <= 0.005) continue;
    const due = nextDueISO(a.dueDay);
    const d = diffDays(todayISO(), due);
    if (d <= 5) {
      nudges.push({
        key: `card-due-${a.id}`,
        tone: "amber",
        text: copy().cardDue(a.name, fmt(owed, a.currency), humanDay(due)),
      });
    }
  }

  /* 2 — an account that can't cover its own next-10-days charges */
  for (const a of active) {
    if (a.type === "credit") continue;
    const due = chargesWithin(10, a.id).reduce((s, c) => s + convert(c.amount, c.currency, a.currency, rates), 0);
    const bal = balances[a.id] || 0;
    if (due > 0.005 && bal < due) {
      nudges.push({
        key: `low-${a.id}`,
        tone: "amber",
        text: copy().low(a.name, fmt(bal, a.currency), fmt(due, a.currency)),
      });
    }
  }

  /* 3 — a heavy renewal week ahead */
  const week = chargesWithin(7);
  const weekTotal = week.reduce((s, c) => s + convert(c.amount, c.currency, base, rates), 0);
  if (week.length >= 2 && weekTotal >= HEAVY_WEEK_BASE) {
    nudges.push({
      key: "heavy-week",
      tone: "info",
      text: copy().heavy(week.length, fmt(weekTotal, base)),
    });
  }

  /* 4 — monthly reconciliation: pull statements, match the balances.
     "Done" = any account Adjust or a backup import (both stamp the date). */
  const recAge = settings.lastReconcileAt ? diffDays(settings.lastReconcileAt, todayISO()) : null;
  if (active.length >= 2 && (recAge === null || recAge > 30)) {
    nudges.push({
      key: "reconcile",
      tone: "info",
      text: recAge === null ? copy().reconcileFirst : copy().reconcile(recAge),
    });
  }

  /* 5 — backup getting stale (only once there's real data to lose) */
  const hasData = accounts.length + recurrs.length >= 5;
  const backupAge = settings.lastBackupAt ? diffDays(settings.lastBackupAt, todayISO()) : null;
  if (hasData && (backupAge === null || backupAge > 14)) {
    nudges.push({
      key: "backup",
      tone: "info",
      text: backupAge === null ? copy().backupFirst : copy().backup(backupAge),
    });
  }

  return nudges;
}

/* First nudge that isn't snoozed (a dismissal hides that nudge for 3 days). */
export function pickNudge(nudges, snooze = {}) {
  for (const n of nudges) {
    const at = snooze[n.key];
    if (!at || diffDays(at, todayISO()) > 3) return n;
  }
  return null;
}
