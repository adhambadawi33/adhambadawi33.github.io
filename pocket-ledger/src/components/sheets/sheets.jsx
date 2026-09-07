import React, { useEffect, useRef, useState } from "react";
import {
  Plus, Landmark, Check, Pencil, Eye, EyeOff, Download, Upload, Trash2, Sparkles, ChevronDown,
  ClipboardPaste, Wand2, ChevronUp, Mic, HandCoins, Lock, Fingerprint, ChevronRight, AlertTriangle,
} from "lucide-react";
import { hintSeen, bumpHint } from "../../lib/hints.js";
import { biometricsAvailable } from "../../lib/lock.js";
import { TxRow } from "../common/rows.jsx";
import {
  T, ACCOUNT_TYPE_DEFS, ACCOUNT_COLORS, EXP_CATS, INC_CATS, OWNERS, fmtMoney, inputCls, inputStyle, accountStripe,
} from "../../styles/tokens.js";
import { Sheet, Field, ChipRow, Numpad, EmptyHint, Money, CardBox, Section } from "../common/primitives.jsx";
import { CardChip } from "../common/brand.jsx";
import { bankFor } from "../../lib/brands.js";
import { CURRENCIES, convert, isValidRate, DEFAULT_RATES } from "../../lib/finance/currency.js";
import { parseVoice } from "../../lib/voice/parse.js";
import { todayISO, toISO, daysInMonth } from "../../lib/dates/localDate.js";
import { humanDay } from "../../lib/dates/ui.js";

/* Save buttons stay enabled; a tap while something is missing explains what. */
const SaveReason = ({ text }) => (text ? <p role="alert" className="ui text-[0.75rem] text-center mb-2" style={{ color: T.rose }}>{text}</p> : null);
import { useT, catLabel, ownerLabel } from "../../i18n/index.js";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* Short account-type tag so pickers make bank vs card obvious. */
const typeTag = (t) => (t === "credit" ? "card" : t === "debit" ? "debit" : t === "cash" ? "cash" : "bank");
const tagOf = (tr, ty) => tr(`typeTag.${typeTag(ty)}`);

/* Next calendar occurrence of a card's monthly due day (month-end clamped). */
function nextDueISO(dueDay) {
  const t = todayISO();
  const y = +t.slice(0, 4), m = +t.slice(5, 7), d = +t.slice(8, 10);
  const thisMonth = Math.min(dueDay, daysInMonth(y, m));
  if (d <= thisMonth) return toISO(y, m, thisMonth);
  const [yy, mm] = m === 12 ? [y + 1, 1] : [y, m + 1];
  return toISO(yy, mm, Math.min(dueDay, daysInMonth(yy, mm)));
}

/* Opens only on the closed->open transition (handoff §6.2) */
function useOpenTransition(open, init) {
  const prev = useRef(false);
  useEffect(() => {
    if (open && !prev.current) init();
    prev.current = open;
  }, [open, init]);
}

/* ── Add transaction ─────────────────────────────────────────── */
export function AddTxSheet({ open, onClose, accounts, settings, onSave, goAccounts, initialText, onDebtDraft, trip }) {
  const tr = useT();
  const [type, setType] = useState("expense");
  /* Trip tag (Aug 2026): while a trip is open, every expense asks "for the
     trip? personal / work / no" — remembers the last pick in the session. */
  const [tripKind, setTripKind] = useState("personal");
  const [amount, setAmount] = useState("");
  const [cur, setCur] = useState("AED");
  const [cat, setCat] = useState(EXP_CATS[0].n);
  const [accId, setAccId] = useState(null);
  const [toId, setToId] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [owner, setOwner] = useState("me");
  const [more, setMore] = useState(false);
  const [quick, setQuick] = useState("");
  const [parsedHint, setParsedHint] = useState("");
  const [debtDraft, setDebtDraft] = useState(null);
  const [listening, setListening] = useState(false);
  const [reason, setReason] = useState("");
  const [showVoiceHint] = useState(() => hintSeen("voice") < 3);
  useEffect(() => { if (open) bumpHint("voice"); }, [open]);
  const recRef = useRef(null);
  const parsedCatRef = useRef(null);

  /* Apply parser output as PREFILL only — user always reviews then Saves. */
  const applyParse = React.useCallback((text) => {
    const p = parseVoice(text, accounts, settings);
    if (!p) return;
    /* Loan phrases ("سلّفت أحمد ٥٠٠") offer a jump to the debt form instead
       of prefilling a transaction — still review-then-save, never auto. */
    if (p.type === "debt") { setDebtDraft(p); setParsedHint(""); return; }
    setDebtDraft(null);
    setType(p.type);
    if (p.amount != null) setAmount(String(p.amount));
    if (p.date) setDate(p.date);
    /* Honest fallback: an unrecognized expense lands in "Other", not in
       whatever category happened to be selected (was: Food by default). */
    if (p.type !== "transfer") {
      const guess = p.category || (p.type === "income" ? "Other income" : "Other");
      setCat(guess);
      parsedCatRef.current = guess;
    }
    if (p.accountId) setAccId(p.accountId);
    if (p.type === "transfer" && p.toAccountId) setToId(p.toAccountId);
    const accCur = p.accountId ? accounts.find((a) => a.id === p.accountId)?.currency : null;
    if (p.currency) setCur(p.currency);
    else if (accCur) setCur(accCur);
    if (p.note) { setNote(p.note); }
    if (p.owner) setOwner(p.owner);
    const bits = [
      ["expense", "income", "transfer"].includes(p.type) ? tr(`sheets.addTx.${p.type}`) : p.type, p.amount != null ? `${p.amount} ${p.currency || accCur || ""}`.trim() : null,
      p.type === "transfer"
        ? `${accounts.find((a) => a.id === p.accountId)?.name || "?"} → ${accounts.find((a) => a.id === p.toAccountId)?.name || "?"}`
        : catLabel(p.category),
      p.type !== "transfer" && p.accountId ? accounts.find((a) => a.id === p.accountId)?.name : null,
      p.owner && p.owner !== "me" ? ownerLabel(p.owner) : null,
    ].filter(Boolean);
    setParsedHint(bits.join(" · "));
  }, [accounts, settings, tr]);

  const init = React.useCallback(() => {
    setAmount(""); setNote(""); setDate(todayISO()); setType("expense"); setCat(EXP_CATS[0].n); setOwner("me"); setMore(false);
    setQuick(initialText || ""); setParsedHint(""); setDebtDraft(null); parsedCatRef.current = null;
    const last = accounts.find((a) => a.id === settings.lastAccount) || accounts[0];
    setAccId(last?.id || null);
    setCur(last?.currency || "AED");
    setToId(accounts.find((a) => a.id !== last?.id)?.id || null);
    if (initialText) setTimeout(() => applyParse(initialText), 0);
  }, [accounts, settings.lastAccount, initialText, applyParse]);
  useOpenTransition(open, init);

  const pasteQuick = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) { setQuick(t); applyParse(t); }
    } catch {
      window.alert(tr("sheets.addTx.clipboardBlocked"));
    }
  };

  /* Voice entry (batch 5): the phone's built-in speech recognition feeds the
     same parser as typed text. Nothing is saved without the user's Save tap. */
  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { window.alert(tr("sheets.addTx.voiceUnsupported")); return; }
    if (listening) { try { recRef.current?.stop(); } catch { /* noop */ } return; }
    const rec = new SR();
    rec.lang = settings.language === "ar" ? "ar-EG" : "ar-EG";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      const txt = Array.from(e.results).map((r) => r[0].transcript).join(" ").trim();
      setQuick(txt);
      if (e.results[e.results.length - 1].isFinal && txt) applyParse(txt);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };

  if (!open) return null;
  const acc = accounts.find((a) => a.id === accId);
  const to = accounts.find((a) => a.id === toId);
  const cats = type === "income" ? INC_CATS : EXP_CATS.filter((c) => c.n !== "Adjustment");
  const ok = +amount > 0 && !!acc && (type !== "transfer" || (to && toId !== accId));

  const save = () => {
    if (!ok) {
      setReason(!(+amount > 0) ? tr("ux.needAmount") : !acc ? tr("ux.needAccount") : tr("ux.needTo"));
      return;
    }
    setReason("");
    const snapshot = { ...settings.rates };
    if (type === "transfer") {
      onSave({
        id: uid(), type, date, note: note.trim(), snapshot,
        sourceAccountId: acc.id, sourceCurrency: acc.currency,
        sourceAmount: convert(+amount, cur, acc.currency, snapshot),
        destinationAccountId: to.id, destinationCurrency: to.currency,
        destinationAmount: convert(+amount, cur, to.currency, snapshot),
        accountId: acc.id, toAccountId: to.id, amount: +amount, currency: cur, category: "Transfer",
      });
    } else {
      onSave(
        {
          id: uid(), type, date, note: note.trim(), snapshot, amount: +amount, currency: cur, accountId: acc.id, category: cat, owner,
          ...(trip && type === "expense" && tripKind !== "none" ? { tripId: trip.id, tripKind } : {}),
        },
        /* Quick-add guess corrected by hand? Teach the parser (batch 13). */
        parsedCatRef.current && cat !== parsedCatRef.current ? { note: quick || note, category: cat } : null
      );
    }
  };

  const onKey = (e) => {
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (/^[0-9]$/.test(e.key) || e.key === ".") {
      const next = e.key === "." && amount.includes(".") ? amount : e.key === "." && amount === "" ? "0." : amount + e.key;
      if (/^\d{0,9}(\.\d{0,2})?$/.test(next)) setAmount(next);
    } else if (e.key === "Backspace") setAmount(amount.slice(0, -1));
    else if (e.key === "Enter") save();
  };

  if (accounts.length === 0)
    return (
      <Sheet open onClose={onClose} title={tr("sheets.addTx.title")}>
        <EmptyHint icon={<Landmark size={24} />} text={tr("sheets.addTx.emptyText")} cta={tr("sheets.addTx.addAccounts")} onClick={goAccounts} />
      </Sheet>
    );

  return (
    <Sheet open onClose={onClose} title={tr("sheets.addTx.title")} tall>
      <div onKeyDown={onKey}>
        {/* Quick add — type or use the keyboard mic; parser prefills the form */}
        <div className="mb-3">
          <div className="flex gap-2">
            <input
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); applyParse(quick); } }}
              placeholder={tr("sheets.addTx.quickPh")}
              className="ui flex-1 rounded-xl px-3.5 py-3 text-[0.9375rem] outline-none"
              style={{ background: T.paper, border: `1px solid ${T.line}`, color: T.text }}
              aria-label={tr("sheets.addTx.quickAria")}
            />
            <button
              onClick={startVoice}
              className={`tap h-[46px] w-[46px] rounded-xl flex items-center justify-center shrink-0 ${listening ? "pop" : ""}`}
              style={listening ? { background: T.rose, color: "#fff", border: `1px solid ${T.rose}` } : { background: T.ink, color: "#fff" }}
              aria-label={listening ? tr("sheets.addTx.stop") : tr("sheets.addTx.speak")}
              aria-pressed={listening}
            >
              <Mic size={17} />
            </button>
            <button onClick={pasteQuick} className="tap h-[46px] w-[46px] rounded-xl flex items-center justify-center shrink-0" style={{ background: T.paper, border: `1px solid ${T.line}`, color: T.sub }} aria-label={tr("sheets.addTx.paste")}>
              <ClipboardPaste size={17} />
            </button>
            <button onClick={() => applyParse(quick)} disabled={!quick.trim()} className="tap h-[46px] w-[46px] rounded-xl flex items-center justify-center shrink-0" style={{ background: quick.trim() ? T.gold : T.line, color: quick.trim() ? T.ink : T.faint }} aria-label={tr("sheets.addTx.understand")}>
              <Wand2 size={17} />
            </button>
          </div>
          {parsedHint && (
            <p className="ui text-[0.6875rem] mt-1.5 flex items-center gap-1" style={{ color: T.goldDeep }} aria-live="polite">
              <Sparkles size={12} aria-hidden="true" /> {parsedHint}{tr("sheets.addTx.reviewThen")}
            </p>
          )}
          {!parsedHint && !debtDraft && showVoiceHint && (
            <p className="ui text-[0.75rem] mt-1.5 rounded-lg px-2.5 py-1.5" style={{ background: T.goldBg, color: T.goldDeep }}>
              {tr("ux.voiceHint")}
            </p>
          )}
          {debtDraft && (
            <div className="rounded-xl px-3.5 py-3 mt-2 flex items-center gap-3" style={{ background: T.goldBg || T.paper, border: `1px solid ${T.gold}` }} aria-live="polite">
              <HandCoins size={18} style={{ color: T.goldDeep }} aria-hidden="true" />
              <div className="ui text-[0.75rem] flex-1 min-w-0" style={{ color: T.text }}>
                {tr("sheets.addTx.soundsLoan")}{debtDraft.direction === "lent" ? tr("sheets.addTx.youLent") : tr("sheets.addTx.youBorrowed")}
                {debtDraft.person ? ` ${debtDraft.person}` : ""}{debtDraft.amount != null ? ` · ${debtDraft.amount} ${debtDraft.currency || ""}`.trimEnd() : ""}
              </div>
              <button onClick={() => onDebtDraft?.(debtDraft)} className="tap ui text-[0.75rem] font-semibold rounded-lg px-3 py-2 shrink-0" style={{ background: T.gold, color: T.ink }}>
                {tr("sheets.addTx.openLoanForm")}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {[["expense", tr("sheets.addTx.expense")], ["income", tr("sheets.addTx.income")], ["transfer", tr("sheets.addTx.transfer")]].map(([v, l]) => (
            <button
              key={v}
              onClick={() => { setType(v); if (v !== "transfer") setCat(v === "income" ? INC_CATS[0].n : EXP_CATS[0].n); }}
              aria-pressed={type === v}
              className="tap ui rounded-xl py-2.5 text-sm font-medium"
              style={type === v
                ? { background: v === "income" ? T.greenBg : v === "expense" ? T.roseBg : T.paper, color: v === "income" ? T.green : v === "expense" ? T.rose : T.ink, border: `1.5px solid ${v === "income" ? T.green : v === "expense" ? T.rose : T.ink}` }
                : { background: T.paper, color: T.faint, border: `1px solid ${T.line}` }}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="text-center mb-2" aria-live="polite">
          <span className="mono text-[2.75rem] leading-none" style={{ color: +amount > 0 ? T.text : T.faint }}>{amount || "0"}</span>
          <span className="ui text-base ms-2" style={{ color: T.faint }}>{cur}</span>
        </div>
        <div className="flex justify-center gap-1.5 mb-3">
          {CURRENCIES.map((c) => (
            <button key={c} onClick={() => setCur(c)} aria-pressed={cur === c} className="tap mono rounded-full px-3.5 py-2 text-[0.75rem]" style={cur === c ? { background: T.ink, color: "#fff" } : { background: T.paper, color: T.sub, border: `1px solid ${T.line}` }}>
              {c}
            </button>
          ))}
        </div>
        {acc && cur !== acc.currency && +amount > 0 && (
          <p className="ui text-[0.6875rem] text-center mb-2" style={{ color: T.faint }}>
            {tr("sheets.addTx.approxFrom", { amt: fmtMoney(convert(+amount, cur, acc.currency, settings.rates), acc.currency), name: acc.name })}
          </p>
        )}
        <div className="mb-4"><Numpad value={amount} onChange={setAmount} /></div>

        {type !== "transfer" && (
          <Field label={tr("sheets.addTx.category")}>
            <div className="grid grid-cols-4 gap-2">
              {cats.map((c) => {
                const on = cat === c.n;
                return (
                  <button key={c.n} onClick={() => setCat(c.n)} aria-pressed={on} className="tap rounded-xl px-1 py-2.5 flex flex-col items-center gap-1" style={on ? { background: `${c.c}1A`, border: `1.5px solid ${c.c}` } : { background: T.paper, border: `1px solid ${T.line}` }}>
                    <c.I size={17} style={{ color: c.c }} aria-hidden="true" />
                    <span className="ui text-[0.6875rem] leading-tight text-center" style={{ color: on ? T.text : T.sub }}>{catLabel(c.n)}</span>
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {type !== "transfer" && (
          <Field label={tr("sheets.addTx.whose")}>
            <ChipRow value={owner} onChange={setOwner} options={OWNERS.map((o) => ({ value: o.id, label: ownerLabel(o.id) }))} />
          </Field>
        )}
        {trip && type === "expense" && (
          <Field label={tr("sheets.addTx.tripSpend", { name: trip.name })}>
            <ChipRow
              value={tripKind}
              onChange={setTripKind}
              options={[{ value: "personal", label: tr("sheets.addTx.personal") }, { value: "work", label: tr("sheets.addTx.work") }, { value: "none", label: tr("sheets.addTx.notTrip") }]}
            />
          </Field>
        )}

        <Field label={type === "transfer" ? tr("sheets.addTx.fromAccount") : tr("sheets.addTx.account")}>
          <ChipRow
            value={accId}
            onChange={(v) => { setAccId(v); const na = accounts.find((a) => a.id === v); if (na) setCur(na.currency); }}
            options={accounts.map((a) => ({ value: a.id, label: `${a.name} · ${tagOf(tr, a.type)} · ${a.currency}` }))}
          />
        </Field>
        {type === "transfer" && (
          <Field label={tr("sheets.addTx.toAccount")}>
            <ChipRow value={toId} onChange={setToId} options={accounts.filter((a) => a.id !== accId).map((a) => ({ value: a.id, label: `${a.name} · ${tagOf(tr, a.type)} · ${a.currency}` }))} />
          </Field>
        )}

        <button onClick={() => setMore(!more)} className="tap ui text-xs flex items-center gap-1 mb-3" style={{ color: T.sub }} aria-expanded={more}>
          <ChevronDown size={14} style={{ transform: more ? "rotate(180deg)" : "none", transition: "transform .15s" }} /> {tr("sheets.addTx.dateNote")}
        </button>
        {more && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("sheets.addTx.date")}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} style={inputStyle()} /></Field>
            <Field label={tr("sheets.addTx.note")}><input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("sheets.addTx.notePh")} className={inputCls} style={inputStyle()} /></Field>
          </div>
        )}

        <SaveReason text={reason} />
        <button onClick={save} aria-disabled={!ok} className="tap ui w-full rounded-2xl py-4 text-[0.9375rem] font-semibold" style={{ background: T.ink, color: "#fff", opacity: ok ? 1 : 0.7 }}>
          {tr("sheets.addTx.save", { type: tr(`sheets.addTx.${type}`) })}
        </button>
      </div>
    </Sheet>
  );
}

/* ── Accounts list + safe balance adjustment (handoff §4.6 / §5.2) ── */
export function AccountsSheet({ open, onClose, accounts, balances, hide, onNew, onEdit, onArchive, onAdjust, onMove }) {
  const tr = useT();
  const [adjustFor, setAdjustFor] = useState(null);
  const [actual, setActual] = useState("");
  useEffect(() => { if (!open) { setAdjustFor(null); setActual(""); } }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title={tr("sheets.accounts.title")}>
      <button onClick={onNew} className="tap ui w-full rounded-xl py-3 text-sm font-medium mb-4 flex items-center justify-center gap-1.5" style={{ background: T.ink, color: "#fff" }}>
        <Plus size={16} aria-hidden="true" />{tr("sheets.accounts.new")}
      </button>
      {accounts.length === 0 && <p className="ui text-sm text-center py-6" style={{ color: T.faint }}>{tr("sheets.accounts.hint")}</p>}
      {accounts.map((a, idx) => {
        const Ico = (ACCOUNT_TYPE_DEFS.find((t) => t.id === a.type) || ACCOUNT_TYPE_DEFS[0]).icon;
        const bal = balances[a.id] || 0;
        const isAdj = adjustFor === a.id;
        return (
          <div key={a.id} style={{ borderBottom: `1px solid ${T.line}`, opacity: a.archived ? 0.45 : 1 }}>
            <div className="flex items-center gap-3 py-3">
              <div className="flex flex-col -my-1" aria-label={tr("sheets.accounts.reorder", { name: a.name })}>
                <button onClick={() => onMove(a, -1)} disabled={idx === 0} className="tap p-1 disabled:opacity-20" style={{ color: T.sub }} aria-label={tr("sheets.accounts.moveUp", { name: a.name })}>
                  <ChevronUp size={15} />
                </button>
                <button onClick={() => onMove(a, 1)} disabled={idx === accounts.length - 1} className="tap p-1 disabled:opacity-20" style={{ color: T.sub }} aria-label={tr("sheets.accounts.moveDown", { name: a.name })}>
                  <ChevronDown size={15} />
                </button>
              </div>
              <span className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: accountStripe(a, 135), color: "#fff" }} aria-hidden="true"><Ico size={17} /></span>
              <div className="flex-1 min-w-0">
                <div className="ui text-sm" style={{ color: T.text }}>{a.name}{a.archived ? tr("sheets.accounts.hidden") : ""}</div>
                <div className="ui text-[0.6875rem]" style={{ color: T.faint }}>{tr(`accountTypes.${a.type}`)} · {a.currency}</div>
              </div>
              <Money n={a.type === "credit" && bal < 0 ? -bal : bal} cur={a.currency} hide={hide} className="text-sm" />
              <button onClick={() => { setAdjustFor(isAdj ? null : a.id); setActual(""); }} className="tap ui text-[0.75rem] px-2.5 min-h-[40px] rounded-lg whitespace-nowrap" style={{ border: `1px solid ${T.lineStrong}`, color: T.goldDeep }}>
                {tr("ux.reconcile")}
              </button>
              <button onClick={() => onEdit(a)} className="tap p-2" style={{ color: T.sub }} aria-label={tr("sheets.accounts.edit", { name: a.name })}><Pencil size={15} /></button>
              <button onClick={() => onArchive(a)} className="tap p-2" style={{ color: T.faint }} aria-label={a.archived ? tr("sheets.accounts.show", { name: a.name }) : tr("sheets.accounts.hide", { name: a.name })}>
                {a.archived ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
            </div>
            {isAdj && (
              <div className="pb-3" style={{ paddingInlineStart: 52 }}>
                {(() => {
                  const v = actual === "" ? null : +actual;
                  const target = v == null || !Number.isFinite(v) ? null : (a.type === "credit" ? -Math.abs(v) : v);
                  const diff = target == null ? null : target - bal;
                  const label = diff == null ? tr("sheets.accounts.reconcile") : Math.abs(diff) < 0.005 ? tr("ux.noDiff") : tr("ux.recordDiff", { diff: `${diff > 0 ? "+" : "−"}${fmtMoney(Math.abs(diff), a.currency)}` });
                  return (
                    <div className="flex gap-2">
                      <input type="number" inputMode="decimal" value={actual} onChange={(e) => setActual(e.target.value)} placeholder={tr("ux.bankBalancePh")} className="mono pl-input flex-1 rounded-lg px-3 text-sm outline-none" style={inputStyle()} aria-label={tr("sheets.accounts.actualAria", { name: a.name })} autoFocus />
                      <button
                        onClick={() => { if (diff == null) return; if (Math.abs(diff) < 0.005) { setAdjustFor(null); return; } onAdjust(a, diff); setAdjustFor(null); }}
                        className="tap ui text-xs font-medium rounded-lg px-3 min-h-[44px] whitespace-nowrap"
                        style={{ background: diff == null ? T.line : T.ink, color: diff == null ? T.sub : "#fff" }}
                      >
                        {label}
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}
    </Sheet>
  );
}

/* ── Account form (credit owed shown positive — handoff §4.6) ── */
export function AccountFormSheet({ open, onClose, initial, onSave, currentBalance }) {
  const tr = useT();
  const [f, setF] = useState(null);
  const init = React.useCallback(() => {
    setF(
      initial
        ? { ...initial, openingDisplay: String(Math.abs(initial.openingBalance) || ""), cardDigitsText: (initial.cardDigits || []).join(", ") }
        : { id: uid(), name: "", type: "bank", currency: "AED", openingDisplay: "", creditLimit: "", cardDigitsText: "", bank: "", network: "", dueDay: "", minPayment: "", color: ACCOUNT_COLORS[0], color2: "", archived: false, custodial: false }
    );
  }, [initial]);
  useOpenTransition(open, init);
  const [reason, setReason] = useState("");
  if (!open || !f) return null;
  const ok = f.name.trim().length > 0;
  const isCredit = f.type === "credit";
  return (
    <Sheet open onClose={onClose} title={initial ? tr("sheets.accountForm.edit") : tr("sheets.accountForm.new")}>
      <Field label={tr("sheets.accountForm.name")}><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={tr("sheets.accountForm.namePh")} className={inputCls} style={inputStyle()} /></Field>
      <Field label={tr("sheets.accountForm.type")}><ChipRow value={f.type} onChange={(v) => setF({ ...f, type: v })} options={ACCOUNT_TYPE_DEFS.map((d) => ({ value: d.id, label: tr(`accountTypes.${d.id}`) }))} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={tr("sheets.accountForm.currency")}>
          <select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} className={inputCls} style={inputStyle()}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label={isCredit ? tr("sheets.accountForm.startOwed") : tr("sheets.accountForm.startBal")}>
          <input type="number" inputMode="decimal" value={f.openingDisplay} onChange={(e) => setF({ ...f, openingDisplay: e.target.value })} placeholder="0" className={`${inputCls} mono`} style={inputStyle()} />
        </Field>
      </div>
      {initial && (
        <p className="ui text-[0.6875rem] -mt-1 mb-3" style={{ color: T.faint }}>
          {tr("sheets.accountForm.startNoteA", { what: isCredit ? tr("sheets.accountForm.owedWord") : tr("sheets.accountForm.balWord") })}<b className="mono">{fmtMoney(Math.abs(currentBalance ?? 0), f.currency)}</b>{tr("sheets.accountForm.startNoteB")}
        </p>
      )}
      {isCredit && (
        <>
          <Field label={tr("sheets.accountForm.creditLimit")}>
            <input type="number" inputMode="decimal" value={f.creditLimit} onChange={(e) => setF({ ...f, creditLimit: e.target.value })} placeholder="e.g. 50000" className={`${inputCls} mono`} style={inputStyle()} />
          </Field>
          <Field label={tr("sheets.accountForm.network")}>
            <ChipRow value={f.network || ""} onChange={(v) => setF({ ...f, network: v })} options={[{ value: "visa", label: "Visa" }, { value: "mastercard", label: "Mastercard" }, { value: "", label: tr("sheets.accountForm.other") }]} />
          </Field>
          <Field label={tr("sheets.accountForm.bank")}>
            <input value={f.bank || ""} onChange={(e) => setF({ ...f, bank: e.target.value })} placeholder={tr("sheets.accountForm.bankPh")} className={inputCls} style={inputStyle()} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("sheets.accountForm.dueDay")}>
              <input type="number" inputMode="numeric" min="1" max="31" value={f.dueDay || ""} onChange={(e) => setF({ ...f, dueDay: e.target.value })} placeholder="e.g. 5" className={`${inputCls} mono`} style={inputStyle()} />
            </Field>
            <Field label={tr("sheets.accountForm.minPayment")}>
              <input type="number" inputMode="decimal" value={f.minPayment || ""} onChange={(e) => setF({ ...f, minPayment: e.target.value })} placeholder="e.g. 350" className={`${inputCls} mono`} style={inputStyle()} />
            </Field>
          </div>
        </>
      )}
      {!isCredit && (
        <>
          <Field label={tr("sheets.accountForm.whose")}>
            <ChipRow
              value={f.custodial ? "trust" : "mine"}
              onChange={(v) => setF({ ...f, custodial: v === "trust" })}
              options={[{ value: "mine", label: tr("sheets.accountForm.mine") }, { value: "trust", label: tr("sheets.accountForm.trust") }]}
            />
          </Field>
          {f.custodial && (
            <p className="ui text-[0.6875rem] -mt-1 mb-3" style={{ color: T.faint }}>
              {tr("sheets.accountForm.trustHint")}
            </p>
          )}
        </>
      )}
      <Field label={tr("sheets.accountForm.last4")}>
        <input
          value={f.cardDigitsText ?? ""}
          onChange={(e) => setF({ ...f, cardDigitsText: e.target.value })}
          placeholder={tr("sheets.accountForm.last4Ph")}
          inputMode="numeric"
          className={`${inputCls} mono`}
          style={inputStyle()}
          aria-label={tr("sheets.accountForm.last4Aria")}
        />
      </Field>
      <Field label={tr("sheets.accountForm.color")}>
        <div className="flex gap-2 flex-wrap">
          {ACCOUNT_COLORS.map((c) => (
            <button key={c} onClick={() => setF({ ...f, color: c })} className="tap h-10 w-10 rounded-full flex items-center justify-center" style={{ background: c }} aria-label={tr("sheets.accountForm.colorAria", { c })} aria-pressed={f.color === c}>
              {f.color === c && <Check size={15} style={{ color: "#fff" }} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </Field>
      <Field label={tr("sheets.accountForm.color2")}>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setF({ ...f, color2: "" })} className="tap h-10 w-10 rounded-full flex items-center justify-center" style={{ background: T.paper, border: `1px solid ${T.line}`, color: T.faint }} aria-label={tr("sheets.accountForm.noColor2")} aria-pressed={!f.color2}>
            {!f.color2 ? <Check size={15} style={{ color: T.sub }} aria-hidden="true" /> : "—"}
          </button>
          {ACCOUNT_COLORS.map((c) => (
            <button key={c} onClick={() => setF({ ...f, color2: c })} className="tap h-10 w-10 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${f.color}, ${c})` }} aria-label={tr("sheets.accountForm.color2Aria", { c })} aria-pressed={f.color2 === c}>
              {f.color2 === c && <Check size={15} style={{ color: "#fff" }} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </Field>
      <SaveReason text={reason} />
      <button
        onClick={() => {
          if (!ok) { setReason(tr("ux.needName")); return; }
          const openVal = Math.abs(+f.openingDisplay || 0);
          /* Sign convention: credit debt stored negative (schema.js). */
          const openingBalance = isCredit ? -openVal : +f.openingDisplay || 0;
          const { openingDisplay: _d, cardDigitsText: _c, ...rest } = f;
          const cardDigits = (f.cardDigitsText || "").split(/[\s,]+/).filter((d) => /^\d{4}$/.test(d));
          onSave({ ...rest, openingBalance, creditLimit: +f.creditLimit || 0, cardDigits, bank: (f.bank || "").trim(), network: f.network || "", dueDay: +f.dueDay || 0, minPayment: +f.minPayment || 0 });
        }}
        aria-disabled={!ok}
        className="tap ui w-full rounded-2xl py-3.5 text-[0.9375rem] font-semibold mt-2"
        style={{ background: T.ink, color: "#fff", opacity: ok ? 1 : 0.7 }}
      >
        {tr("sheets.accountForm.save")}
      </button>
    </Sheet>
  );
}

/* ── Cards detail page (batch 2): every credit card with
   available-in-limit, signed owed, usage bar, due day and min payment. ── */
export function CardsSheet({ open, onClose, cards, balances, hide, base, rates }) {
  const tr = useT();
  if (!open) return null;
  const rows = cards.map((a) => {
    const bal = balances[a.id] || 0;
    const owed = Math.max(0, -bal);
    const avail = a.creditLimit ? a.creditLimit + bal : null;
    return { a, bal, owed, avail };
  });
  const totAvail = rows.reduce((s, r) => s + (r.avail != null ? convert(r.avail, r.a.currency, base, rates) : 0), 0);
  const totOwed = rows.reduce((s, r) => s + convert(r.owed, r.a.currency, base, rates), 0);
  return (
    <Sheet open onClose={onClose} title={tr("sheets.cards.title")} tall>
      <div className="flex gap-2 mb-4">
        <div className="flex-1 rounded-xl px-3.5 py-3" style={{ background: T.paper }}>
          <div className="ui text-[0.6875rem] mb-1" style={{ color: T.faint }}>{tr("sheets.cards.limitLeftRoom")}</div>
          <div className="mono text-[1.0625rem]" style={{ color: T.sub }}>{hide ? "•••••" : `${Math.round(totAvail).toLocaleString("en-US")} ${base}`}</div>
        </div>
        <div className="flex-1 rounded-xl px-3.5 py-3" style={{ background: T.roseBg }}>
          <div className="ui text-[0.6875rem] mb-1" style={{ color: T.faint }}>{tr("sheets.cards.totalOwed")}</div>
          <div className="mono text-[1.0625rem]" style={{ color: totOwed > 0.005 ? T.rose : T.green }}>{hide ? "•••••" : `${totOwed > 0.005 ? "−" : ""}${Math.round(totOwed).toLocaleString("en-US")} ${base}`}</div>
        </div>
      </div>

      <p className="ui text-[0.6875rem] mb-4" style={{ color: T.faint }}>
        {tr("sheets.cards.note")}
      </p>

      {rows.length === 0 && <p className="ui text-sm text-center py-8" style={{ color: T.sub }}>{tr("sheets.cards.none")}</p>}

      {rows.map(({ a, owed, avail }) => {
        const bank = bankFor(a.bank || a.name);
        const usedPct = a.creditLimit ? Math.min(100, (owed / a.creditLimit) * 100) : 0;
        return (
          <div key={a.id} className="rounded-2xl p-4 mb-3 relative overflow-hidden" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
            <span aria-hidden="true" className="absolute inset-y-0 w-1" style={{ insetInlineStart: 0, background: accountStripe(a) }} />
            <div className="flex items-center gap-3 mb-3">
              <CardChip account={a} width={44} />
              <div className="min-w-0 flex-1">
                <div className="ui text-[0.9375rem] font-semibold truncate" style={{ color: T.text }}>{a.name}</div>
                <div className="mono text-[0.6875rem]" style={{ color: T.faint }}>
                  {a.cardDigits?.length ? `•••• ${a.cardDigits[0]}` : ""}{a.cardDigits?.length && (bank || a.bank) ? " · " : ""}{a.bank || bank?.label || ""}
                </div>
              </div>
              {a.dueDay > 0 && (
                <span className="ui text-[0.6875rem] font-semibold rounded-full px-2.5 py-1 shrink-0" style={{ background: owed > 0 ? T.amberBg : T.greenBg, color: owed > 0 ? T.amber : T.green }}>
                  {owed > 0 ? tr("sheets.cards.payBy", { date: humanDay(nextDueISO(a.dueDay)) }) : tr("sheets.cards.nothingOwed")}
                </span>
              )}
            </div>
            <div className="flex gap-2.5 mb-3">
              <div className="flex-1 rounded-xl px-3 py-2.5" style={{ background: T.paper }}>
                <div className="ui text-[0.6875rem] mb-0.5" style={{ color: T.faint }}>{tr("sheets.cards.limitLeft")}</div>
                <div className="mono text-[1.0625rem]" style={{ color: T.sub }}>{avail != null ? fmtMoney(avail, a.currency, hide) : "—"}</div>
              </div>
              <div className="flex-1 rounded-xl px-3 py-2.5" style={{ background: T.paper }}>
                <div className="ui text-[0.6875rem] mb-0.5" style={{ color: T.faint }}>{tr("sheets.cards.owed")}</div>
                <div className="mono text-[1.0625rem]" style={{ color: owed > 0 ? T.rose : T.green }}>{hide ? "•••••" : owed > 0 ? `−${fmtMoney(owed, a.currency, false)}` : "0"}</div>
              </div>
            </div>
            {a.creditLimit > 0 && (
              <>
                <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: T.line }}>
                  <div className="h-full rounded-full" style={{ width: `${usedPct}%`, background: a.color, transition: "width .4s ease" }} />
                </div>
                <div className="flex justify-between ui text-[0.6875rem]" style={{ color: T.sub }}>
                  <span>{tr("sheets.cards.used")} <b className="mono">{fmtMoney(owed, a.currency, hide)}</b> {tr("sheets.cards.ofWord")} <b className="mono">{fmtMoney(a.creditLimit, a.currency, hide)}</b></span>
                  {a.minPayment > 0 && owed > 0 && <span>{tr("sheets.cards.minPayment")} <b className="mono">{fmtMoney(a.minPayment, a.currency, hide)}</b></span>}
                </div>
              </>
            )}
          </div>
        );
      })}
    </Sheet>
  );
}

/* ── Recurring ── */
export function RecurrSheet({ open, onClose, kind, accounts, onSave, initial }) {
  const tr = useT();
  const [f, setF] = useState(null);
  /* `initial` = edit mode (batch 12): tap a subscription/installment row to
     move it to another card, fix the amount, date — anything. */
  const init = React.useCallback(() => {
    setF(
      initial
        ? {
            name: initial.name, amount: String(initial.amount), currency: initial.currency,
            cycle: initial.cycle, nextDue: initial.nextDue, accountId: initial.accountId,
            owner: initial.owner || "me",
            monthsTotal: initial.monthsTotal != null ? String(initial.monthsTotal) : "",
            monthsPaid: initial.monthsPaid != null ? String(initial.monthsPaid) : "0",
          }
        : { name: "", amount: "", currency: "AED", cycle: "monthly", nextDue: todayISO(), accountId: accounts[0]?.id || null, owner: "me", monthsTotal: "", monthsPaid: "0" }
    );
  }, [accounts, initial]);
  useOpenTransition(open, init);
  const [reason, setReason] = useState("");
  if (!open || !f) return null;
  const sub = kind === "subscription";
  const ok = f.name.trim() && +f.amount > 0 && (sub || +f.monthsTotal > 0);
  return (
    <Sheet open onClose={onClose} title={initial ? (sub ? tr("sheets.recurr.editSub") : tr("sheets.recurr.editInst")) : (sub ? tr("sheets.recurr.newSub") : tr("sheets.recurr.newInst"))}>
      <Field label={tr("sheets.recurr.name")}><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={sub ? tr("sheets.recurr.subPh") : tr("sheets.recurr.instPh")} className={inputCls} style={inputStyle()} /></Field>
      <Field label={tr("sheets.recurr.whose")}>
        <ChipRow value={f.owner} onChange={(v) => setF({ ...f, owner: v })} options={OWNERS.map((o) => ({ value: o.id, label: ownerLabel(o.id) }))} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={sub ? tr("sheets.recurr.amountCycle") : tr("sheets.recurr.monthlyAmount")}>
          <input type="number" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0" className={`${inputCls} mono`} style={inputStyle()} />
        </Field>
        <Field label={tr("sheets.recurr.currency")}>
          <select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} className={inputCls} style={inputStyle()}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
      </div>
      {sub ? (
        <Field label={tr("sheets.recurr.cycle")}>
          <ChipRow value={f.cycle} onChange={(v) => setF({ ...f, cycle: v })} options={[{ value: "weekly", label: tr("sheets.recurr.weekly") }, { value: "monthly", label: tr("sheets.recurr.monthly") }, { value: "yearly", label: tr("sheets.recurr.yearly") }]} />
        </Field>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr("sheets.recurr.totalMonths")}><input type="number" inputMode="numeric" value={f.monthsTotal} onChange={(e) => setF({ ...f, monthsTotal: e.target.value })} placeholder="12" className={`${inputCls} mono`} style={inputStyle()} /></Field>
          <Field label={tr("sheets.recurr.alreadyPaid")}><input type="number" inputMode="numeric" value={f.monthsPaid} onChange={(e) => setF({ ...f, monthsPaid: e.target.value })} className={`${inputCls} mono`} style={inputStyle()} /></Field>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={sub ? tr("sheets.recurr.nextRenewal") : tr("sheets.recurr.nextPayment")}><input type="date" value={f.nextDue} onChange={(e) => setF({ ...f, nextDue: e.target.value })} className={inputCls} style={inputStyle()} /></Field>
        <Field label={tr("sheets.recurr.payFrom")}>
          <select value={f.accountId || ""} onChange={(e) => setF({ ...f, accountId: e.target.value })} className={inputCls} style={inputStyle()}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{`${a.name} · ${tagOf(tr, a.type)}`}</option>)}
          </select>
        </Field>
      </div>
      <SaveReason text={reason} />
      <button
        onClick={() => { if (!ok) { setReason(!f.name.trim() ? tr("ux.needName") : !(+f.amount > 0) ? tr("ux.needAmount") : tr("ux.needMonths")); return; } onSave({ id: initial?.id || uid(), kind, name: f.name.trim(), amount: +f.amount, currency: f.currency, cycle: sub ? f.cycle : "monthly", nextDue: f.nextDue, accountId: f.accountId, owner: f.owner || "me", paused: initial?.paused || false, toCancel: initial?.toCancel || false, ...(sub ? {} : { monthsTotal: +f.monthsTotal, monthsPaid: +f.monthsPaid || 0 }) }); }}
        aria-disabled={!ok}
        className="tap ui w-full rounded-2xl py-3.5 text-[0.9375rem] font-semibold mt-2"
        style={{ background: T.ink, color: "#fff", opacity: ok ? 1 : 0.7 }}
      >
        {sub ? tr("sheets.recurr.saveSub") : tr("sheets.recurr.saveInst")}
      </button>
    </Sheet>
  );
}

/* ── Pay a plan milestone ──
   Plan payments are huge and rare (villa ~4/yr), so instead of a bare
   confirm() they get a small review sheet: what + how much + WHICH account
   (defaults to the plan's remembered account, else the last one used). */
export function PayPlanSheet({ open, onClose, target, accounts, onConfirm }) {
  const tr = useT();
  const [accountId, setAccountId] = useState(null);
  const [remember, setRemember] = useState(true);
  const init = React.useCallback(() => {
    setAccountId(target?.plan?.accountId || accounts[0]?.id || null);
    setRemember(true);
  }, [target, accounts]);
  useOpenTransition(open, init);
  if (!open || !target) return null;
  const { plan, ms } = target;
  const acct = accounts.find((a) => a.id === accountId);
  const ok = !!acct;
  return (
    <Sheet open onClose={onClose} title={tr("sheets.payPlan.title")}>
      <div className="rounded-2xl px-4 py-3 mb-4" style={{ background: T.paper, border: `1px solid ${T.line}` }}>
        <div className="ui text-[0.75rem]" style={{ color: T.sub }}>{plan.name}{ms.label ? ` · ${ms.label}` : ""}</div>
        <div className="mono text-[1.625rem] leading-tight mt-0.5" style={{ color: T.text }}>{fmtMoney(ms.amount, plan.currency)}</div>
        <div className="ui text-[0.6875rem] mt-0.5" style={{ color: T.faint }}>{tr("sheets.payPlan.due", { date: humanDay(ms.due) })}</div>
      </div>
      <Field label={tr("sheets.payPlan.payFrom")}>
        <div className="flex flex-col gap-2">
          {accounts.map((a) => {
            const on = a.id === accountId;
            return (
              <button
                key={a.id}
                onClick={() => setAccountId(a.id)}
                className="tap flex items-center justify-between rounded-2xl px-4 py-3 text-start"
                style={{ background: on ? T.ink : T.surface, color: on ? "#fff" : T.text, border: `1px solid ${on ? T.ink : T.line}` }}
                aria-pressed={on}
              >
                <span className="ui text-[0.875rem]">{a.name}</span>
                <span className="ui text-[0.6875rem]" style={{ color: on ? "rgba(255,255,255,0.7)" : T.faint }}>{tagOf(tr, a.type)} · {a.currency}</span>
              </button>
            );
          })}
        </div>
      </Field>
      <label className="flex items-center gap-2 mb-4 ui text-[0.75rem]" style={{ color: T.sub }}>
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        {tr("sheets.payPlan.remember", { name: plan.name })}
      </label>
      <button
        onClick={() => ok && onConfirm(plan.id, ms.id, acct.id, remember)}
        disabled={!ok}
        className="tap ui w-full rounded-2xl py-3.5 text-[0.9375rem] font-semibold"
        style={{ background: ok ? T.gold : T.line, color: ok ? T.ink : T.faint }}
      >
        {tr("sheets.payPlan.confirm", { name: acct?.name || "…" })}
      </button>
    </Sheet>
  );
}

/* ── Trip (new / edit) ── */
export function TripSheet({ open, onClose, onSave, initial }) {
  const tr = useT();
  const [f, setF] = useState(null);
  const init = React.useCallback(() => {
    setF(initial
      ? { name: initial.name, currency: initial.currency, startDate: initial.startDate, endDate: initial.endDate || "", open: initial.open }
      : { name: "", currency: "AED", startDate: todayISO(), endDate: "", open: true });
  }, [initial]);
  useOpenTransition(open, init);
  const [reason, setReason] = useState("");
  if (!open || !f) return null;
  const ok = f.name.trim().length > 0;
  return (
    <Sheet open onClose={onClose} title={initial ? tr("sheets.trip.edit") : tr("sheets.trip.new")}>
      <Field label={tr("sheets.trip.name")}><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={tr("sheets.trip.namePh")} className={inputCls} style={inputStyle()} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={tr("sheets.trip.currency")}>
          <select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} className={inputCls} style={inputStyle()}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label={tr("sheets.trip.start")}><input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} className={inputCls} style={inputStyle()} /></Field>
      </div>
      <Field label={tr("sheets.trip.status")}>
        <ChipRow value={f.open ? "open" : "closed"} onChange={(v) => setF({ ...f, open: v === "open" })} options={[{ value: "open", label: tr("sheets.trip.open") }, { value: "closed", label: tr("sheets.trip.closed") }]} />
      </Field>
      {!f.open && <Field label={tr("sheets.trip.end")}><input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} className={inputCls} style={inputStyle()} /></Field>}
      <p className="ui text-[0.6875rem] -mt-1 mb-3" style={{ color: T.faint }}>{tr("sheets.trip.hint")}</p>
      <SaveReason text={reason} />
      <button
        onClick={() => { if (!ok) { setReason(tr("ux.needName")); return; } onSave({ id: initial?.id || uid(), name: f.name.trim(), currency: f.currency, startDate: f.startDate, endDate: f.open ? null : (f.endDate || todayISO()), open: f.open, settledDebtId: initial?.settledDebtId || null }); }}
        aria-disabled={!ok}
        className="tap ui w-full rounded-2xl py-3.5 text-[0.9375rem] font-semibold mt-2"
        style={{ background: T.ink, color: "#fff", opacity: ok ? 1 : 0.7 }}
      >
        {tr("sheets.trip.save")}
      </button>
    </Sheet>
  );
}

/* ── Debt ── */
export function DebtSheet({ open, onClose, onSave, initial }) {
  const tr = useT();
  const [f, setF] = useState(null);
  /* `initial` = prefill from a spoken loan phrase — user still reviews and Saves. */
  const init = React.useCallback(() => {
    setF({
      person: initial?.person || "",
      direction: initial?.direction === "borrowed" ? "borrowed" : initial?.noReturn ? "given" : "lent",
      amount: initial?.amount != null ? String(initial.amount) : "",
      currency: initial?.currency || "AED",
      note: initial?.note || "",
      date: initial?.date || todayISO(),
    });
  }, [initial]);
  useOpenTransition(open, init);
  const [reason, setReason] = useState("");
  if (!open || !f) return null;
  const ok = f.person.trim() && +f.amount > 0;
  return (
    <Sheet open onClose={onClose} title={tr("sheets.debt.title")}>
      <Field label={tr("sheets.debt.person")}><input value={f.person} onChange={(e) => setF({ ...f, person: e.target.value })} placeholder={tr("sheets.debt.personPh")} className={inputCls} style={inputStyle()} /></Field>
      <Field label={tr("sheets.debt.direction")}>
        <ChipRow value={f.direction} onChange={(v) => setF({ ...f, direction: v })} options={[{ value: "lent", label: tr("sheets.debt.lent") }, { value: "borrowed", label: tr("sheets.debt.borrowed") }, { value: "given", label: tr("sheets.debt.given") }]} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={tr("sheets.debt.amount")}><input type="number" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0" className={`${inputCls} mono`} style={inputStyle()} /></Field>
        <Field label={tr("sheets.debt.currency")}>
          <select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} className={inputCls} style={inputStyle()}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
      </div>
      <Field label={tr("sheets.debt.note")}><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder={tr("sheets.debt.notePh")} className={inputCls} style={inputStyle()} /></Field>
      <SaveReason text={reason} />
      <button
        onClick={() => { if (!ok) { setReason(!f.person.trim() ? tr("ux.needPerson") : tr("ux.needAmount")); return; } onSave({ id: uid(), person: f.person.trim(), direction: f.direction === "borrowed" ? "borrowed" : "lent", noReturn: f.direction === "given", amount: +f.amount, currency: f.currency, repaid: 0, note: f.note.trim(), date: f.date }); }}
        aria-disabled={!ok}
        className="tap ui w-full rounded-2xl py-3.5 text-[0.9375rem] font-semibold mt-2"
        style={{ background: T.ink, color: "#fff", opacity: ok ? 1 : 0.7 }}
      >
        {tr("sheets.debt.save")}
      </button>
    </Sheet>
  );
}

/* ── Edit a logged transaction (batch 9): fix the note, or move it to the
   right account. Amount/category stay put — delete + re-add for those. ── */
export function EditTxSheet({ open, onClose, tx, accounts, onSave, trips = [], onDelete }) {
  const tr = useT();
  const [note, setNote] = useState("");
  const [accId, setAccId] = useState(null);
  const [cat, setCat] = useState(null);
  /* Trip tag: "<tripId>:<kind>" or "none". */
  const [tripSel, setTripSel] = useState("none");
  const init = React.useCallback(() => {
    setNote(tx?.note || "");
    setAccId(tx?.accountId || null);
    setCat(tx?.category || null);
    setTripSel(tx?.tripId ? `${tx.tripId}:${tx.tripKind || "personal"}` : "none");
  }, [tx]);
  useOpenTransition(open, init);
  if (!open || !tx) return null;
  const isTr = tx.type === "transfer";
  const movable = !isTr && tx.type !== "adjustment";
  const cats = tx.type === "income" ? INC_CATS : EXP_CATS.filter((c) => c.n !== "Adjustment");
  const save = () => {
    const { tripId: _t, tripKind: _k, ...rest } = tx;
    const [tid, tkind] = tripSel === "none" ? [null, null] : tripSel.split(":");
    onSave({ ...rest, note: note.trim(), ...(movable && accId ? { accountId: accId } : {}), ...(movable && cat ? { category: cat } : {}), ...(tid && tx.type === "expense" ? { tripId: tid, tripKind: tkind } : {}) });
  };
  const tripOptions = tx.type === "expense" && trips.length
    ? [{ value: "none", label: tr("sheets.editTx.notTrip") }, ...trips.flatMap((x) => [{ value: `${x.id}:personal`, label: `🧳 ${x.name} · ${tr("sheets.editTx.personal")}` }, { value: `${x.id}:work`, label: `🧳 ${x.name} · ${tr("sheets.editTx.work")}` }])]
    : null;
  return (
    <Sheet open onClose={onClose} title={tr("sheets.editTx.title")}>
      {/* The header category is DIRECTLY editable — tap it, pick, done.
          (The chip row below stays in sync as a visual alternative.) */}
      <div className="rounded-xl px-3.5 py-3 mb-4 flex items-center justify-between" style={{ background: T.paper }}>
        <div className="ui text-[0.8125rem] flex items-center gap-1.5 min-w-0" style={{ color: T.text }}>
          {movable ? (
            <>
              {(() => {
                const def = cats.find((c) => c.n === (cat || tx.category));
                return def ? <def.I size={15} className="shrink-0" style={{ color: def.c }} aria-hidden="true" /> : null;
              })()}
              <select
                value={cat || tx.category}
                onChange={(e) => setCat(e.target.value)}
                className="ui text-[0.8125rem] font-semibold bg-transparent outline-none"
                style={{ color: T.text, WebkitAppearance: "none", appearance: "none", border: "none", padding: 0 }}
                aria-label={tr("sheets.editTx.catAria")}
              >
                {cats.map((c) => <option key={c.n} value={c.n}>{catLabel(c.n)}</option>)}
              </select>
              <ChevronDown size={13} className="shrink-0" style={{ color: T.goldDeep }} aria-hidden="true" />
            </>
          ) : (
            <span>{isTr ? tr("sheets.editTx.transfer") : tr("sheets.editTx.adjustment")}</span>
          )}
          <span className="ui text-[0.6875rem] shrink-0" style={{ color: T.faint }}>{tx.date}</span>
        </div>
        <Money n={isTr ? tx.sourceAmount : tx.amount} cur={isTr ? tx.sourceCurrency : tx.currency} hide={false} className="text-[0.9375rem]" />
      </div>
      <Field label={tr("sheets.editTx.note")}>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("sheets.editTx.notePh")} className={inputCls} style={inputStyle()} />
      </Field>
      {movable && (
        <Field label={tr("sheets.editTx.category")}>
          <div className="overflow-x-auto no-scroll -mx-5 px-5">
            <div className="flex gap-2 w-max">
              {cats.map((c) => {
                const on = cat === c.n;
                return (
                  <button key={c.n} onClick={() => setCat(c.n)} aria-pressed={on} className="tap ui rounded-xl px-3.5 py-2.5 text-sm flex items-center gap-1.5 whitespace-nowrap" style={on ? { background: `${c.c}1A`, border: `1.5px solid ${c.c}`, color: T.text } : { background: T.paper, color: T.sub, border: `1px solid ${T.line}` }}>
                    <c.I size={14} style={{ color: c.c }} aria-hidden="true" />{catLabel(c.n)}
                  </button>
                );
              })}
            </div>
          </div>
        </Field>
      )}
      {tripOptions && (
        <Field label={tr("sheets.editTx.trip")}>
          <div className="overflow-x-auto no-scroll -mx-5 px-5"><div className="w-max"><ChipRow value={tripSel} onChange={setTripSel} options={tripOptions} /></div></div>
        </Field>
      )}
      {movable && (
        <Field label={tr("sheets.editTx.paidFrom")}>
          <ChipRow
            value={accId}
            onChange={setAccId}
            options={accounts.map((a) => ({ value: a.id, label: `${a.name} · ${tagOf(tr, a.type)}` }))}
          />
        </Field>
      )}
      {!movable && (
        <p className="ui text-[0.6875rem] mb-3" style={{ color: T.faint }}>
          {isTr ? tr("sheets.editTx.trNote") : tr("sheets.editTx.adjNote")}
        </p>
      )}
      <button onClick={save} className="tap ui w-full rounded-2xl py-3.5 text-[0.9375rem] font-semibold mt-2" style={{ background: T.ink, color: "#fff" }}>
        {tr("sheets.editTx.save")}
      </button>
      {onDelete && (
        <button onClick={() => onDelete(tx)} className="tap ui w-full rounded-2xl min-h-[44px] text-[0.8125rem] mt-3 flex items-center justify-center gap-1.5" style={{ background: T.roseBg, color: T.rose }}>
          <Trash2 size={14} aria-hidden="true" />{tr("ux.deleteTx")}
        </button>
      )}
    </Sheet>
  );
}

/* ── SMS approval inbox (nothing posts without explicit approval) ── */
export function InboxSheet({ open, onClose, pending, accounts, matches = {}, onPasteImport, onManualImport, onApprove, onDismiss, onApproveAll }) {
  const tr = useT();
  /* SMS↔subscription links the user chose to break (per item, batch 15). */
  const [unlinked, setUnlinked] = useState({});
  const [sel, setSel] = useState({});
  /* iOS PWAs often refuse programmatic clipboard reads — fall back to a
     plain text box, where the native long-press Paste always works. */
  const [manual, setManual] = useState(false);
  const [manualTxt, setManualTxt] = useState("");
  const init = React.useCallback(() => { setSel({}); setManual(false); setManualTxt(""); setUnlinked({}); }, []);
  useOpenTransition(open, init);
  if (!open) return null;
  const accFor = (p) => sel[p.id] ?? p.accountId ?? "";
  const ready = pending.filter((p) => accFor(p));
  const importManual = (t) => {
    const text = (t ?? manualTxt).trim();
    if (!text) return;
    onManualImport(text);
    setManualTxt("");
    setManual(false);
  };
  return (
    <Sheet open={open} onClose={onClose} title={tr("sheets.inbox.title")} tall>
      <button
        onClick={async () => { const ok = await onPasteImport(); if (!ok) setManual(true); }}
        className="tap ui w-full rounded-xl py-3 text-sm font-medium mb-2 flex items-center justify-center gap-1.5"
        style={{ background: T.ink, color: "#fff" }}
      >
        <ClipboardPaste size={16} aria-hidden="true" />{tr("sheets.inbox.paste")}
      </button>
      {manual && (
        <div className="rounded-xl px-3.5 py-3 mb-2" style={{ background: T.paper, border: `1px solid ${T.gold}` }}>
          <p className="ui text-[0.75rem] mb-2" style={{ color: T.sub }}>
            iOS منع القراءة التلقائية — <b>دوس مطوّلًا جوه الصندوق واختار Paste</b> وهتتستورد لوحدها:
          </p>
          <textarea
            value={manualTxt}
            onChange={(e) => setManualTxt(e.target.value)}
            onPaste={(e) => { const t = e.clipboardData?.getData("text"); if (t) { e.preventDefault(); importManual(t); } }}
            rows={3}
            placeholder="الصق رسالة البنك هنا…"
            className="ui w-full rounded-lg px-3 py-2.5 text-[0.8125rem] outline-none"
            style={{ background: "#fff", border: `1px solid ${T.line}`, color: T.text }}
            aria-label="Paste bank SMS text manually"
          />
          {manualTxt.trim() && (
            <button onClick={() => importManual()} className="tap ui w-full rounded-lg py-2.5 text-[0.8125rem] font-medium mt-2" style={{ background: T.ink, color: "#fff" }}>
              استورد اللي فوق ✓
            </button>
          )}
        </div>
      )}
      <p className="ui text-[0.6875rem] mb-4" style={{ color: T.faint }}>
        {tr("sheets.inbox.note")}
      </p>

      {pending.length === 0 ? (
        <EmptyHint icon={<Landmark size={24} />} text={tr("sheets.inbox.empty")} />
      ) : (
        <>
          {ready.length > 1 && (
            <button onClick={() => onApproveAll(ready.map((p) => ({ p, accountId: accFor(p), subId: !unlinked[p.id] ? matches[p.id]?.subId : undefined })))} className="tap ui w-full rounded-xl py-2.5 text-sm font-medium mb-3" style={{ background: T.greenBg, color: T.green, border: `1px solid ${T.green}` }}>
              {tr("sheets.inbox.approveAll", { n: ready.length })}
            </button>
          )}
          {pending.map((p) => {
            const matched = !!p.accountId;
            return (
              <div key={p.id} className="rounded-2xl mb-3 px-4 py-3.5" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="ui text-sm truncate" style={{ color: T.text }}>{p.merchant || (p.direction === "income" ? tr("sheets.inbox.deposit") : tr("sheets.inbox.withdrawal"))}</div>
                    <div className="ui text-[0.6875rem]" style={{ color: T.faint }}>{humanDay(p.date)}{p.category ? ` · ${catLabel(p.category)}` : ""}{p.cardLast4 ? ` · ****${p.cardLast4}` : ""}</div>
                  </div>
                  <Money n={p.amount} cur={p.currency} color={p.direction === "income" ? T.green : T.text} className="text-base" />
                </div>
                {matches[p.id] && !unlinked[p.id] && (
                  <div className="flex items-center gap-2 mt-2 rounded-lg px-2.5 py-2" style={{ background: T.goldBg || "#B08D5718", border: `1px solid ${T.gold}` }}>
                    <span className="ui text-[0.6875rem] flex-1" style={{ color: T.goldDeep }}>
                      🔁 ده اشتراك <b>{matches[p.id].name}</b> — هيتعلم عليه مدفوع{matches[p.id].byName ? "" : " (تقريب بالقيمة والميعاد)"}
                    </span>
                    <button onClick={() => setUnlinked({ ...unlinked, [p.id]: true })} className="tap ui text-[0.6875rem] shrink-0 opacity-60" style={{ color: T.sub }} aria-label={`Don't link to ${matches[p.id].name}`}>
                      ✕ مش هو
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2.5">
                  <select
                    value={accFor(p)}
                    onChange={(e) => setSel({ ...sel, [p.id]: e.target.value })}
                    className="ui flex-1 rounded-lg px-2.5 py-2 text-[0.8125rem] outline-none"
                    style={{ background: matched && !sel[p.id] ? T.greenBg : T.paper, border: `1px solid ${matched && !sel[p.id] ? T.green : T.line}`, color: T.text }}
                    aria-label={tr("sheets.inbox.sourceAria")}
                  >
                    <option value="">{tr("sheets.inbox.pick")}</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} · {a.currency}{matched && a.id === p.accountId ? " ✓" : ""}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => accFor(p) && onApprove(p, accFor(p), undefined, !unlinked[p.id] ? matches[p.id]?.subId : undefined)}
                    disabled={!accFor(p)}
                    className="tap ui text-xs font-semibold rounded-lg px-3.5 py-2.5"
                    style={{ background: accFor(p) ? T.ink : T.line, color: accFor(p) ? "#fff" : T.faint }}
                  >
                    {tr("sheets.inbox.approve")}
                  </button>
                  <button onClick={() => onDismiss(p)} className="tap p-2 opacity-50" style={{ color: T.rose }} aria-label={tr("sheets.inbox.dismiss", { name: p.merchant || tr("sheets.inbox.item") })}>
                    <Trash2 size={15} />
                  </button>
                </div>
                <details className="mt-2">
                  <summary className="ui text-[0.6875rem] cursor-pointer" style={{ color: T.faint }}>{tr("sheets.inbox.original")}</summary>
                  <p className="ui text-[0.6875rem] mt-1" style={{ color: T.sub }} dir="auto">{p.rawText}</p>
                </details>
              </div>
            );
          })}
        </>
      )}
    </Sheet>
  );
}

/* ── Settings: draft-validated rates, backup/restore, typed reset ── */
export function SettingsSheet({
  open, onClose, settings, counts, onBase, onPref, onSaveRates, onFetchRates, onExportCsv, onExportBackup, onImportBackup, onResetRequest, backendName, onSetPin, onRemovePin, onAddBiometric,
}) {
  const tr = useT();
  const [bio, setBio] = useState(null);
  const [bioMsg, setBioMsg] = useState("");
  useEffect(() => { if (open) biometricsAvailable().then(setBio); }, [open]);
  const [drafts, setDrafts] = useState({});
  const [err, setErr] = useState("");
  const [fx, setFx] = useState("");
  const fileRef = useRef(null);
  const init = React.useCallback(() => {
    setDrafts(Object.fromEntries(CURRENCIES.map((c) => [c, String(settings.rates[c])])));
    setErr("");
  }, [settings.rates]);
  useOpenTransition(open, init);
  if (!open) return null;

  const saveRates = () => {
    const next = {};
    for (const c of CURRENCIES) {
      const v = c === "USD" ? 1 : parseFloat(drafts[c]);
      if (!isValidRate(v)) { setErr(tr("sheets.settings.rateErr", { c })); return; }
      next[c] = v;
    }
    setErr("");
    onSaveRates(next);
  };

  return (
    <Sheet open={open} onClose={onClose} title={tr("sheets.settings.title")} tall>
      <div className="rounded-2xl px-4 pt-4 pb-1 mb-3" style={{ background: T.surface, boxShadow: T.shadow1 }}>
      <Field label={tr("sheets.settings.appearance")}>
        <ChipRow value={settings.theme || "system"} onChange={(v) => onPref?.("theme", v)} options={[{ value: "system", label: tr("sheets.settings.system") }, { value: "light", label: tr("sheets.settings.light") }, { value: "dark", label: tr("sheets.settings.dark") }]} />
      </Field>
      <Field label={tr("sheets.settings.language")}>
        <ChipRow value={settings.language || "en"} onChange={(v) => onPref?.("language", v)} options={[{ value: "en", label: "English" }, { value: "ar", label: "العربية" }]} />
      </Field>
      </div>

      <div className="rounded-2xl px-4 pt-4 pb-1 mb-3" style={{ background: T.surface, boxShadow: T.shadow1 }}>
      <Field label={tr("sheets.settings.base")}>
        <ChipRow value={settings.base} onChange={onBase} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        <p className="ui text-[0.6875rem] mt-2" style={{ color: T.faint }}>{tr("ux.baseNote", { cur: settings.base })}</p>
      </Field>

      <Field label={tr("sheets.settings.rates")}>
        <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 mb-3" style={{ background: T.greenBg }}>
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: T.green }} aria-hidden="true" />
          <span className="ui text-[0.75rem] flex-1" style={{ color: T.text }}>
            {tr("sheets.settings.autoRefresh")}{settings.ratesUpdatedAt ? tr("sheets.settings.lastUpdated", { date: settings.ratesUpdatedAt }) : ""}
          </span>
          <button
            onClick={() => {
              if (!onFetchRates || fx === "loading") return;
              setFx("loading");
              onFetchRates()
                .then((r) => { setDrafts(Object.fromEntries(CURRENCIES.map((c) => [c, String(r[c])]))); setFx("ok"); })
                .catch(() => setFx("err"));
            }}
            className="tap ui text-[0.75rem] font-semibold rounded-lg px-3 py-1.5 shrink-0"
            style={{ background: T.ink, color: "#fff", opacity: fx === "loading" ? 0.6 : 1 }}
          >
            {fx === "loading" ? tr("sheets.settings.updating") : tr("sheets.settings.updateNow")}
          </button>
        </div>
        {fx === "ok" && <p role="status" className="ui text-[0.6875rem] mb-2" style={{ color: T.green }}>{tr("sheets.settings.updated")}</p>}
        {fx === "err" && <p role="alert" className="ui text-[0.6875rem] mb-2" style={{ color: T.rose }}>{tr("sheets.settings.fetchErr")}</p>}
        {CURRENCIES.map((c) => (
          <div key={c} className="flex items-center gap-3 mb-2">
            <span className="mono text-sm w-10" style={{ color: T.text }}>{c}</span>
            <input
              type="number" step="0.0001" inputMode="decimal" disabled={c === "USD"}
              value={drafts[c] ?? ""}
              onChange={(e) => setDrafts({ ...drafts, [c]: e.target.value })}
              className="mono flex-1 rounded-xl px-3 py-2 text-sm outline-none"
              style={{ ...inputStyle(), opacity: c === "USD" ? 0.55 : 1 }}
              aria-label={tr("sheets.settings.rateAria", { c })}
            />
          </div>
        ))}
        {err && <p role="alert" className="ui text-[0.75rem] mb-2" style={{ color: T.rose }}>{err}</p>}
        {CURRENCIES.some((c) => c !== "USD" && String(settings.rates[c]) !== drafts[c]) && (
          <p className="ui text-[0.75rem] mb-2 rounded-lg px-3 py-2" style={{ background: T.amberBg, color: T.amber }}>{tr("ux.ratesNote")}</p>
        )}
        <div className="flex gap-2 items-center">
          <button onClick={saveRates} className="tap ui text-sm font-medium rounded-xl px-4 py-2.5" style={{ background: T.ink, color: "#fff" }}>{tr("sheets.settings.saveRates")}</button>
          <button onClick={() => { setDrafts(Object.fromEntries(CURRENCIES.map((c) => [c, String(DEFAULT_RATES[c])]))); setErr(""); }} className="tap ui text-sm rounded-xl px-4 py-2.5" style={{ border: `1px solid ${T.line}`, color: T.sub }}>{tr("sheets.settings.resetDefaults")}</button>
        </div>
        <p className="ui text-[0.6875rem] mt-2" style={{ color: T.faint }}>
          {tr("sheets.settings.manualNote")}
        </p>
      </Field>
      </div>

      <div className="rounded-2xl px-4 pt-4 pb-1 mb-3" style={{ background: T.surface, boxShadow: T.shadow1 }}>
      <Field label={tr("ux.lock")}>
        <ChipRow value={settings.lock?.pinHash ? "pin" : "off"} onChange={(v) => (v === "pin" ? onSetPin?.() : onRemovePin?.())} options={[{ value: "off", label: tr("ux.lockOff") }, { value: "pin", label: tr("ux.lockPin") }]} />
        {settings.lock?.pinHash && (
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {settings.lock.credId ? (
              <span className="ui text-[0.75rem] flex items-center gap-1.5" style={{ color: T.green }}><Fingerprint size={14} aria-hidden="true" />{tr("ux.faceIdAdded")}</span>
            ) : bio ? (
              <button onClick={async () => { const ok = await onAddBiometric?.(); setBioMsg(ok ? tr("ux.faceIdAdded") : tr("ux.faceIdUnavailable")); }} className="tap ui text-[0.75rem] rounded-lg px-3 min-h-[40px] flex items-center gap-1.5" style={{ background: T.goldBg, color: T.goldDeep }}><Fingerprint size={14} aria-hidden="true" />{tr("ux.faceIdAdd")}</button>
            ) : (
              <span className="ui text-[0.75rem]" style={{ color: T.faint }}>{tr("ux.faceIdUnavailable")}</span>
            )}
            {bioMsg && <span className="ui text-[0.75rem]" style={{ color: T.sub }}>{bioMsg}</span>}
          </div>
        )}
      </Field>
      </div>

      <div className="rounded-2xl px-4 pt-4 pb-1 mb-3" style={{ background: T.surface, boxShadow: T.shadow1 }}>
      <Field label={tr("sheets.settings.backup")}>
        <div className="flex flex-wrap gap-2">
          <button onClick={onExportBackup} className="tap ui text-sm rounded-xl px-4 py-2.5 flex items-center gap-1.5" style={{ background: T.ink, color: "#fff" }}><Download size={15} aria-hidden="true" />{tr("sheets.settings.exportJson")}</button>
          <button onClick={() => fileRef.current?.click()} className="tap ui text-sm rounded-xl px-4 py-2.5 flex items-center gap-1.5" style={{ border: `1px solid ${T.line}`, color: T.sub }}><Upload size={15} aria-hidden="true" />{tr("sheets.settings.restore")}</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-hidden="true" onChange={(e) => { const file = e.target.files?.[0]; if (file) onImportBackup(file); e.target.value = ""; }} />
          <button onClick={onExportCsv} className="tap ui text-sm rounded-xl px-4 py-2.5 flex items-center gap-1.5" style={{ border: `1px solid ${T.line}`, color: T.sub }}><Download size={15} aria-hidden="true" />{tr("sheets.settings.csv")}</button>
        </div>
        <p className="ui text-[0.6875rem] mt-2" style={{ color: T.faint }}>{tr("sheets.settings.backupNote")}</p>
      </Field>
      </div>

      <div className="rounded-2xl px-4 pt-4 pb-1 mb-3" style={{ background: T.surface, boxShadow: T.shadow1 }}>
      <Field label={tr("sheets.settings.yourData")}>
        <p className="mono text-xs mb-3" style={{ color: T.sub }}>
          {tr("sheets.settings.counts", { tx: counts.tx, a: counts.accounts, r: counts.recurrs, d: counts.debts, s: backendName })}
        </p>
      </Field>
      </div>

      <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${T.roseBg}` }}>
        <button onClick={onResetRequest} className="tap ui text-sm rounded-xl px-4 min-h-[44px] flex items-center gap-1.5" style={{ background: T.roseBg, color: T.rose }}>
          <Trash2 size={15} aria-hidden="true" />{tr("sheets.settings.reset")}
        </button>
      </div>

      <p className="ui text-[0.6875rem] flex items-start gap-1.5 mt-1" style={{ color: T.faint }}>
        <Sparkles size={13} className="shrink-0 mt-0.5" style={{ color: T.gold }} aria-hidden="true" />
        {tr("sheets.settings.privacy")}
      </p>
    </Sheet>
  );
}


/* ── Restore from file: summary first, then two named choices. Replace asks
   once more, inline — never a native dialog. ── */
export function ImportSheet({ open, onClose, target, current, onApply }) {
  const tr = useT();
  const [confirmReplace, setConfirmReplace] = useState(false);
  useEffect(() => { if (open) setConfirmReplace(false); }, [open]);
  if (!open || !target) return null;
  if (target.error)
    return (
      <Sheet open onClose={onClose} title={tr("ux.importTitle")}>
        <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ background: T.roseBg, color: T.rose }}>
          <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span className="ui text-[0.8125rem]">{tr("ux.importBad")}<br /><span className="mono text-[0.6875rem]">{target.name}</span></span>
        </div>
      </Sheet>
    );
  const { summary } = target.res;
  return (
    <Sheet open onClose={onClose} title={tr("ux.importTitle")}>
      <div className="rounded-2xl px-4 py-3 mb-4" style={{ background: T.paper }}>
        <div className="mono text-[0.75rem] truncate" style={{ color: T.text }}>{target.name}</div>
        <div className="ui text-[0.75rem] mt-0.5" style={{ color: T.sub }}>
          {target.exportedAt ? `${tr("ux.exported", { date: String(target.exportedAt).slice(0, 10) })} · ` : ""}
          {tr("ux.importSummary", { a: summary.accounts, tx: summary.transactions, r: summary.recurring, d: summary.debts })}{summary.plans ? tr("ux.importPlans", { p: summary.plans }) : ""}
        </div>
        <div className="ui text-[0.6875rem] mt-1" style={{ color: T.faint }}>{tr("ux.importSummary", { a: current.accounts.length, tx: current.transactions.length, r: current.recurrs.length, d: current.debts.length })} ← {tr("sheets.settings.yourData")}</div>
      </div>
      {!confirmReplace ? (
        <div className="flex flex-col gap-2">
          <button onClick={() => onApply("add")} className="tap ui w-full rounded-2xl min-h-[52px] text-[0.9375rem] font-semibold" style={{ background: T.goldBg, color: T.goldDeep }}>{tr("ux.importAdd")}</button>
          <button onClick={() => setConfirmReplace(true)} className="tap ui w-full rounded-2xl min-h-[52px] text-[0.9375rem]" style={{ border: `1px solid ${T.lineStrong}`, color: T.text }}>{tr("ux.importReplace")}</button>
          <p className="ui text-[0.6875rem] text-center mt-1" style={{ color: T.faint }}>{tr("ux.importKeep")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="ui text-[0.8125rem] rounded-xl px-4 py-3" style={{ background: T.amberBg, color: T.amber }}>{tr("ux.importReplaceWarn")}</p>
          <button onClick={() => onApply("replace")} className="tap ui w-full rounded-2xl min-h-[52px] text-[0.9375rem] font-semibold" style={{ background: T.rose, color: "#fff" }}>{tr("ux.importReplaceConfirm")}</button>
          <button onClick={() => setConfirmReplace(false)} className="tap ui w-full rounded-2xl min-h-[44px] text-[0.875rem]" style={{ color: T.sub }}>{tr("actions.cancel")}</button>
        </div>
      )}
    </Sheet>
  );
}

/* ── One account: balance, recent activity here, match the bank, edit. ── */
export function AccountSheet({ open, onClose, account, balance, transactions, hide, accName, onAdjust, onEdit, onAllActivity }) {
  const tr = useT();
  const [actual, setActual] = useState("");
  useEffect(() => { if (open) setActual(""); }, [open]);
  if (!open || !account) return null;
  const a = account;
  const isCredit = a.type === "credit";
  const recent = transactions.filter((x) => x.accountId === a.id || x.sourceAccountId === a.id || x.destinationAccountId === a.id).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 8);
  const v = actual === "" ? null : +actual;
  const target = v == null || !Number.isFinite(v) ? null : (isCredit ? -Math.abs(v) : v);
  const diff = target == null ? null : target - balance;
  return (
    <Sheet open onClose={onClose} title={a.name} tall>
      <div className="rounded-2xl px-4 py-4 mb-4" style={{ background: T.paper }}>
        <div className="ui text-[0.6875rem] uppercase tracking-wider" style={{ color: T.sub }}>{tr(`accountTypes.${a.type}`)} · {a.currency}</div>
        <div className="mono text-[1.875rem] leading-tight mt-1" style={{ color: isCredit && balance < 0 ? T.rose : T.text }}>{hide ? "•••••" : `${balance < 0 ? "−" : ""}${fmtMoney(Math.abs(balance), a.currency, false)}`}</div>
        <div className="flex gap-2 mt-3">
          <button onClick={() => onEdit(a)} className="tap ui text-[0.75rem] rounded-lg px-3 min-h-[40px] flex items-center gap-1.5" style={{ border: `1px solid ${T.lineStrong}`, color: T.sub }}><Pencil size={13} aria-hidden="true" />{tr("ux.edit")}</button>
          <button onClick={() => onAllActivity(a)} className="tap ui text-[0.75rem] rounded-lg px-3 min-h-[40px] flex items-center gap-1" style={{ border: `1px solid ${T.lineStrong}`, color: T.sub }}>{tr("ux.allActivity")}<ChevronRight size={13} aria-hidden="true" /></button>
        </div>
      </div>
      <Field label={tr("ux.reconcile")}>
        <div className="flex gap-2">
          <input type="number" inputMode="decimal" value={actual} onChange={(e) => setActual(e.target.value)} placeholder={tr("ux.bankBalancePh")} className={`${inputCls} mono`} style={inputStyle()} aria-label={tr("sheets.accounts.actualAria", { name: a.name })} />
          <button
            onClick={() => { if (diff == null || Math.abs(diff) < 0.005) return; onAdjust(a, diff); setActual(""); }}
            className="tap ui text-xs font-medium rounded-xl px-3 min-h-[48px] whitespace-nowrap"
            style={{ background: diff == null || Math.abs(diff) < 0.005 ? T.line : T.ink, color: diff == null || Math.abs(diff) < 0.005 ? T.sub : "#fff" }}
          >
            {diff == null ? tr("sheets.accounts.reconcile") : Math.abs(diff) < 0.005 ? tr("ux.noDiff") : tr("ux.recordDiff", { diff: `${diff > 0 ? "+" : "−"}${fmtMoney(Math.abs(diff), a.currency)}` })}
          </button>
        </div>
      </Field>
      <Section title={tr("ux.recentHere")}>
        {recent.length === 0 ? (
          <div className="ui text-[0.8125rem] px-0.5" style={{ color: T.sub }}>—</div>
        ) : (
          <CardBox>{recent.map((x, i) => <TxRow key={x.id} t={x} i={i} hide={hide} accName={accName} compact />)}</CardBox>
        )}
      </Section>
    </Sheet>
  );
}

/* ── App lock: the whole app waits behind a keypad (and biometrics). ── */
export function LockScreen({ onPin, onBio }) {
  const tr = useT();
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(false);
  useEffect(() => { if (onBio) onBio(); }, [onBio]);
  useEffect(() => {
    if (pin.length === 4) onPin(pin).then((ok) => { if (!ok) { setWrong(true); setPin(""); } });
  }, [pin, onPin]);
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: T.paper }}>
      <div className="w-full max-w-xs text-center">
        <div className="mx-auto h-14 w-14 rounded-full flex items-center justify-center mb-4" style={{ background: T.ink, color: "#fff" }}><Lock size={22} aria-hidden="true" /></div>
        <div className="disp text-lg mb-1" style={{ color: T.text }}>Pocket Ledger</div>
        <div className="ui text-[0.8125rem] mb-5" style={{ color: wrong ? T.rose : T.sub }} role="status">{wrong ? tr("ux.wrongPin") : tr("ux.locked")}</div>
        <div className="flex justify-center gap-3 mb-6" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <span key={i} className="h-3 w-3 rounded-full" style={{ background: i < pin.length ? T.goldDeep : T.line }} />)}
        </div>
        <Numpad value={pin} onChange={(v) => { if (/^\d{0,4}$/.test(v)) { setWrong(false); setPin(v); } }} />
        {onBio && (
          <button onClick={onBio} className="tap ui mt-5 text-[0.8125rem] flex items-center gap-1.5 mx-auto min-h-[44px]" style={{ color: T.goldDeep }}><Fingerprint size={16} aria-hidden="true" />{tr("ux.faceId")}</button>
        )}
      </div>
    </div>
  );
}

/* ── Choose a PIN (twice). ── */
export function PinSheet({ open, onClose, onSet }) {
  const tr = useT();
  const [first, setFirst] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { if (open) { setFirst(""); setPin(""); setErr(""); } }, [open]);
  useEffect(() => {
    if (pin.length !== 4) return;
    if (!first) { setFirst(pin); setPin(""); return; }
    if (pin === first) { onSet(pin); } else { setErr(tr("ux.pinMismatch")); setFirst(""); setPin(""); }
  }, [pin, first, onSet, tr]);
  if (!open) return null;
  return (
    <Sheet open onClose={onClose} title={tr("ux.lock")}>
      <div className="text-center mb-4">
        <div className="ui text-[0.9375rem]" style={{ color: T.text }}>{first ? tr("ux.confirmPin") : tr("ux.setPin")}</div>
        {err && <div className="ui text-[0.75rem] mt-1" style={{ color: T.rose }} role="alert">{err}</div>}
        <div className="flex justify-center gap-3 mt-4" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <span key={i} className="h-3 w-3 rounded-full" style={{ background: i < pin.length ? T.goldDeep : T.line }} />)}
        </div>
      </div>
      <Numpad value={pin} onChange={(v) => { if (/^\d{0,4}$/.test(v)) setPin(v); }} />
    </Sheet>
  );
}
