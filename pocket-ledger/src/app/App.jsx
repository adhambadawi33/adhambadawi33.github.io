import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Home, Receipt, CalendarClock, Coins, Plus, Settings as SettingsIcon, Eye, EyeOff, Wallet, CheckCircle2, Inbox } from "lucide-react";
import { T, setTheme, THEME_MODES, setCurrencyLang, curLabel } from "../styles/tokens.js";
import { SaveErrorBanner, UndoToast, TypedConfirm } from "../components/common/primitives.jsx";
import HomeScreen from "../components/screens/HomeScreen.jsx";
import ActivityScreen from "../components/screens/ActivityScreen.jsx";
import PlannedScreen from "../components/screens/PlannedScreen.jsx";
import PeopleScreen from "../components/screens/PeopleScreen.jsx";
import { AddTxSheet, AccountsSheet, AccountFormSheet, RecurrSheet, DebtSheet, SettingsSheet, InboxSheet, CardsSheet, EditTxSheet, PayPlanSheet, TripSheet } from "../components/sheets/sheets.jsx";
import VoiceSheet from "../components/sheets/VoiceSheet.jsx";
import ReportSheet from "../components/sheets/ReportSheet.jsx";
import { STORAGE_KEY, LEGACY_KEYS } from "../lib/storage/adapter.js";
import { blankData, normalizeData } from "../lib/validation/schema.js";
import { computeBalances, monthlyTotals } from "../lib/finance/balances.js";
import { debtTotals } from "../lib/finance/netWorth.js";
import { planStats } from "../lib/finance/plans.js";
import { openTrip } from "../lib/finance/trips.js";
import { syncSubscriptionOnTx } from "../lib/finance/subscriptions.js";
import { computeNudges, pickNudge } from "../lib/nudges.js";
import { matchPendingToSub, subAfterPayment } from "../lib/finance/subMatch.js";
import { snapshotRates, convert, CURRENCIES } from "../lib/finance/currency.js";
import { fetchLiveRates } from "../lib/finance/fxLive.js";
import { parseSmsBatch } from "../lib/voice/sms.js";
import { learnableTokens } from "../lib/voice/parse.js";
import { todayISO, addCycle, thisMonthKey } from "../lib/dates/localDate.js";
import { daysUntilFromToday } from "../lib/dates/ui.js";
import { buildCsv, downloadText, stampedName } from "../lib/export/csv.js";
import { buildBackup, parseBackup, mergeData } from "../lib/export/backup.js";
import { makeT, applyDir, setUiLang, I18nContext } from "../i18n/index.js";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmtNet = (n, cur, hide) =>
  hide ? "•••••" : `${n < 0 ? "−" : ""}${cur === "USD" ? "$" : cur === "EUR" ? "€" : ""}${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}${["USD", "EUR"].includes(cur) ? "" : ` ${curLabel(cur)}`}`;

export default function App({ storage }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("home");
  const [hide, setHide] = useState(false);
  const [flash, setFlash] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [editAcc, setEditAcc] = useState(null);
  const [recurrKind, setRecurrKind] = useState("subscription");
  const [editRecurr, setEditRecurr] = useState(null);
  const [editTrip, setEditTrip] = useState(null);
  const [actFilter, setActFilter] = useState({ q: "", accountId: "all" });
  const [undo, setUndo] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [voiceText, setVoiceText] = useState(null);
  const [debtDraft, setDebtDraft] = useState(null);
  const [editTxTarget, setEditTxTarget] = useState(null);
  const [payPlanTarget, setPayPlanTarget] = useState(null);
  const hashConsumed = useRef(false);
  const importSmsRef = useRef(null);
  const fabPress = useRef({ timer: null, fired: false });
  const saveTimer = useRef(null);
  const undoTimer = useRef(null);

  /* Siri / Shortcuts intake: pocket-ledger.app/#add=<text> or #sms=<text>.
     Consumed on load AND on every later hash change — iOS reuses the open
     app when a Shortcut opens the link, so a one-shot read would miss it. */
  useEffect(() => {
    if (!data) return;
    const dec = (v) => { try { return decodeURIComponent(v.replace(/\+/g, "%20")); } catch { return v; } };
    const consume = () => {
      const add = /[#&]add=([^&]+)/.exec(window.location.hash || "");
      const sms = /[#&]sms=([^&]+)/.exec(window.location.hash || "");
      if (!add && !sms) return;
      if (sms) { importSmsRef.current?.(dec(sms[1])); }
      else { setVoiceText(dec(add[1])); setSheet("add"); }
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    };
    if (!hashConsumed.current) { hashConsumed.current = true; consume(); }
    window.addEventListener("hashchange", consume);
    return () => window.removeEventListener("hashchange", consume);
  }, [data]);

  /* ── load: v3 key -> backup -> legacy keys -> blank ── */
  useEffect(() => {
    let live = true;
    (async () => {
      let raw = await storage.get(STORAGE_KEY);
      if (raw == null) {
        for (const k of LEGACY_KEYS) {
          raw = await storage.get(k);
          if (raw != null) break;
        }
      }
      let parsed = null;
      if (typeof raw === "string") {
        try { parsed = JSON.parse(raw); } catch { parsed = null; }
        if (parsed === null) {
          const bak = await storage.backup(STORAGE_KEY);
          try { parsed = bak ? JSON.parse(bak) : null; } catch { parsed = null; }
        }
      }
      const { data: normalized } = normalizeData(parsed);
      if (live) {
        setData(normalized);
        /* Write back immediately so legacy-key migration is durable (§4.4). */
        storage.set(STORAGE_KEY, JSON.stringify(normalized)).then((ok) => setSaveError(!ok));
      }
    })();
    return () => { live = false; };
  }, [storage]);

  const persist = useCallback((next) => {
    storage.set(STORAGE_KEY, JSON.stringify(next)).then((ok) => setSaveError(!ok));
  }, [storage]);

  const commit = useCallback((next, now = false) => {
    next.meta = { ...next.meta, updatedAt: todayISO() };
    setData(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (now) persist(next);
    else saveTimer.current = setTimeout(() => persist(next), 400);
  }, [persist]);

  const settings = data?.settings || blankData().settings;

  /* Auto-refresh FX once per day (batch 3) — silent; snapshots keep history
     correct, so no confirm. Offline/failed fetch just keeps last rates. */
  const fxTried = useRef(false);
  useEffect(() => {
    if (!data || fxTried.current) return;
    if (import.meta.env.MODE === "test") return;
    if (data.settings.ratesUpdatedAt === todayISO()) return;
    fxTried.current = true;
    fetchLiveRates()
      .then((rates) => commit({ ...data, settings: { ...data.settings, rates, ratesUpdatedAt: todayISO() } }, true))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  /* Flag/unflag a subscription as "needs cancelling" — it moves to a
     highlighted watchlist on Planned until actually cancelled + deleted. */
  const toggleToCancel = (r) =>
    commit({ ...data, recurrs: data.recurrs.map((x) => (x.id === r.id ? { ...x, toCancel: !x.toCancel } : x)) }, true);

  const fetchRatesNow = useCallback(async () => {
    const rates = await fetchLiveRates();
    commit({ ...data, settings: { ...data.settings, rates, ratesUpdatedAt: todayISO() } }, true);
    return rates;
  }, [data, commit]);
  const base = settings.base;
  setUiLang(settings.language);
  setCurrencyLang(settings.language);
  const t = useMemo(() => makeT(settings.language), [settings.language]);
  useEffect(() => applyDir(settings.language), [settings.language]);
  /* Theme: resolved synchronously so this very render paints with the right
     palette; the document attribute + meta color follow in an effect. */
  const [systemDark, setSystemDark] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = (e) => setSystemDark(e.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  const themeMode = THEME_MODES.includes(settings.theme) ? settings.theme : "system";
  const resolvedTheme = themeMode === "system" ? (systemDark ? "dark" : "light") : themeMode;
  setTheme(resolvedTheme);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = resolvedTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", T.ink);
  }, [resolvedTheme]);

  /* ── derived ── */
  const sortedAccounts = useMemo(
    () => (data ? [...data.accounts].sort((x, y) => (x.sortOrder ?? 0) - (y.sortOrder ?? 0)) : []),
    [data]
  );
  const activeAccounts = useMemo(() => sortedAccounts.filter((a) => !a.archived), [sortedAccounts]);
  const balances = useMemo(() => (data ? computeBalances(data.accounts, data.transactions) : {}), [data]);
  /* Hero = money you actually have (banks + debit + cash); credit cards shown
     separately as an obligation (deliberate design — no daily budget). */
  const moneyGroups = useMemo(() => {
    const g = { banks: 0, cash: 0, cardOwed: 0, trust: 0 };
    for (const a of activeAccounts) {
      const v = convert(balances[a.id] || 0, a.currency, base, settings.rates);
      if (a.type === "credit") g.cardOwed += Math.max(0, -v);
      else if (a.custodial) g.trust += v; /* أمانة — not his money */
      else if (a.type === "cash") g.cash += v;
      else g.banks += v;
    }
    return { ...g, liquid: g.banks + g.cash };
  }, [activeAccounts, balances, base, settings.rates]);
  const debts = useMemo(() => (data ? debtTotals(data.debts, base, settings.rates) : { owedToMe: 0, iOwe: 0 }), [data, base, settings.rates]);
  const month = thisMonthKey();
  const monthly = useMemo(() => (data ? monthlyTotals(data.transactions, month, base) : { income: 0, expense: 0, byCategory: {} }), [data, month, base]);
  const topCats = useMemo(
    () => Object.entries(monthly.byCategory).map(([n, v]) => ({ n, v })).sort((a, b) => b.v - a.v).slice(0, 5),
    [monthly]
  );
  /* Plain-language month summary (batch 6): compares to last month at the
     SAME day-of-month, so mid-month it's a fair "at this point" comparison. */
  const insight = useMemo(() => {
    if (!data) return null;
    const day = Number(todayISO().slice(8, 10));
    const [y, m] = month.split("-").map(Number);
    const lastKey = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    const lastToDate = monthlyTotals(
      data.transactions.filter((t) => Number((t.date || "").slice(8, 10)) <= day),
      lastKey, base
    ).expense;
    const hadLast = data.transactions.some((t) => (t.date || "").startsWith(lastKey) && t.type === "expense");
    return { spent: monthly.expense, top: topCats[0] || null, second: topCats[1] || null, lastToDate, hadLast };
  }, [data, month, base, monthly, topCats]);
  const upcoming = useMemo(() => {
    if (!data) return [];
    const recs = data.recurrs
      .filter((r) => !r.paused && !(r.kind === "installment" && r.monthsPaid >= r.monthsTotal))
      .map((r) => ({ ...r, d: daysUntilFromToday(r.nextDue) }));
    /* Payment plans surface their next milestone alongside recurrings. */
    const planItems = (data.plans || [])
      .map((p) => {
        const s = planStats(p);
        if (!s.next) return null;
        return {
          id: `plan:${p.id}:${s.next.id}`, kind: "plan", name: p.name,
          amount: s.next.amount, currency: p.currency, nextDue: s.next.due,
          planId: p.id, msId: s.next.id, d: daysUntilFromToday(s.next.due),
        };
      })
      .filter(Boolean);
    return [...recs, ...planItems].sort((a, b) => a.d - b.d);
  }, [data]);
  const recent = useMemo(
    () => (data ? [...data.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4) : []),
    [data]
  );
  const filteredTx = useMemo(() => {
    if (!data) return [];
    return [...data.transactions]
      .filter((x) => actFilter.accountId === "all" || x.accountId === actFilter.accountId || x.toAccountId === actFilter.accountId)
      .filter((x) => !actFilter.q || (x.note || "").toLowerCase().includes(actFilter.q.toLowerCase()) || (x.category || "").toLowerCase().includes(actFilter.q.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [data, actFilter]);
  const txByDay = useMemo(() => {
    const g = {};
    for (const x of filteredTx) (g[x.date] = g[x.date] || []).push(x);
    return Object.entries(g).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTx]);

  const accName = useCallback((id) => data?.accounts.find((a) => a.id === id)?.name || "—", [data]);

  /* One calm nudge at most (batch 10); dismissing snoozes it for 3 days. */
  const nudge = useMemo(() => {
    if (!data) return null;
    return pickNudge(
      computeNudges({ accounts: data.accounts, recurrs: data.recurrs, plans: data.plans, balances, settings }),
      settings.nudgeSnooze
    );
  }, [data, balances, settings]);
  const dismissNudge = (key) =>
    commit({ ...data, settings: { ...settings, nudgeSnooze: { ...settings.nudgeSnooze, [key]: todayISO() } } }, true);

  /* ── undo-based deletion (handoff §4.8) ── */
  const scheduleUndo = (label, restore) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ label, restore });
    undoTimer.current = setTimeout(() => setUndo(null), 10000);
  };
  const doUndo = () => {
    if (undo) { undo.restore(); setUndo(null); }
    if (undoTimer.current) clearTimeout(undoTimer.current);
  };

  /* ── actions ── */
  const showFlash = () => { setFlash(true); setTimeout(() => setFlash(false), 750); };

  /* Self-learning (batch 13): when a voice/quick-add guess got corrected,
     remember the sentence's keywords under the chosen category. Undo on the
     toast forgets the lesson (the transaction itself stays). */
  const learnEntry = (note, category) => {
    const tokens = learnableTokens(note || "");
    return tokens.length ? { tokens, category } : null;
  };
  const withLearned = (base, learn) =>
    learn
      ? { ...base, learnedCats: { ...base.learnedCats, ...Object.fromEntries(learn.tokens.map((t) => [t, learn.category])) } }
      : base;
  const toastLearned = (next, learn) => {
    if (!learn) return;
    scheduleUndo(`Learned: ${learn.tokens.join("، ")} → ${learn.category}`, () => {
      const cleaned = { ...next.settings.learnedCats };
      for (const t of learn.tokens) delete cleaned[t];
      commit({ ...next, settings: { ...next.settings, learnedCats: cleaned } }, true);
    });
  };

  const addTx = (tx, correction, opts = {}) => {
    const learn = correction ? learnEntry(correction.note, correction.category) : null;
    /* A "Subscriptions" expense also updates the Planned list: renews the
       matching sub, or auto-adds a new one (undo removes just the sub). */
    /* Voice-logged expenses during an open trip default to "personal trip
       spend" (AddTxSheet asks explicitly; voice has no room to). Fix in Edit. */
    if (activeTrip && tx.type === "expense" && !tx.tripId && opts.voice) tx = { ...tx, tripId: activeTrip.id, tripKind: "personal" };
    const synced = syncSubscriptionOnTx(data.recurrs, tx, uid);
    const next = { ...data, recurrs: synced.recurrs, transactions: [tx, ...data.transactions], settings: withLearned({ ...settings, lastAccount: tx.accountId }, learn) };
    commit(next, true);
    showFlash();
    /* Sequential voice capture keeps the sheet open for the next sentence. */
    if (!opts.keepOpen) {
      setSheet(null);
      setVoiceText(null);
    }
    toastLearned(next, learn);
    if (synced.toast) scheduleUndo(synced.toast, () => commit({ ...next, recurrs: data.recurrs }, true));
  };
  const saveTxEdit = (tx) => {
    const old = data.transactions.find((x) => x.id === tx.id);
    const learn = old && old.category !== tx.category && tx.type !== "transfer" && tx.type !== "adjustment"
      ? learnEntry(tx.note, tx.category)
      : null;
    const next = { ...data, transactions: data.transactions.map((x) => (x.id === tx.id ? tx : x)), settings: withLearned(settings, learn) };
    commit(next, true);
    setEditTxTarget(null);
    setSheet(null);
    toastLearned(next, learn);
  };
  const delTx = (tx) => {
    const prev = data;
    commit({ ...data, transactions: data.transactions.filter((x) => x.id !== tx.id) }, true);
    scheduleUndo(`${t("deleted")}: ${tx.type === "transfer" ? "Transfer" : tx.category}`, () => commit({ ...prev }, true));
  };
  const saveAccount = (acc) => {
    const exists = data.accounts.some((a) => a.id === acc.id);
    commit({ ...data, accounts: exists ? data.accounts.map((a) => (a.id === acc.id ? acc : a)) : [...data.accounts, acc] }, true);
    setSheet("accounts");
    setEditAcc(null);
  };
  const archiveAccount = (acc) => {
    commit({ ...data, accounts: data.accounts.map((a) => (a.id === acc.id ? { ...a, archived: !a.archived } : a)) }, true);
    scheduleUndo(acc.archived ? `Shown: ${acc.name}` : `Hidden: ${acc.name}`, () =>
      commit({ ...data }, true)
    );
  };
  const moveAccount = (acc, dir) => {
    const list = [...sortedAccounts];
    const i = list.findIndex((x) => x.id === acc.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const order = new Map(list.map((x, idx) => [x.id, idx]));
    commit({ ...data, accounts: data.accounts.map((x) => ({ ...x, sortOrder: order.get(x.id) })) }, true);
  };
  const adjustAccount = (acc, diff) => {
    const tx = {
      id: uid(), type: "adjustment", date: todayISO(), amount: diff, currency: acc.currency,
      accountId: acc.id, category: "Adjustment", note: "Reconciled to actual balance",
      snapshot: snapshotRates(settings.rates),
    };
    /* Reconciling stamps the monthly check-up clock (reconcile nudge). */
    commit({ ...data, transactions: [tx, ...data.transactions], settings: { ...settings, lastReconcileAt: todayISO() } }, true);
    showFlash();
  };
  const saveRecurr = (r) => {
    const exists = data.recurrs.some((x) => x.id === r.id);
    commit({ ...data, recurrs: exists ? data.recurrs.map((x) => (x.id === r.id ? r : x)) : [...data.recurrs, r] }, true);
    setSheet(null);
    setEditRecurr(null);
  };
  const delRecurr = (r) => {
    const prev = data;
    commit({ ...data, recurrs: data.recurrs.filter((x) => x.id !== r.id) }, true);
    scheduleUndo(`${t("deleted")}: ${r.name}`, () => commit({ ...prev }, true));
  };
  /* Mark a plan milestone paid: flips the flag and logs the expense on the
     plan's account — same review-free flow as recurr "Paid". */
  /* Plan payments are huge and rare (a property plan: ~4/year) — the one
     place a review step beats undo-only (deliberate design, Jul 20). Tapping
     Paid opens PayPlanSheet to pick WHICH account (Adham's request, Aug 16:
     the villa plan had no account and confirm() silently picked the first). */
  const payPlanMilestone = (planId, msId) => {
    const plan = data.plans.find((p) => p.id === planId);
    const ms = plan?.milestones.find((m) => m.id === msId);
    if (!plan || !ms || ms.paid) return;
    setPayPlanTarget({ plan, ms });
    setSheet("pay-plan");
  };
  const confirmPayPlan = (planId, msId, accountId, remember) => {
    const plan = data.plans.find((p) => p.id === planId);
    const ms = plan?.milestones.find((m) => m.id === msId);
    const acct = data.accounts.find((a) => a.id === accountId && !a.archived);
    if (!plan || !ms || ms.paid || !acct) return;
    const tx = [{
      id: uid(), date: todayISO(), type: "expense", amount: ms.amount, currency: plan.currency,
      accountId: acct.id, category: "Installments",
      note: `${plan.name}${ms.label ? ` · ${ms.label}` : ""}`, snapshot: snapshotRates(settings.rates),
    }];
    const plans = data.plans.map((p) =>
      p.id === planId
        ? { ...p, ...(remember ? { accountId: acct.id } : {}), milestones: p.milestones.map((m) => (m.id === msId ? { ...m, paid: true } : m)) }
        : p
    );
    setSheet(null); setPayPlanTarget(null);
    /* One accidental tap here books a huge payment — undo restores the
       milestone AND the logged transaction together. */
    const prev = data;
    commit({ ...data, plans, transactions: [...tx, ...data.transactions] }, true);
    showFlash();
    scheduleUndo(t("common.paidUndo", { name: plan.name }), () => commit({ ...prev }, true));
  };
  /* Trips (Aug 2026): a tag over expenses while travelling — see lib/finance/trips.js. */
  const activeTrip = useMemo(() => (data ? openTrip(data.trips) : null), [data]);
  const saveTrip = (tr) => {
    const exists = (data.trips || []).some((x) => x.id === tr.id);
    /* Only one trip open at a time — opening this one closes the others. */
    const trips = (exists ? data.trips.map((x) => (x.id === tr.id ? tr : x)) : [...(data.trips || []), tr])
      .map((x) => (tr.open && x.id !== tr.id && x.open ? { ...x, open: false, endDate: x.endDate || todayISO() } : x));
    commit({ ...data, trips }, true); setSheet(null); setEditTrip(null); showFlash();
  };
  const closeTrip = (tr) => commit({ ...data, trips: data.trips.map((x) => (x.id === tr.id ? { ...x, open: false, endDate: todayISO() } : x)) }, true);
  const delTrip = (tr) => {
    const prev = data;
    commit({ ...data, trips: data.trips.filter((x) => x.id !== tr.id), transactions: data.transactions.map((t) => (t.tripId === tr.id ? (({ tripId: _tripId, tripKind: _tripKind, ...rest }) => rest)(t) : t)) }, true);
    scheduleUndo(`${t("deleted")}: ${tr.name}`, () => commit({ ...prev }, true));
  };
  /* Work share → one receivable on the company (the trip remembers it). */
  const settleTrip = (tr, workAmount) => {
    if (!(workAmount > 0)) return;
    const debt = { id: uid(), person: `Paradigm — ${tr.name}`, direction: "lent", noReturn: false, amount: Math.round(workAmount * 100) / 100, currency: tr.currency, repaid: 0, note: "Work expenses on the trip — company pays back", date: todayISO() };
    commit({ ...data, debts: [...data.debts, debt], trips: data.trips.map((x) => (x.id === tr.id ? { ...x, settledDebtId: debt.id } : x)) }, true);
    showFlash();
  };
  const delPlan = (p) => {
    const prev = data;
    commit({ ...data, plans: data.plans.filter((x) => x.id !== p.id) }, true);
    scheduleUndo(`${t("deleted")}: ${p.name}`, () => commit({ ...prev }, true));
  };

  const markPaid = (r) => {
    if (r.kind === "plan") return payPlanMilestone(r.planId, r.msId);
    const acct = data.accounts.find((a) => a.id === r.accountId && !a.archived) || activeAccounts[0];
    const tx = acct
      ? [{
          id: uid(), date: todayISO(), type: "expense", amount: r.amount, currency: r.currency,
          accountId: acct.id, category: r.kind === "subscription" ? "Subscriptions" : "Installments",
          note: r.name, snapshot: snapshotRates(settings.rates),
        }]
      : [];
    const recurrs = data.recurrs.map((x) => {
      if (x.id !== r.id) return x;
      const monthsPaid = x.kind === "installment" ? Math.min(x.monthsTotal, (x.monthsPaid || 0) + 1) : x.monthsPaid;
      return { ...x, nextDue: addCycle(x.nextDue, x.cycle), ...(x.kind === "installment" ? { monthsPaid } : {}) };
    });
    /* "Paid" does TWO things (log expense + push next due) — deleting the
       transaction later only undoes one. Undo here reverts both at once. */
    const prev = data;
    commit({ ...data, recurrs, transactions: [...tx, ...data.transactions] }, true);
    showFlash();
    scheduleUndo(t("common.paidUndo", { name: r.name }), () => commit({ ...prev }, true));
  };
  const importSmsText = (text) => {
    const { items, skipped } = parseSmsBatch(text, data.accounts);
    if (items.length === 0) {
      window.alert(skipped ? "لم أتعرف على أي عملية بنكية في النص الملصوق." : "لا يوجد نص لاستيراده.");
      return;
    }
    const existing = new Set(data.pending.map((x) => x.rawText));
    const fresh = items.filter((x) => !existing.has(x.rawText));
    commit({ ...data, pending: [...fresh, ...data.pending] }, true);
    setSheet("inbox");
    showFlash();
  };
  importSmsRef.current = importSmsText;
  /* Returns false when the clipboard can't be read (iOS PWA) — the Inbox
     then shows a manual paste box instead of a dead-end alert. */
  const pasteSms = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t?.trim()) return false;
      importSmsText(t);
      return true;
    } catch {
      return false;
    }
  };
  const approvePending = (p, accountId, batchData, subId) => {
    const src = batchData || data;
    const linkedSub = subId ? src.recurrs.find((r) => r.id === subId) : null;
    const tx = {
      id: uid(), type: p.direction, date: p.date, amount: p.amount, currency: p.currency,
      accountId,
      /* Linked to a subscription → it IS that subscription's charge. */
      category: linkedSub ? "Subscriptions" : p.category || (p.direction === "income" ? "Other income" : "Other"),
      note: linkedSub ? `${linkedSub.name} · SMS` : p.merchant ? `${p.merchant} · SMS` : "Bank SMS",
      snapshot: snapshotRates(settings.rates),
    };
    const next = {
      ...src,
      transactions: [tx, ...src.transactions],
      /* One approval = expense logged AND the subscription ticked over
         (next cycle + adopt the newly charged price) — no manual Paid. */
      recurrs: linkedSub ? src.recurrs.map((r) => (r.id === subId ? subAfterPayment(r, p, addCycle) : r)) : src.recurrs,
      pending: src.pending.filter((x) => x.id !== p.id),
      settings: { ...src.settings, lastAccount: accountId },
    };
    if (!batchData) { commit(next, true); showFlash(); }
    return next;
  };
  const approveAllPending = (pairs) => {
    let next = data;
    for (const { p, accountId, subId } of pairs) next = approvePending(p, accountId, next, subId);
    commit(next, true);
    showFlash();
  };

  /* Which pending SMS item pays which subscription — shown on inbox cards. */
  const pendingMatches = useMemo(() => {
    if (!data) return {};
    const out = {};
    for (const p of data.pending) {
      const m = matchPendingToSub(p, data.recurrs, settings.rates);
      if (m) out[p.id] = { subId: m.sub.id, name: m.sub.name, byName: m.byName };
    }
    return out;
  }, [data, settings.rates]);
  const dismissPending = (p) => {
    const prev = data;
    commit({ ...data, pending: data.pending.filter((x) => x.id !== p.id) }, true);
    scheduleUndo(`${t("deleted")}: ${p.merchant || "SMS item"}`, () => commit({ ...prev }, true));
  };

  const saveDebt = (d) => { commit({ ...data, debts: [...data.debts, d] }, true); setSheet(null); setDebtDraft(null); showFlash(); };
  const payDebt = (id, amt) =>
    commit({ ...data, debts: data.debts.map((x) => (x.id === id ? { ...x, repaid: Math.max(0, Math.min(x.amount, x.repaid + amt)) } : x)) }, true);
  const delDebt = (d) => {
    const prev = data;
    commit({ ...data, debts: data.debts.filter((x) => x.id !== d.id) }, true);
    scheduleUndo(`${t("deleted")}: ${d.person}`, () => commit({ ...prev }, true));
  };
  const setBudget = (cat, v) => {
    const budgets = { ...data.budgets };
    if (v === "" || +v <= 0) delete budgets[cat];
    else budgets[cat] = +v;
    commit({ ...data, budgets });
  };
  const setBase = (b) => commit({ ...data, settings: { ...settings, base: b } }, true);
  const setPref = (key, value) => commit({ ...data, settings: { ...settings, [key]: value } }, true);
  const saveRates = (rates) => {
    const changed = CURRENCIES.some((c) => c !== "USD" && rates[c] !== settings.rates[c]);
    if (changed && !window.confirm("New rates change live balance totals from now on. Past entries keep their original rates. Continue?")) return;
    commit({ ...data, settings: { ...settings, rates, ratesUpdatedAt: todayISO() } }, true);
  };

  const exportCsv = () => downloadText(buildCsv(data, accName), stampedName("pocket-ledger", "csv"));
  const exportBackup = () => {
    downloadText(buildBackup(data), stampedName("pocket-ledger-backup", "json"), "application/json");
    commit({ ...data, settings: { ...settings, lastBackupAt: todayISO() } }, true);
  };
  const importBackup = async (file) => {
    const text = await file.text();
    const res = parseBackup(text);
    if (res.error) { window.alert(res.error); return; }
    const { summary } = res;
    /* Safe-by-default import: OK adds (merge, nothing lost); replacing
       everything needs a second, explicit confirmation. */
    const counts = `${summary.accounts} accounts, ${summary.transactions} transactions, ${summary.recurring} recurring, ${summary.debts} loans${summary.plans ? `, ${summary.plans} payment plans` : ""}`;
    const merge = window.confirm(`This file contains ${counts}.\n\nOK = ADD it to your current data (safe — nothing is deleted).\nCancel = more options.`);
    let next = null;
    if (merge) next = mergeData(data, res.data);
    else if (window.confirm("REPLACE everything with this file instead?\n\nOK = wipe current data and use the file.\nCancel = do nothing.")) next = res.data;
    if (!next) return;
    await storage.set(`${STORAGE_KEY}:pre-import`, JSON.stringify(data));
    /* An import is a reconciliation too — numbers just came from statements. */
    commit({ ...next, settings: { ...next.settings, lastReconcileAt: todayISO() } }, true);
    setSheet(null);
  };
  const resetAll = () => { commit(blankData(), true); setResetOpen(false); setSheet(null); };

  /* ── loading ── */
  if (!data)
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.paper }}>
        <span className="ui text-sm animate-pulse" style={{ color: T.faint }}>{makeT(settings.language)("common.loading")}</span>
      </div>
    );

  const TABS = [
    { id: "home", label: t("tabs.home"), I: Home },
    { id: "activity", label: t("tabs.activity"), I: Receipt },
    { id: "planned", label: t("tabs.planned"), I: CalendarClock },
    { id: "people", label: t("tabs.people"), I: Coins },
  ];
  const dueTone = (d) =>
    d < 0 ? { c: T.rose, bg: T.roseBg, t: t("common.overdue", { d: -d }) }
      : d === 0 ? { c: T.amber, bg: T.amberBg, t: t("common.dueToday") }
      : d <= 3 ? { c: T.amber, bg: T.amberBg, t: t("common.inDays", { d }) }
      : { c: T.sub, bg: T.paper, t: t("common.inDays", { d }) };

  return (
    <I18nContext.Provider value={t}>
    <div className="min-h-screen flex justify-center">
      <div className="relative w-full max-w-md min-h-screen flex flex-col" style={{ background: T.paper }}>
        <SaveErrorBanner show={saveError} message={t("saveError")} />

        {/* header */}
        {/* Home carries the full money picture. Every other tab gets a one-line
            strip so the screen's own answer sits above the fold. */}
        {tab !== "home" ? (
          <header className="app-chrome px-5 py-2.5 flex items-center justify-between gap-3" style={{ background: T.ink }}>
            <button onClick={() => setTab("home")} className="tap flex items-center gap-2.5 min-w-0 min-h-[44px]" aria-label={t("common.goHome")}>
              <span className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: T.gold }}>
                <Wallet size={14} style={{ color: T.ink }} aria-hidden="true" />
              </span>
              <span className="flex flex-col items-start min-w-0">
                <span className="ui text-[10px] leading-none" style={{ color: "#93A08D" }}>{t("header.strip")}</span>
                <span className="mono text-[15px] leading-tight truncate" style={{ color: "#fff" }}>{fmtNet(Math.round(moneyGroups.liquid), base, hide)}</span>
              </span>
            </button>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => setSheet("inbox")} className="tap relative h-11 w-11 rounded-full flex items-center justify-center" style={{ background: T.inkSoft, color: data.pending.length > 0 ? T.gold : "#AAB8C9" }} aria-label={data.pending.length > 0 ? t("common.inboxN", { n: data.pending.length }) : t("common.inbox")}>
                <Inbox size={16} />
                {data.pending.length > 0 && (
                  <span className="mono absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] flex items-center justify-center" style={{ background: T.gold, color: T.ink }}>{data.pending.length}</span>
                )}
              </button>
              <button onClick={() => setHide(!hide)} className="tap h-11 w-11 rounded-full flex items-center justify-center" style={{ background: T.inkSoft, color: "#AAB8C9" }} aria-label={hide ? t("common.showAmounts") : t("common.hideAmounts")} aria-pressed={hide}>
                {hide ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={() => setSheet("settings")} className="tap h-11 w-11 rounded-full flex items-center justify-center" style={{ background: T.inkSoft, color: "#AAB8C9" }} aria-label={t("common.settings")}>
                <SettingsIcon size={16} />
              </button>
            </div>
          </header>
        ) : (
        <header className="app-chrome px-5 pt-5 pb-4" style={{ background: T.ink }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: T.gold }}>
                <Wallet size={16} style={{ color: T.ink }} aria-hidden="true" />
              </div>
              <span className="disp text-lg" style={{ color: "#fff" }}>Pocket Ledger</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Always visible — it's also the only door to "Paste bank SMS",
                  so hiding it when empty left no way in (the user got stuck). */}
              <button onClick={() => setSheet("inbox")} className="tap relative h-11 w-11 rounded-full flex items-center justify-center" style={{ background: T.inkSoft, color: data.pending.length > 0 ? T.gold : "#AAB8C9" }} aria-label={data.pending.length > 0 ? t("common.inboxN", { n: data.pending.length }) : t("common.inbox")}>
                <Inbox size={16} />
                {data.pending.length > 0 && (
                  <span className="mono absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] flex items-center justify-center" style={{ background: T.gold, color: T.ink }}>{data.pending.length}</span>
                )}
              </button>
              <button onClick={() => setHide(!hide)} className="tap h-11 w-11 rounded-full flex items-center justify-center" style={{ background: T.inkSoft, color: "#AAB8C9" }} aria-label={hide ? t("common.showAmounts") : t("common.hideAmounts")} aria-pressed={hide}>
                {hide ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={() => setSheet("settings")} className="tap h-11 w-11 rounded-full flex items-center justify-center" style={{ background: T.inkSoft, color: "#AAB8C9" }} aria-label={t("common.settings")}>
                <SettingsIcon size={16} />
              </button>
            </div>
          </div>
          <div className="ui text-[11px] uppercase tracking-widest mb-1" style={{ color: "#93A08D" }}>{t("header.total")}</div>
          <div className="mono text-[36px] leading-none" style={{ color: "#fff" }}>{fmtNet(Math.round(moneyGroups.liquid), base, hide)}</div>
          <div className="flex flex-wrap gap-2 mt-3.5">
            <HeadStat label={t("header.banks")} v={hide ? "•••••" : Math.round(moneyGroups.banks).toLocaleString("en-US")} />
            <HeadStat label={t("header.cash")} v={hide ? "•••••" : Math.round(moneyGroups.cash).toLocaleString("en-US")} />
            {moneyGroups.cardOwed > 0.005 && <HeadStat owe label={t("header.owedCards")} v={hide ? "•••••" : Math.round(moneyGroups.cardOwed).toLocaleString("en-US")} />}
            {moneyGroups.trust > 0.005 && <HeadStat label={t("header.trust")} v={hide ? "•••••" : Math.round(moneyGroups.trust).toLocaleString("en-US")} />}
          </div>
        </header>
        )}

        {/* body */}
        <main className="app-chrome flex-1 px-4 pt-5" style={{ paddingBottom: "calc(110px + env(safe-area-inset-bottom))" }}>
          {tab === "home" && (
            <HomeScreen
              nudge={nudge} onDismissNudge={dismissNudge}
              accounts={activeAccounts} balances={balances} upcoming={upcoming} topCats={topCats}
              monthExpense={monthly.expense} recent={recent} hide={hide} accName={accName} base={base} dueTone={dueTone}
              rates={settings.rates}
              groupLabels={{ banks: t("groups.banks"), cards: t("groups.cards"), cash: t("groups.cash"), trust: t("groups.trust") }}
              onManageAccounts={() => setSheet("accounts")}
              onOpenCards={() => setSheet("cards")}
              onOpenPlanned={() => setTab("planned")}
              onOpenActivity={() => setTab("activity")}
              onDelTx={delTx} onPaid={markPaid}
              onAccountTap={(a) => { setActFilter({ ...actFilter, accountId: a.id }); setTab("activity"); }}
            />
          )}
          {tab === "activity" && (
            <ActivityScreen txByDay={txByDay} filter={actFilter} setFilter={setActFilter} accounts={activeAccounts} hide={hide} accName={accName} onDelTx={delTx} onEditTx={(t) => { setEditTxTarget(t); setSheet("edit-tx"); }} onExport={exportCsv} onOpenReport={() => setSheet("report")} insight={insight} base={base} />
          )}
          {tab === "planned" && (
            <PlannedScreen
              recurrs={data.recurrs} plans={data.plans} upcoming={upcoming} budgets={data.budgets} monthByCat={monthly.byCategory} base={base} rates={settings.rates} hide={hide} accName={accName}
              onAddRecurr={(k) => { setRecurrKind(k); setEditRecurr(null); setSheet("recurr"); }}
              onEditRecurr={(r) => { setRecurrKind(r.kind); setEditRecurr(r); setSheet("recurr"); }}
              onPaid={markPaid} onDelRecurr={delRecurr} onToggleCancel={toggleToCancel} dueTone={dueTone} setBudget={setBudget}
              onPayMilestone={payPlanMilestone} onDelPlan={delPlan}
              trips={data.trips || []} transactions={data.transactions}
              onAddTrip={() => { setEditTrip(null); setSheet("trip"); }} onEditTrip={(tr) => { setEditTrip(tr); setSheet("trip"); }}
              onCloseTrip={closeTrip} onDelTrip={delTrip} onSettleTrip={settleTrip}
            />
          )}
          {tab === "people" && (
            <PeopleScreen debts={data.debts} transactions={data.transactions} owedToMe={debts.owedToMe} iOwe={debts.iOwe} base={base} rates={settings.rates} hide={hide} onAddDebt={() => setSheet("debt")} onPay={payDebt} onDelDebt={delDebt} />
          )}
        </main>

        {/* tab bar + FAB */}
        <nav className="app-chrome fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30" style={{ background: T.navBg, backdropFilter: "saturate(1.3) blur(14px)", WebkitBackdropFilter: "saturate(1.3) blur(14px)", borderTop: `1px solid ${T.line}`, paddingBottom: "env(safe-area-inset-bottom)" }} aria-label={t("common.mainNav")}>
          <div className="relative flex items-stretch justify-around px-2 pt-1.5 pb-2">
            {TABS.slice(0, 2).map((x) => <TabBtn key={x.id} t={x} on={tab === x.id} set={setTab} />)}
            <div className="w-16" aria-hidden="true" />
            {TABS.slice(2).map((x) => <TabBtn key={x.id} t={x} on={tab === x.id} set={setTab} />)}
            {/* Tap = keyboard entry. LONG-press = big-mic voice entry (batch 8). */}
            <button
              onPointerDown={() => {
                fabPress.current.fired = false;
                fabPress.current.timer = setTimeout(() => { fabPress.current.fired = true; setSheet("voice"); }, 420);
              }}
              onPointerUp={() => clearTimeout(fabPress.current.timer)}
              onPointerLeave={() => clearTimeout(fabPress.current.timer)}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => { if (!fabPress.current.fired) setSheet("add"); }}
              aria-label={t("common.addTx")}
              className="tap absolute left-1/2 -translate-x-1/2 -top-6 h-14 w-14 rounded-full flex items-center justify-center"
              style={{ background: `linear-gradient(145deg, ${T.gold}, ${T.goldDeep})`, color: T.ink, boxShadow: "0 6px 18px rgba(169,133,63,0.45)", WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none", touchAction: "manipulation" }}
            >
              <Plus size={26} strokeWidth={2.5} />
            </button>
          </div>
        </nav>

        {flash && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none" aria-hidden="true">
            <div className="pop rounded-3xl px-8 py-6 flex flex-col items-center gap-2" style={{ background: "rgba(15,27,45,0.92)" }}>
              <CheckCircle2 size={40} style={{ color: T.gold }} />
              <span className="ui text-sm" style={{ color: "#fff" }}>{t("common.logged")}</span>
            </div>
          </div>
        )}
        <UndoToast toast={undo} onUndo={doUndo} />
        <TypedConfirm open={resetOpen} word={t("resetConfirmWord")} onCancel={() => setResetOpen(false)} onConfirm={resetAll} />

        {/* sheets */}
        <AddTxSheet
          open={sheet === "add"} onClose={() => { setSheet(null); setVoiceText(null); }} accounts={activeAccounts} settings={settings}
          onSave={addTx} goAccounts={() => setSheet("accounts")} initialText={voiceText} trip={activeTrip}
          onDebtDraft={(p) => { setDebtDraft(p); setVoiceText(null); setSheet("debt"); }}
        />
        <VoiceSheet
          open={sheet === "voice"} onClose={() => setSheet(null)} accounts={activeAccounts} settings={settings}
          onSave={addTx}
          onDebtDraft={(p) => { setDebtDraft(p); setSheet("debt"); }}
          onTypeInstead={(text) => { setVoiceText(text || null); setSheet("add"); }}
        />
        <AccountsSheet open={sheet === "accounts"} onClose={() => setSheet(null)} accounts={sortedAccounts} balances={balances} hide={hide} onMove={moveAccount} onNew={() => { setEditAcc(null); setSheet("account-form"); }} onEdit={(a) => { setEditAcc(a); setSheet("account-form"); }} onArchive={archiveAccount} onAdjust={adjustAccount} />
        <AccountFormSheet open={sheet === "account-form"} onClose={() => setSheet("accounts")} initial={editAcc} onSave={saveAccount} currentBalance={editAcc ? balances[editAcc.id] : 0} />
        <RecurrSheet open={sheet === "recurr"} onClose={() => { setSheet(null); setEditRecurr(null); }} kind={recurrKind} accounts={activeAccounts} onSave={saveRecurr} initial={editRecurr} />
        <InboxSheet open={sheet === "inbox"} onClose={() => setSheet(null)} pending={data.pending} accounts={activeAccounts} matches={pendingMatches} onPasteImport={pasteSms} onManualImport={importSmsText} onApprove={approvePending} onDismiss={dismissPending} onApproveAll={approveAllPending} />
        <TripSheet open={sheet === "trip"} onClose={() => { setSheet(null); setEditTrip(null); }} onSave={saveTrip} initial={editTrip} />
        <DebtSheet open={sheet === "debt"} onClose={() => { setSheet(null); setDebtDraft(null); }} onSave={saveDebt} initial={debtDraft} />
        <PayPlanSheet open={sheet === "pay-plan"} onClose={() => { setSheet(null); setPayPlanTarget(null); }} target={payPlanTarget} accounts={activeAccounts} onConfirm={confirmPayPlan} />
        <EditTxSheet open={sheet === "edit-tx"} onClose={() => { setSheet(null); setEditTxTarget(null); }} tx={editTxTarget} accounts={activeAccounts} onSave={saveTxEdit} trips={data.trips || []} />
        <CardsSheet open={sheet === "cards"} onClose={() => setSheet(null)} cards={activeAccounts.filter((a) => a.type === "credit")} balances={balances} hide={hide} base={base} rates={settings.rates} />
        <ReportSheet open={sheet === "report"} onClose={() => setSheet(null)} data={data} base={base} hide={hide} accName={accName} />
        <SettingsSheet
          open={sheet === "settings"} onClose={() => setSheet(null)} settings={settings}
          counts={{ tx: data.transactions.length, accounts: data.accounts.length, recurrs: data.recurrs.length, debts: data.debts.length }}
          onBase={setBase} onPref={setPref} onSaveRates={saveRates} onFetchRates={fetchRatesNow} onExportCsv={exportCsv} onExportBackup={exportBackup}
          onImportBackup={importBackup} onResetRequest={() => setResetOpen(true)} backendName={storage.backendName}
        />
      </div>
    </div>
    </I18nContext.Provider>
  );
}

function HeadStat({ label, v, owe }) {
  return (
    <div className="flex-1 min-w-0 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", minWidth: "28%" }}>
      <div className="ui text-[10px] mb-0.5 truncate" style={{ color: "#93A08D" }}>{label}</div>
      <div className="mono text-[13px] truncate" style={{ color: owe ? "#E9B7A0" : "#EEF1E8" }}>{v}</div>
    </div>
  );
}

function TabBtn({ t, on, set }) {
  return (
    <button onClick={() => set(t.id)} aria-current={on ? "page" : undefined} className="tap flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-h-[44px]" style={{ color: on ? T.inkText : T.sub }}>
      <t.I size={20} strokeWidth={on ? 2.4 : 2} aria-hidden="true" />
      <span className="ui text-[10px]" style={{ fontWeight: on ? 600 : 400 }}>{t.label}</span>
    </button>
  );
}
