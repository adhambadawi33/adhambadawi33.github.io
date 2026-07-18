import React, { useEffect, useRef, useState } from "react";
import {
  Plus, Landmark, Check, Pencil, Eye, EyeOff, Download, Upload, Trash2, Sparkles, ChevronDown,
  ClipboardPaste, Wand2, ChevronUp,
} from "lucide-react";
import {
  T, ACCOUNT_TYPE_DEFS, ACCOUNT_COLORS, EXP_CATS, INC_CATS, fmtMoney, inputCls, inputStyle,
} from "../../styles/tokens.js";
import { Sheet, Field, ChipRow, Numpad, EmptyHint, Money } from "../common/primitives.jsx";
import { CURRENCIES, convert, isValidRate, DEFAULT_RATES } from "../../lib/finance/currency.js";
import { parseVoice } from "../../lib/voice/parse.js";
import { todayISO } from "../../lib/dates/localDate.js";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* Opens only on the closed->open transition (handoff §6.2) */
function useOpenTransition(open, init) {
  const prev = useRef(false);
  useEffect(() => {
    if (open && !prev.current) init();
    prev.current = open;
  }, [open, init]);
}

/* ── Add transaction ─────────────────────────────────────────── */
export function AddTxSheet({ open, onClose, accounts, settings, onSave, goAccounts, initialText }) {
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [cur, setCur] = useState("AED");
  const [cat, setCat] = useState(EXP_CATS[0].n);
  const [accId, setAccId] = useState(null);
  const [toId, setToId] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [more, setMore] = useState(false);
  const [quick, setQuick] = useState("");
  const [parsedHint, setParsedHint] = useState("");

  /* Apply parser output as PREFILL only — user always reviews then Saves. */
  const applyParse = React.useCallback((text) => {
    const p = parseVoice(text, accounts, settings);
    if (!p) return;
    setType(p.type);
    if (p.amount != null) setAmount(String(p.amount));
    if (p.type !== "transfer" && p.category) setCat(p.category);
    if (p.accountId) setAccId(p.accountId);
    if (p.type === "transfer" && p.toAccountId) setToId(p.toAccountId);
    const accCur = p.accountId ? accounts.find((a) => a.id === p.accountId)?.currency : null;
    if (p.currency) setCur(p.currency);
    else if (accCur) setCur(accCur);
    if (p.note) { setNote(p.note); }
    const bits = [
      p.type, p.amount != null ? `${p.amount} ${p.currency || accCur || ""}`.trim() : null,
      p.type === "transfer"
        ? `${accounts.find((a) => a.id === p.accountId)?.name || "?"} → ${accounts.find((a) => a.id === p.toAccountId)?.name || "?"}`
        : p.category,
      p.type !== "transfer" && p.accountId ? accounts.find((a) => a.id === p.accountId)?.name : null,
    ].filter(Boolean);
    setParsedHint(bits.join(" · "));
  }, [accounts, settings]);

  const init = React.useCallback(() => {
    setAmount(""); setNote(""); setDate(todayISO()); setType("expense"); setCat(EXP_CATS[0].n); setMore(false);
    setQuick(initialText || ""); setParsedHint("");
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
      window.alert("Clipboard access was blocked — paste into the field manually.");
    }
  };

  if (!open) return null;
  const acc = accounts.find((a) => a.id === accId);
  const to = accounts.find((a) => a.id === toId);
  const cats = type === "income" ? INC_CATS : EXP_CATS.filter((c) => c.n !== "Adjustment");
  const ok = +amount > 0 && !!acc && (type !== "transfer" || (to && toId !== accId));

  const save = () => {
    if (!ok) return;
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
      onSave({ id: uid(), type, date, note: note.trim(), snapshot, amount: +amount, currency: cur, accountId: acc.id, category: cat });
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
      <Sheet open onClose={onClose} title="Add transaction">
        <EmptyHint icon={<Landmark size={24} />} text="Add at least one account first — then logging takes three taps." cta="Add accounts" onClick={goAccounts} />
      </Sheet>
    );

  return (
    <Sheet open onClose={onClose} title="Add transaction" tall>
      <div onKeyDown={onKey}>
        {/* Quick add — type or use the keyboard mic; parser prefills the form */}
        <div className="mb-3">
          <div className="flex gap-2">
            <input
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); applyParse(quick); } }}
              placeholder='🎙️ اكتب أو أملِ… "غدا 120 درهم كاش"'
              className="ui flex-1 rounded-xl px-3.5 py-3 text-[14px] outline-none"
              style={{ background: T.paper, border: `1px solid ${T.line}`, color: T.text }}
              aria-label="Quick add by voice or text"
            />
            <button onClick={pasteQuick} className="tap h-[46px] w-[46px] rounded-xl flex items-center justify-center shrink-0" style={{ background: T.paper, border: `1px solid ${T.line}`, color: T.sub }} aria-label="Paste from clipboard">
              <ClipboardPaste size={17} />
            </button>
            <button onClick={() => applyParse(quick)} disabled={!quick.trim()} className="tap h-[46px] w-[46px] rounded-xl flex items-center justify-center shrink-0" style={{ background: quick.trim() ? T.gold : T.line, color: quick.trim() ? T.ink : T.faint }} aria-label="Understand and fill the form">
              <Wand2 size={17} />
            </button>
          </div>
          {parsedHint && (
            <p className="ui text-[11px] mt-1.5 flex items-center gap-1" style={{ color: T.goldDeep }} aria-live="polite">
              <Sparkles size={12} aria-hidden="true" /> {parsedHint} — review below, then Save
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {[["expense", "Expense"], ["income", "Income"], ["transfer", "Transfer"]].map(([v, l]) => (
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
          <span className="mono text-[40px] leading-none" style={{ color: +amount > 0 ? T.text : T.faint }}>{amount || "0"}</span>
          <span className="ui text-base ml-2" style={{ color: T.faint }}>{cur}</span>
        </div>
        <div className="flex justify-center gap-1.5 mb-3">
          {CURRENCIES.map((c) => (
            <button key={c} onClick={() => setCur(c)} aria-pressed={cur === c} className="tap mono rounded-full px-3.5 py-2 text-[12px]" style={cur === c ? { background: T.ink, color: "#fff" } : { background: T.paper, color: T.sub, border: `1px solid ${T.line}` }}>
              {c}
            </button>
          ))}
        </div>
        {acc && cur !== acc.currency && +amount > 0 && (
          <p className="ui text-[11px] text-center mb-2" style={{ color: T.faint }}>
            ≈ {fmtMoney(convert(+amount, cur, acc.currency, settings.rates), acc.currency)} from {acc.name}
          </p>
        )}
        <div className="mb-4"><Numpad value={amount} onChange={setAmount} /></div>

        {type !== "transfer" && (
          <Field label="Category">
            <div className="grid grid-cols-4 gap-2">
              {cats.map((c) => {
                const on = cat === c.n;
                return (
                  <button key={c.n} onClick={() => setCat(c.n)} aria-pressed={on} className="tap rounded-xl px-1 py-2.5 flex flex-col items-center gap-1" style={on ? { background: `${c.c}1A`, border: `1.5px solid ${c.c}` } : { background: T.paper, border: `1px solid ${T.line}` }}>
                    <c.I size={17} style={{ color: c.c }} aria-hidden="true" />
                    <span className="ui text-[10px] leading-tight text-center" style={{ color: on ? T.text : T.sub }}>{c.n.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        <Field label={type === "transfer" ? "From account" : "Account"}>
          <ChipRow
            value={accId}
            onChange={(v) => { setAccId(v); const na = accounts.find((a) => a.id === v); if (na) setCur(na.currency); }}
            options={accounts.map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` }))}
          />
        </Field>
        {type === "transfer" && (
          <Field label="To account">
            <ChipRow value={toId} onChange={setToId} options={accounts.filter((a) => a.id !== accId).map((a) => ({ value: a.id, label: `${a.name} · ${a.currency}` }))} />
          </Field>
        )}

        <button onClick={() => setMore(!more)} className="tap ui text-xs flex items-center gap-1 mb-3" style={{ color: T.sub }} aria-expanded={more}>
          <ChevronDown size={14} style={{ transform: more ? "rotate(180deg)" : "none", transition: "transform .15s" }} /> Date & note
        </button>
        {more && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} style={inputStyle} /></Field>
            <Field label="Note (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Carrefour" className={inputCls} style={inputStyle} /></Field>
          </div>
        )}

        <button onClick={save} disabled={!ok} className="tap ui w-full rounded-2xl py-4 text-[15px] font-semibold" style={{ background: ok ? T.ink : T.line, color: ok ? "#fff" : T.faint }}>
          Save {type}
        </button>
      </div>
    </Sheet>
  );
}

/* ── Accounts list + safe balance adjustment (handoff §4.6 / §5.2) ── */
export function AccountsSheet({ open, onClose, accounts, balances, hide, onNew, onEdit, onArchive, onAdjust, onMove }) {
  const [adjustFor, setAdjustFor] = useState(null);
  const [actual, setActual] = useState("");
  useEffect(() => { if (!open) { setAdjustFor(null); setActual(""); } }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title="Accounts">
      <button onClick={onNew} className="tap ui w-full rounded-xl py-3 text-sm font-medium mb-4 flex items-center justify-center gap-1.5" style={{ background: T.ink, color: "#fff" }}>
        <Plus size={16} aria-hidden="true" />New account
      </button>
      {accounts.length === 0 && <p className="ui text-sm text-center py-6" style={{ color: T.faint }}>Add each bank, card and your cash wallet.</p>}
      {accounts.map((a, idx) => {
        const Ico = (ACCOUNT_TYPE_DEFS.find((t) => t.id === a.type) || ACCOUNT_TYPE_DEFS[0]).icon;
        const bal = balances[a.id] || 0;
        const isAdj = adjustFor === a.id;
        return (
          <div key={a.id} style={{ borderBottom: `1px solid ${T.paper}`, opacity: a.archived ? 0.45 : 1 }}>
            <div className="flex items-center gap-3 py-3">
              <div className="flex flex-col -my-1" aria-label={`Reorder ${a.name}`}>
                <button onClick={() => onMove(a, -1)} disabled={idx === 0} className="tap p-1 disabled:opacity-20" style={{ color: T.sub }} aria-label={`Move ${a.name} up`}>
                  <ChevronUp size={15} />
                </button>
                <button onClick={() => onMove(a, 1)} disabled={idx === accounts.length - 1} className="tap p-1 disabled:opacity-20" style={{ color: T.sub }} aria-label={`Move ${a.name} down`}>
                  <ChevronDown size={15} />
                </button>
              </div>
              <span className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: a.color, color: "#fff" }} aria-hidden="true"><Ico size={17} /></span>
              <div className="flex-1 min-w-0">
                <div className="ui text-sm" style={{ color: T.text }}>{a.name}{a.archived ? " (hidden)" : ""}</div>
                <div className="ui text-[11px] capitalize" style={{ color: T.faint }}>{a.type} · {a.currency}</div>
              </div>
              <Money n={a.type === "credit" && bal < 0 ? -bal : bal} cur={a.currency} hide={hide} className="text-sm" />
              <button onClick={() => { setAdjustFor(isAdj ? null : a.id); setActual(""); }} className="tap ui text-[10px] px-2 py-1.5 rounded-lg" style={{ border: `1px solid ${T.line}`, color: T.sub }}>
                Adjust
              </button>
              <button onClick={() => onEdit(a)} className="tap p-2" style={{ color: T.sub }} aria-label={`Edit ${a.name}`}><Pencil size={15} /></button>
              <button onClick={() => onArchive(a)} className="tap p-2" style={{ color: T.faint }} aria-label={a.archived ? `Show ${a.name}` : `Hide ${a.name}`}>
                {a.archived ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
            </div>
            {isAdj && (
              <div className="pb-3 pl-13" style={{ paddingLeft: 52 }}>
                <p className="ui text-[11px] mb-1.5" style={{ color: T.faint }}>
                  Enter the {a.type === "credit" ? "amount you actually owe" : "actual balance"} shown by the bank — the difference is recorded as an adjustment, history stays intact.
                </p>
                <div className="flex gap-2">
                  <input type="number" inputMode="decimal" value={actual} onChange={(e) => setActual(e.target.value)} placeholder={a.currency} className="mono flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} aria-label={`Actual balance for ${a.name}`} />
                  <button
                    onClick={() => {
                      const v = +actual;
                      if (!Number.isFinite(v)) return;
                      const target = a.type === "credit" ? -Math.abs(v) : v;
                      const diff = target - bal;
                      if (Math.abs(diff) < 0.005) { setAdjustFor(null); return; }
                      onAdjust(a, diff);
                      setAdjustFor(null);
                    }}
                    className="tap ui text-xs font-medium rounded-lg px-3"
                    style={{ background: T.ink, color: "#fff" }}
                  >
                    Reconcile
                  </button>
                </div>
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
  const [f, setF] = useState(null);
  const init = React.useCallback(() => {
    setF(
      initial
        ? { ...initial, openingDisplay: String(Math.abs(initial.openingBalance) || ""), cardDigitsText: (initial.cardDigits || []).join(", ") }
        : { id: uid(), name: "", type: "bank", currency: "AED", openingDisplay: "", creditLimit: "", cardDigitsText: "", color: ACCOUNT_COLORS[0], archived: false }
    );
  }, [initial]);
  useOpenTransition(open, init);
  if (!open || !f) return null;
  const ok = f.name.trim().length > 0;
  const isCredit = f.type === "credit";
  return (
    <Sheet open onClose={onClose} title={initial ? "Edit account" : "New account"}>
      <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. ADCB Current" className={inputCls} style={inputStyle} /></Field>
      <Field label="Type"><ChipRow value={f.type} onChange={(v) => setF({ ...f, type: v })} options={ACCOUNT_TYPE_DEFS.map((t) => ({ value: t.id, label: t.label }))} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Currency">
          <select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} className={inputCls} style={inputStyle}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label={isCredit ? "Starting amount owed" : "Starting balance"}>
          <input type="number" inputMode="decimal" value={f.openingDisplay} onChange={(e) => setF({ ...f, openingDisplay: e.target.value })} placeholder="0" className={`${inputCls} mono`} style={inputStyle} />
        </Field>
      </div>
      {initial && (
        <p className="ui text-[11px] -mt-1 mb-3" style={{ color: T.faint }}>
          Starting {isCredit ? "owed" : "balance"} is the opening figure only. Current calculated balance: <b className="mono">{fmtMoney(Math.abs(currentBalance ?? 0), f.currency)}</b>{isCredit && (currentBalance ?? 0) < 0 ? " owed" : ""}. To match the bank, use “Adjust” in the accounts list instead of editing this.
        </p>
      )}
      {isCredit && (
        <Field label="Credit limit (optional)">
          <input type="number" inputMode="decimal" value={f.creditLimit} onChange={(e) => setF({ ...f, creditLimit: e.target.value })} placeholder="e.g. 50000" className={`${inputCls} mono`} style={inputStyle} />
        </Field>
      )}
      <Field label="Card last-4 digits · for bank-SMS matching (optional)">
        <input
          value={f.cardDigitsText ?? ""}
          onChange={(e) => setF({ ...f, cardDigitsText: e.target.value })}
          placeholder="e.g. 4523, 8891"
          inputMode="numeric"
          className={`${inputCls} mono`}
          style={inputStyle}
          aria-label="Card last four digits, comma separated"
        />
      </Field>
      <Field label="Card color">
        <div className="flex gap-2 flex-wrap">
          {ACCOUNT_COLORS.map((c) => (
            <button key={c} onClick={() => setF({ ...f, color: c })} className="tap h-10 w-10 rounded-full flex items-center justify-center" style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={f.color === c}>
              {f.color === c && <Check size={15} style={{ color: "#fff" }} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </Field>
      <button
        onClick={() => {
          if (!ok) return;
          const openVal = Math.abs(+f.openingDisplay || 0);
          /* Sign convention: credit debt stored negative (schema.js). */
          const openingBalance = isCredit ? -openVal : +f.openingDisplay || 0;
          const { openingDisplay: _d, cardDigitsText: _c, ...rest } = f;
          const cardDigits = (f.cardDigitsText || "").split(/[\s,]+/).filter((d) => /^\d{4}$/.test(d));
          onSave({ ...rest, openingBalance, creditLimit: +f.creditLimit || 0, cardDigits });
        }}
        disabled={!ok}
        className="tap ui w-full rounded-2xl py-3.5 text-[15px] font-semibold mt-2"
        style={{ background: ok ? T.ink : T.line, color: ok ? "#fff" : T.faint }}
      >
        Save account
      </button>
    </Sheet>
  );
}

/* ── Recurring ── */
export function RecurrSheet({ open, onClose, kind, accounts, onSave }) {
  const [f, setF] = useState(null);
  const init = React.useCallback(() => {
    setF({ name: "", amount: "", currency: "AED", cycle: "monthly", nextDue: todayISO(), accountId: accounts[0]?.id || null, monthsTotal: "", monthsPaid: "0" });
  }, [accounts]);
  useOpenTransition(open, init);
  if (!open || !f) return null;
  const sub = kind === "subscription";
  const ok = f.name.trim() && +f.amount > 0 && (sub || +f.monthsTotal > 0);
  return (
    <Sheet open onClose={onClose} title={sub ? "New subscription" : "New installment"}>
      <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={sub ? "e.g. Netflix" : "e.g. Car loan"} className={inputCls} style={inputStyle} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={sub ? "Amount / cycle" : "Monthly amount"}>
          <input type="number" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0" className={`${inputCls} mono`} style={inputStyle} />
        </Field>
        <Field label="Currency">
          <select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} className={inputCls} style={inputStyle}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
      </div>
      {sub ? (
        <Field label="Billing cycle">
          <ChipRow value={f.cycle} onChange={(v) => setF({ ...f, cycle: v })} options={[{ value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }]} />
        </Field>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Total months"><input type="number" inputMode="numeric" value={f.monthsTotal} onChange={(e) => setF({ ...f, monthsTotal: e.target.value })} placeholder="12" className={`${inputCls} mono`} style={inputStyle} /></Field>
          <Field label="Already paid"><input type="number" inputMode="numeric" value={f.monthsPaid} onChange={(e) => setF({ ...f, monthsPaid: e.target.value })} className={`${inputCls} mono`} style={inputStyle} /></Field>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={sub ? "Next renewal" : "Next payment"}><input type="date" value={f.nextDue} onChange={(e) => setF({ ...f, nextDue: e.target.value })} className={inputCls} style={inputStyle} /></Field>
        <Field label="Pay from">
          <select value={f.accountId || ""} onChange={(e) => setF({ ...f, accountId: e.target.value })} className={inputCls} style={inputStyle}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
      </div>
      <button
        onClick={() => ok && onSave({ id: uid(), kind, name: f.name.trim(), amount: +f.amount, currency: f.currency, cycle: sub ? f.cycle : "monthly", nextDue: f.nextDue, accountId: f.accountId, paused: false, ...(sub ? {} : { monthsTotal: +f.monthsTotal, monthsPaid: +f.monthsPaid || 0 }) })}
        disabled={!ok}
        className="tap ui w-full rounded-2xl py-3.5 text-[15px] font-semibold mt-2"
        style={{ background: ok ? T.ink : T.line, color: ok ? "#fff" : T.faint }}
      >
        Save {sub ? "subscription" : "installment"}
      </button>
    </Sheet>
  );
}

/* ── Debt ── */
export function DebtSheet({ open, onClose, onSave }) {
  const [f, setF] = useState(null);
  const init = React.useCallback(() => {
    setF({ person: "", direction: "lent", amount: "", currency: "AED", note: "", date: todayISO() });
  }, []);
  useOpenTransition(open, init);
  if (!open || !f) return null;
  const ok = f.person.trim() && +f.amount > 0;
  return (
    <Sheet open onClose={onClose} title="New loan / IOU">
      <Field label="Person"><input value={f.person} onChange={(e) => setF({ ...f, person: e.target.value })} placeholder="Name" className={inputCls} style={inputStyle} /></Field>
      <Field label="Direction">
        <ChipRow value={f.direction} onChange={(v) => setF({ ...f, direction: v })} options={[{ value: "lent", label: "I lent them" }, { value: "borrowed", label: "I borrowed" }]} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount"><input type="number" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0" className={`${inputCls} mono`} style={inputStyle} /></Field>
        <Field label="Currency">
          <select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} className={inputCls} style={inputStyle}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
      </div>
      <Field label="Note (optional)"><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. till end of month" className={inputCls} style={inputStyle} /></Field>
      <button
        onClick={() => ok && onSave({ id: uid(), person: f.person.trim(), direction: f.direction, amount: +f.amount, currency: f.currency, repaid: 0, note: f.note.trim(), date: f.date })}
        disabled={!ok}
        className="tap ui w-full rounded-2xl py-3.5 text-[15px] font-semibold mt-2"
        style={{ background: ok ? T.ink : T.line, color: ok ? "#fff" : T.faint }}
      >
        Save
      </button>
    </Sheet>
  );
}

/* ── SMS approval inbox (nothing posts without explicit approval) ── */
export function InboxSheet({ open, onClose, pending, accounts, onPasteImport, onApprove, onDismiss, onApproveAll }) {
  const [sel, setSel] = useState({});
  const init = React.useCallback(() => setSel({}), []);
  useOpenTransition(open, init);
  if (!open) return null;
  const accFor = (p) => sel[p.id] ?? p.accountId ?? "";
  const ready = pending.filter((p) => accFor(p));
  return (
    <Sheet open={open} onClose={onClose} title="Approval inbox" tall>
      <button onClick={onPasteImport} className="tap ui w-full rounded-xl py-3 text-sm font-medium mb-2 flex items-center justify-center gap-1.5" style={{ background: T.ink, color: "#fff" }}>
        <ClipboardPaste size={16} aria-hidden="true" />الصق رسائل البنك · Paste bank SMS
      </button>
      <p className="ui text-[11px] mb-4" style={{ color: T.faint }}>
        Withdrawals wait here and post <b>only after you approve them</b>. The source account is matched from the card last-4 digits — confirm or change it per item.
      </p>

      {pending.length === 0 ? (
        <EmptyHint icon={<Landmark size={24} />} text="Nothing awaiting approval. Bank alerts you paste (or send via the Shortcut) will queue up here until you confirm each one." />
      ) : (
        <>
          {ready.length > 1 && (
            <button onClick={() => onApproveAll(ready.map((p) => ({ p, accountId: accFor(p) })))} className="tap ui w-full rounded-xl py-2.5 text-sm font-medium mb-3" style={{ background: T.greenBg, color: T.green, border: `1px solid ${T.green}` }}>
              ✓ Approve all matched ({ready.length})
            </button>
          )}
          {pending.map((p) => {
            const matched = !!p.accountId;
            return (
              <div key={p.id} className="rounded-2xl mb-3 px-4 py-3.5" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="ui text-sm truncate" style={{ color: T.text }}>{p.merchant || (p.direction === "income" ? "Deposit" : "Bank withdrawal")}</div>
                    <div className="ui text-[11px]" style={{ color: T.faint }}>{p.date}{p.category ? ` · ${p.category}` : ""}{p.cardLast4 ? ` · ****${p.cardLast4}` : ""}</div>
                  </div>
                  <Money n={p.amount} cur={p.currency} color={p.direction === "income" ? T.green : T.text} className="text-base" />
                </div>
                <div className="flex items-center gap-2 mt-2.5">
                  <select
                    value={accFor(p)}
                    onChange={(e) => setSel({ ...sel, [p.id]: e.target.value })}
                    className="ui flex-1 rounded-lg px-2.5 py-2 text-[13px] outline-none"
                    style={{ background: matched && !sel[p.id] ? T.greenBg : T.paper, border: `1px solid ${matched && !sel[p.id] ? T.green : T.line}`, color: T.text }}
                    aria-label="Source account for this withdrawal"
                  >
                    <option value="">— اختر الحساب / pick account —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} · {a.currency}{matched && a.id === p.accountId ? " ✓" : ""}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => accFor(p) && onApprove(p, accFor(p))}
                    disabled={!accFor(p)}
                    className="tap ui text-xs font-semibold rounded-lg px-3.5 py-2.5"
                    style={{ background: accFor(p) ? T.ink : T.line, color: accFor(p) ? "#fff" : T.faint }}
                  >
                    ✓ Approve
                  </button>
                  <button onClick={() => onDismiss(p)} className="tap p-2 opacity-50" style={{ color: T.rose }} aria-label={`Dismiss ${p.merchant || "item"}`}>
                    <Trash2 size={15} />
                  </button>
                </div>
                <details className="mt-2">
                  <summary className="ui text-[10px] cursor-pointer" style={{ color: T.faint }}>Original message</summary>
                  <p className="ui text-[11px] mt-1" style={{ color: T.sub }} dir="auto">{p.rawText}</p>
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
  open, onClose, settings, counts, onBase, onSaveRates, onExportCsv, onExportBackup, onImportBackup, onResetRequest, backendName,
}) {
  const [drafts, setDrafts] = useState({});
  const [err, setErr] = useState("");
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
      if (!isValidRate(v)) { setErr(`Rate for ${c} must be a positive number.`); return; }
      next[c] = v;
    }
    setErr("");
    onSaveRates(next);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Settings" tall>
      <Field label="Base currency (everything rolls up into this)">
        <ChipRow value={settings.base} onChange={onBase} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
      </Field>

      <Field label="Exchange rates · units per 1 USD">
        {CURRENCIES.map((c) => (
          <div key={c} className="flex items-center gap-3 mb-2">
            <span className="mono text-sm w-10" style={{ color: T.text }}>{c}</span>
            <input
              type="number" step="0.0001" inputMode="decimal" disabled={c === "USD"}
              value={drafts[c] ?? ""}
              onChange={(e) => setDrafts({ ...drafts, [c]: e.target.value })}
              className="mono flex-1 rounded-xl px-3 py-2 text-sm outline-none"
              style={{ ...inputStyle, opacity: c === "USD" ? 0.55 : 1 }}
              aria-label={`Rate for ${c} per 1 USD`}
            />
          </div>
        ))}
        {err && <p role="alert" className="ui text-[12px] mb-2" style={{ color: T.rose }}>{err}</p>}
        <div className="flex gap-2 items-center">
          <button onClick={saveRates} className="tap ui text-sm font-medium rounded-xl px-4 py-2.5" style={{ background: T.ink, color: "#fff" }}>Save rates</button>
          <button onClick={() => { setDrafts(Object.fromEntries(CURRENCIES.map((c) => [c, String(DEFAULT_RATES[c])]))); setErr(""); }} className="tap ui text-sm rounded-xl px-4 py-2.5" style={{ border: `1px solid ${T.line}`, color: T.sub }}>Reset defaults</button>
        </div>
        <p className="ui text-[11px] mt-2" style={{ color: T.faint }}>
          AED & SAR are pegged — mainly keep EGP fresh.
          {settings.ratesUpdatedAt ? ` Last updated ${settings.ratesUpdatedAt}.` : " Not updated yet."}
          {" "}Past entries keep their original rates.
        </p>
      </Field>

      <Field label="Backup & restore">
        <div className="flex flex-wrap gap-2">
          <button onClick={onExportBackup} className="tap ui text-sm rounded-xl px-4 py-2.5 flex items-center gap-1.5" style={{ background: T.ink, color: "#fff" }}><Download size={15} aria-hidden="true" />Export JSON backup</button>
          <button onClick={() => fileRef.current?.click()} className="tap ui text-sm rounded-xl px-4 py-2.5 flex items-center gap-1.5" style={{ border: `1px solid ${T.line}`, color: T.sub }}><Upload size={15} aria-hidden="true" />Restore from file</button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-hidden="true" onChange={(e) => { const file = e.target.files?.[0]; if (file) onImportBackup(file); e.target.value = ""; }} />
          <button onClick={onExportCsv} className="tap ui text-sm rounded-xl px-4 py-2.5 flex items-center gap-1.5" style={{ border: `1px solid ${T.line}`, color: T.sub }}><Download size={15} aria-hidden="true" />CSV</button>
        </div>
        <p className="ui text-[11px] mt-2" style={{ color: T.faint }}>Backup files contain your private financial data — store them somewhere safe.</p>
      </Field>

      <Field label="Your data">
        <p className="mono text-xs mb-3" style={{ color: T.sub }}>
          {counts.tx} transactions · {counts.accounts} accounts · {counts.recurrs} recurring · {counts.debts} loans · storage: {backendName}
        </p>
        <button onClick={onResetRequest} className="tap ui text-sm rounded-xl px-4 py-2.5 flex items-center gap-1.5" style={{ border: `1px solid ${T.rose}`, color: T.rose }}>
          <Trash2 size={15} aria-hidden="true" />Reset all data
        </button>
      </Field>

      <p className="ui text-[11px] flex items-start gap-1.5 mt-1" style={{ color: T.faint }}>
        <Sparkles size={13} className="shrink-0 mt-0.5" style={{ color: T.gold }} aria-hidden="true" />
        Data is stored privately on this device (or your Claude account inside Claude) and never sent to any external service.
      </p>
    </Sheet>
  );
}
