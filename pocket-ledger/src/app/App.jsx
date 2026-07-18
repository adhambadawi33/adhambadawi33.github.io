import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Home, Receipt, CalendarClock, Coins, Plus, Settings as SettingsIcon, Eye, EyeOff, Wallet, CheckCircle2, Inbox } from "lucide-react";
import { T } from "../styles/tokens.js";
import { SaveErrorBanner, UndoToast, TypedConfirm } from "../components/common/primitives.jsx";
import HomeScreen from "../components/screens/HomeScreen.jsx";
import ActivityScreen from "../components/screens/ActivityScreen.jsx";
import PlannedScreen from "../components/screens/PlannedScreen.jsx";
import PeopleScreen from "../components/screens/PeopleScreen.jsx";
import { AddTxSheet, AccountsSheet, AccountFormSheet, RecurrSheet, DebtSheet, SettingsSheet, InboxSheet, CardsSheet } from "../components/sheets/sheets.jsx";
import VoiceSheet from "../components/sheets/VoiceSheet.jsx";
import { STORAGE_KEY, LEGACY_KEYS } from "../lib/storage/adapter.js";
import { blankData, normalizeData } from "../lib/validation/schema.js";
import { computeBalances, monthlyTotals } from "../lib/finance/balances.js";
import { debtTotals } from "../lib/finance/netWorth.js";
import { planStats } from "../lib/finance/plans.js";
import { snapshotRates, convert } from "../lib/finance/currency.js";
import { fetchLiveRates } from "../lib/finance/fxLive.js";
import { parseSmsBatch } from "../lib/voice/sms.js";
import { todayISO, addCycle, thisMonthKey } from "../lib/dates/localDate.js";
import { daysUntilFromToday } from "../lib/dates/ui.js";
import { buildCsv, downloadText, stampedName } from "../lib/export/csv.js";
import { buildBackup, parseBackup, mergeData } from "../lib/export/backup.js";
import { makeT, applyDir } from "../i18n/index.js";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmtNet = (n, cur, hide) =>
  hide ? "•••••" : `${n < 0 ? "−" : ""}${cur === "USD" ? "$" : ""}${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}${cur === "USD" ? "" : ` ${cur}`}`;

export default function App({ storage }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("home");
  const [hide, setHide] = useState(false);
  const [flash, setFlash] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [editAcc, setEditAcc] = useState(null);
  const [recurrKind, setRecurrKind] = useState("subscription");
  const [actFilter, setActFilter] = useState({ q: "", accountId: "all" });
  const [undo, setUndo] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [voiceText, setVoiceText] = useState(null);
  const [debtDraft, setDebtDraft] = useState(null);
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
  const t = useMemo(() => makeT(settings.language), [settings.language]);
  useEffect(() => applyDir(settings.language), [settings.language]);

  /* ── derived ── */
  const sortedAccounts = useMemo(
    () => (data ? [...data.accounts].sort((x, y) => (x.sortOrder ?? 0) - (y.sortOrder ?? 0)) : []),
    [data]
  );
  const activeAccounts = useMemo(() => sortedAccounts.filter((a) => !a.archived), [sortedAccounts]);
  const balances = useMemo(() => (data ? computeBalances(data.accounts, data.transactions) : {}), [data]);
  /* Hero = money you actually have (banks + debit + cash); credit cards shown
     separately as an obligation (design decision with Adham — no daily budget). */
  const moneyGroups = useMemo(() => {
    const g = { banks: 0, cash: 0, cardOwed: 0 };
    for (const a of activeAccounts) {
      const v = convert(balances[a.id] || 0, a.currency, base, settings.rates);
      if (a.type === "credit") g.cardOwed += Math.max(0, -v);
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

  /* ── undo-based deletion (handoff §4.8) ── */
  const scheduleUndo = (label, restore) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ label, restore });
    undoTimer.current = setTimeout(() => setUndo(null), 6000);
  };
  const doUndo = () => {
    if (undo) { undo.restore(); setUndo(null); }
    if (undoTimer.current) clearTimeout(undoTimer.current);
  };

  /* ── actions ── */
  const showFlash = () => { setFlash(true); setTimeout(() => setFlash(false), 750); };

  const addTx = (tx) => {
    commit({ ...data, transactions: [tx, ...data.transactions], settings: { ...settings, lastAccount: tx.accountId } }, true);
    showFlash();
    setSheet(null);
    setVoiceText(null);
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
    commit({ ...data, transactions: [tx, ...data.transactions] }, true);
    showFlash();
  };
  const saveRecurr = (r) => { commit({ ...data, recurrs: [...data.recurrs, r] }, true); setSheet(null); };
  const delRecurr = (r) => {
    const prev = data;
    commit({ ...data, recurrs: data.recurrs.filter((x) => x.id !== r.id) }, true);
    scheduleUndo(`${t("deleted")}: ${r.name}`, () => commit({ ...prev }, true));
  };
  /* Mark a plan milestone paid: flips the flag and logs the expense on the
     plan's account — same review-free flow as recurr "Paid". */
  const payPlanMilestone = (planId, msId) => {
    const plan = data.plans.find((p) => p.id === planId);
    const ms = plan?.milestones.find((m) => m.id === msId);
    if (!plan || !ms || ms.paid) return;
    const acct = data.accounts.find((a) => a.id === plan.accountId && !a.archived) || activeAccounts[0];
    const tx = acct
      ? [{
          id: uid(), date: todayISO(), type: "expense", amount: ms.amount, currency: plan.currency,
          accountId: acct.id, category: "Installments",
          note: `${plan.name}${ms.label ? ` · ${ms.label}` : ""}`, snapshot: snapshotRates(settings.rates),
        }]
      : [];
    const plans = data.plans.map((p) =>
      p.id === planId ? { ...p, milestones: p.milestones.map((m) => (m.id === msId ? { ...m, paid: true } : m)) } : p
    );
    commit({ ...data, plans, transactions: [...tx, ...data.transactions] }, true);
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
    commit({ ...data, recurrs, transactions: [...tx, ...data.transactions] }, true);
    showFlash();
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
  const approvePending = (p, accountId, batchData) => {
    const src = batchData || data;
    const tx = {
      id: uid(), type: p.direction, date: p.date, amount: p.amount, currency: p.currency,
      accountId, category: p.category || (p.direction === "income" ? "Other income" : "Other"),
      note: p.merchant ? `${p.merchant} · SMS` : "Bank SMS",
      snapshot: snapshotRates(settings.rates),
    };
    const next = {
      ...src,
      transactions: [tx, ...src.transactions],
      pending: src.pending.filter((x) => x.id !== p.id),
      settings: { ...src.settings, lastAccount: accountId },
    };
    if (!batchData) { commit(next, true); showFlash(); }
    return next;
  };
  const approveAllPending = (pairs) => {
    let next = data;
    for (const { p, accountId } of pairs) next = approvePending(p, accountId, next);
    commit(next, true);
    showFlash();
  };
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
  const saveRates = (rates) => {
    const changed = ["AED", "SAR", "EGP"].some((c) => rates[c] !== settings.rates[c]);
    if (changed && !window.confirm("New rates change live balance totals from now on. Past entries keep their original rates. Continue?")) return;
    commit({ ...data, settings: { ...settings, rates, ratesUpdatedAt: todayISO() } }, true);
  };

  const exportCsv = () => downloadText(buildCsv(data, accName), stampedName("pocket-ledger", "csv"));
  const exportBackup = () => downloadText(buildBackup(data), stampedName("pocket-ledger-backup", "json"), "application/json");
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
    commit(next, true);
    setSheet(null);
  };
  const resetAll = () => { commit(blankData(), true); setResetOpen(false); setSheet(null); };

  /* ── loading ── */
  if (!data)
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.paper }}>
        <span className="ui text-sm animate-pulse" style={{ color: T.faint }}>Opening your ledger…</span>
      </div>
    );

  const TABS = [
    { id: "home", label: t("tabs.home"), I: Home },
    { id: "activity", label: t("tabs.activity"), I: Receipt },
    { id: "planned", label: t("tabs.planned"), I: CalendarClock },
    { id: "people", label: t("tabs.people"), I: Coins },
  ];
  const dueTone = (d) =>
    d < 0 ? { c: T.rose, bg: T.roseBg, t: `${-d}d overdue` }
      : d === 0 ? { c: T.amber, bg: T.amberBg, t: "Due today" }
      : d <= 3 ? { c: T.amber, bg: T.amberBg, t: `In ${d}d` }
      : { c: T.sub, bg: T.paper, t: `In ${d}d` };

  return (
    <div className="min-h-screen flex justify-center">
      <div className="relative w-full max-w-md min-h-screen flex flex-col" style={{ background: T.paper }}>
        <SaveErrorBanner show={saveError} message={t("saveError")} />

        {/* header */}
        <header className="px-5 pt-5 pb-4" style={{ background: T.ink }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: T.gold }}>
                <Wallet size={16} style={{ color: T.ink }} aria-hidden="true" />
              </div>
              <span className="disp text-lg" style={{ color: "#fff" }}>Pocket Ledger</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Always visible — it's also the only door to "Paste bank SMS",
                  so hiding it when empty left no way in (Adham got stuck). */}
              <button onClick={() => setSheet("inbox")} className="tap relative h-10 w-10 rounded-full flex items-center justify-center" style={{ background: T.inkSoft, color: data.pending.length > 0 ? T.gold : "#AAB8C9" }} aria-label={data.pending.length > 0 ? `Approval inbox: ${data.pending.length} waiting` : "Approval inbox"}>
                <Inbox size={16} />
                {data.pending.length > 0 && (
                  <span className="mono absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] flex items-center justify-center" style={{ background: T.gold, color: T.ink }}>{data.pending.length}</span>
                )}
              </button>
              <button onClick={() => setHide(!hide)} className="tap h-10 w-10 rounded-full flex items-center justify-center" style={{ background: T.inkSoft, color: "#AAB8C9" }} aria-label={hide ? "Show amounts" : "Hide amounts"} aria-pressed={hide}>
                {hide ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={() => setSheet("settings")} className="tap h-10 w-10 rounded-full flex items-center justify-center" style={{ background: T.inkSoft, color: "#AAB8C9" }} aria-label="Settings">
                <SettingsIcon size={16} />
              </button>
            </div>
          </div>
          <div className="ui text-[11px] uppercase tracking-widest mb-1" style={{ color: "#93A08D" }}>{t("header.total")}</div>
          <div className="mono text-[36px] leading-none" style={{ color: "#fff" }}>{fmtNet(Math.round(moneyGroups.liquid), base, hide)}</div>
          <div className="flex gap-2 mt-3.5">
            <HeadStat label={t("header.banks")} v={hide ? "•••••" : Math.round(moneyGroups.banks).toLocaleString("en-US")} />
            <HeadStat label={t("header.cash")} v={hide ? "•••••" : Math.round(moneyGroups.cash).toLocaleString("en-US")} />
            {moneyGroups.cardOwed > 0.005 && <HeadStat owe label={t("header.owedCards")} v={hide ? "•••••" : Math.round(moneyGroups.cardOwed).toLocaleString("en-US")} />}
          </div>
        </header>

        {/* body */}
        <main className="flex-1 px-4 pt-5" style={{ paddingBottom: "calc(110px + env(safe-area-inset-bottom))" }}>
          {tab === "home" && (
            <HomeScreen
              accounts={activeAccounts} balances={balances} upcoming={upcoming} topCats={topCats}
              monthExpense={monthly.expense} recent={recent} hide={hide} accName={accName} base={base} dueTone={dueTone}
              rates={settings.rates}
              groupLabels={{ banks: t("groups.banks"), cards: t("groups.cards"), cash: t("groups.cash") }}
              onManageAccounts={() => setSheet("accounts")}
              onOpenCards={() => setSheet("cards")}
              onOpenPlanned={() => setTab("planned")}
              onOpenActivity={() => setTab("activity")}
              onDelTx={delTx} onPaid={markPaid}
              onAccountTap={(a) => { setActFilter({ ...actFilter, accountId: a.id }); setTab("activity"); }}
            />
          )}
          {tab === "activity" && (
            <ActivityScreen txByDay={txByDay} filter={actFilter} setFilter={setActFilter} accounts={activeAccounts} hide={hide} accName={accName} onDelTx={delTx} onExport={exportCsv} insight={insight} base={base} />
          )}
          {tab === "planned" && (
            <PlannedScreen
              recurrs={data.recurrs} plans={data.plans} budgets={data.budgets} monthByCat={monthly.byCategory} base={base} rates={settings.rates} hide={hide} accName={accName}
              onAddRecurr={(k) => { setRecurrKind(k); setSheet("recurr"); }}
              onPaid={markPaid} onDelRecurr={delRecurr} onToggleCancel={toggleToCancel} dueTone={dueTone} setBudget={setBudget}
              onPayMilestone={payPlanMilestone} onDelPlan={delPlan}
            />
          )}
          {tab === "people" && (
            <PeopleScreen debts={data.debts} owedToMe={debts.owedToMe} iOwe={debts.iOwe} base={base} rates={settings.rates} hide={hide} onAddDebt={() => setSheet("debt")} onPay={payDebt} onDelDebt={delDebt} />
          )}
        </main>

        {/* tab bar + FAB */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30" style={{ background: T.surface, borderTop: `1px solid ${T.line}`, paddingBottom: "env(safe-area-inset-bottom)" }} aria-label="Main">
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
              aria-label="Add transaction — hold to speak"
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
              <span className="ui text-sm" style={{ color: "#fff" }}>Logged</span>
            </div>
          </div>
        )}
        <UndoToast toast={undo} onUndo={doUndo} />
        <TypedConfirm open={resetOpen} word={t("resetConfirmWord")} onCancel={() => setResetOpen(false)} onConfirm={resetAll} />

        {/* sheets */}
        <AddTxSheet
          open={sheet === "add"} onClose={() => { setSheet(null); setVoiceText(null); }} accounts={activeAccounts} settings={settings}
          onSave={addTx} goAccounts={() => setSheet("accounts")} initialText={voiceText}
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
        <RecurrSheet open={sheet === "recurr"} onClose={() => setSheet(null)} kind={recurrKind} accounts={activeAccounts} onSave={saveRecurr} />
        <InboxSheet open={sheet === "inbox"} onClose={() => setSheet(null)} pending={data.pending} accounts={activeAccounts} onPasteImport={pasteSms} onManualImport={importSmsText} onApprove={approvePending} onDismiss={dismissPending} onApproveAll={approveAllPending} />
        <DebtSheet open={sheet === "debt"} onClose={() => { setSheet(null); setDebtDraft(null); }} onSave={saveDebt} initial={debtDraft} />
        <CardsSheet open={sheet === "cards"} onClose={() => setSheet(null)} cards={activeAccounts.filter((a) => a.type === "credit")} balances={balances} hide={hide} base={base} rates={settings.rates} />
        <SettingsSheet
          open={sheet === "settings"} onClose={() => setSheet(null)} settings={settings}
          counts={{ tx: data.transactions.length, accounts: data.accounts.length, recurrs: data.recurrs.length, debts: data.debts.length }}
          onBase={setBase} onSaveRates={saveRates} onFetchRates={fetchRatesNow} onExportCsv={exportCsv} onExportBackup={exportBackup}
          onImportBackup={importBackup} onResetRequest={() => setResetOpen(true)} backendName={storage.backendName}
        />
      </div>
    </div>
  );
}

function HeadStat({ label, v, owe }) {
  return (
    <div className="flex-1 min-w-0 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}>
      <div className="ui text-[10px] mb-0.5 truncate" style={{ color: "#93A08D" }}>{label}</div>
      <div className="mono text-[13px] truncate" style={{ color: owe ? "#E9B7A0" : "#EEF1E8" }}>{v}</div>
    </div>
  );
}

function TabBtn({ t, on, set }) {
  return (
    <button onClick={() => set(t.id)} aria-current={on ? "page" : undefined} className="tap flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl" style={{ color: on ? T.ink : T.faint }}>
      <t.I size={20} strokeWidth={on ? 2.4 : 2} aria-hidden="true" />
      <span className="ui text-[10px]" style={{ fontWeight: on ? 600 : 400 }}>{t.label}</span>
    </button>
  );
}
