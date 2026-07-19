import React, { useEffect, useRef, useState } from "react";
import {
  Plus, Landmark, Check, Pencil, Eye, EyeOff, Download, Upload, Trash2, Sparkles, ChevronDown,
  ClipboardPaste, Wand2, ChevronUp, Mic, HandCoins,
} from "lucide-react";
import {
  T, ACCOUNT_TYPE_DEFS, ACCOUNT_COLORS, EXP_CATS, INC_CATS, OWNERS, fmtMoney, inputCls, inputStyle, accountStripe,
} from "../../styles/tokens.js";
import { Sheet, Field, ChipRow, Numpad, EmptyHint, Money } from "../common/primitives.jsx";
import { CardChip } from "../common/brand.jsx";
import { bankFor } from "../../lib/brands.js";
import { CURRENCIES, convert, isValidRate, DEFAULT_RATES } from "../../lib/finance/currency.js";
import { parseVoice } from "../../lib/voice/parse.js";
import { todayISO, toISO, daysInMonth } from "../../lib/dates/localDate.js";
import { humanDay } from "../../lib/dates/ui.js";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* Short account-type tag so pickers make bank vs card obvious (Adham). */
const typeTag = (t) => (t === "credit" ? "card" : t === "debit" ? "debit" : t === "cash" ? "cash" : "bank");

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
export function AddTxSheet({ open, onClose, accounts, settings, onSave, goAccounts, initialText, onDebtDraft }) {
  const [type, setType] = useState("expense");
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
  const recRef = useRef(null);

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
    /* Honest fallback: an unrecognized expense lands in "Other", not in
       whatever category happened to be selected (was: Food by default). */
    if (p.type !== "transfer") setCat(p.category || (p.type === "income" ? "Other income" : "Other"));
    if (p.accountId) setAccId(p.accountId);
    if (p.type === "transfer" && p.toAccountId) setToId(p.toAccountId);
    const accCur = p.accountId ? accounts.find((a) => a.id === p.accountId)?.currency : null;
    if (p.currency) setCur(p.currency);
    else if (accCur) setCur(accCur);
    if (p.note) { setNote(p.note); }
    if (p.owner) setOwner(p.owner);
    const bits = [
      p.type, p.amount != null ? `${p.amount} ${p.currency || accCur || ""}`.trim() : null,
      p.type === "transfer"
        ? `${accounts.find((a) => a.id === p.accountId)?.name || "?"} → ${accounts.find((a) => a.id === p.toAccountId)?.name || "?"}`
        : p.category,
      p.type !== "transfer" && p.accountId ? accounts.find((a) => a.id === p.accountId)?.name : null,
      p.owner === "abeer" ? "Abeer" : p.owner === "kids" ? "Kids" : null,
    ].filter(Boolean);
    setParsedHint(bits.join(" · "));
  }, [accounts, settings]);

  const init = React.useCallback(() => {
    setAmount(""); setNote(""); setDate(todayISO()); setType("expense"); setCat(EXP_CATS[0].n); setOwner("me"); setMore(false);
    setQuick(initialText || ""); setParsedHint(""); setDebtDraft(null);
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

  /* Voice entry (batch 5): the phone's built-in speech recognition feeds the
     same parser as typed text. Nothing is saved without the user's Save tap. */
  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { window.alert("Voice capture isn't supported in this browser — use the keyboard mic on the field instead."); return; }
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
      onSave({ id: uid(), type, date, note: note.trim(), snapshot, amount: +amount, currency: cur, accountId: acc.id, category: cat, owner });
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
              className="ui flex-1 rounded-xl px-3.5 py-3 text-[15px] outline-none"
              style={{ background: T.paper, border: `1px solid ${T.line}`, color: T.text }}
              aria-label="Quick add by voice or text"
            />
            <button
              onClick={startVoice}
              className={`tap h-[46px] w-[46px] rounded-xl flex items-center justify-center shrink-0 ${listening ? "pop" : ""}`}
              style={listening ? { background: T.rose, color: "#fff", border: `1px solid ${T.rose}` } : { background: T.ink, color: "#fff" }}
              aria-label={listening ? "Stop listening" : "Speak a transaction"}
              aria-pressed={listening}
            >
              <Mic size={17} />
            </button>
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
          {!parsedHint && !debtDraft && (
            <p className="ui text-[11px] mt-1.5" style={{ color: T.faint }}>
              💡 اختصار: دوس مطوّلًا على زرار <b>+</b> الدهبي وقول جملتك على طول
            </p>
          )}
          {debtDraft && (
            <div className="rounded-xl px-3.5 py-3 mt-2 flex items-center gap-3" style={{ background: T.goldBg || T.paper, border: `1px solid ${T.gold}` }} aria-live="polite">
              <HandCoins size={18} style={{ color: T.goldDeep }} aria-hidden="true" />
              <div className="ui text-[12px] flex-1 min-w-0" style={{ color: T.text }}>
                Sounds like a loan — {debtDraft.direction === "lent" ? "you lent" : "you borrowed"}
                {debtDraft.person ? ` ${debtDraft.person}` : ""}{debtDraft.amount != null ? ` · ${debtDraft.amount} ${debtDraft.currency || ""}`.trimEnd() : ""}
              </div>
              <button onClick={() => onDebtDraft?.(debtDraft)} className="tap ui text-[12px] font-semibold rounded-lg px-3 py-2 shrink-0" style={{ background: T.gold, color: T.ink }}>
                Open loan form
              </button>
            </div>
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
          <span className="mono text-[44px] leading-none" style={{ color: +amount > 0 ? T.text : T.faint }}>{amount || "0"}</span>
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

        {type !== "transfer" && (
          <Field label="Whose is it?">
            <ChipRow value={owner} onChange={setOwner} options={OWNERS.map((o) => ({ value: o.id, label: o.label }))} />
          </Field>
        )}

        <Field label={type === "transfer" ? "From account" : "Account"}>
          <ChipRow
            value={accId}
            onChange={(v) => { setAccId(v); const na = accounts.find((a) => a.id === v); if (na) setCur(na.currency); }}
            options={accounts.map((a) => ({ value: a.id, label: `${a.name} · ${typeTag(a.type)} · ${a.currency}` }))}
          />
        </Field>
        {type === "transfer" && (
          <Field label="To account">
            <ChipRow value={toId} onChange={setToId} options={accounts.filter((a) => a.id !== accId).map((a) => ({ value: a.id, label: `${a.name} · ${typeTag(a.type)} · ${a.currency}` }))} />
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
              <span className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: accountStripe(a, 135), color: "#fff" }} aria-hidden="true"><Ico size={17} /></span>
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
        : { id: uid(), name: "", type: "bank", currency: "AED", openingDisplay: "", creditLimit: "", cardDigitsText: "", bank: "", network: "", dueDay: "", minPayment: "", color: ACCOUNT_COLORS[0], color2: "", archived: false }
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
        <>
          <Field label="Credit limit (optional)">
            <input type="number" inputMode="decimal" value={f.creditLimit} onChange={(e) => setF({ ...f, creditLimit: e.target.value })} placeholder="e.g. 50000" className={`${inputCls} mono`} style={inputStyle} />
          </Field>
          <Field label="Card network">
            <ChipRow value={f.network || ""} onChange={(v) => setF({ ...f, network: v })} options={[{ value: "visa", label: "Visa" }, { value: "mastercard", label: "Mastercard" }, { value: "", label: "Other" }]} />
          </Field>
          <Field label="Issuing bank (optional)">
            <input value={f.bank || ""} onChange={(e) => setF({ ...f, bank: e.target.value })} placeholder="e.g. Emirates NBD, CIB" className={inputCls} style={inputStyle} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment due day (1–31)">
              <input type="number" inputMode="numeric" min="1" max="31" value={f.dueDay || ""} onChange={(e) => setF({ ...f, dueDay: e.target.value })} placeholder="e.g. 5" className={`${inputCls} mono`} style={inputStyle} />
            </Field>
            <Field label="Min payment (optional)">
              <input type="number" inputMode="decimal" value={f.minPayment || ""} onChange={(e) => setF({ ...f, minPayment: e.target.value })} placeholder="e.g. 350" className={`${inputCls} mono`} style={inputStyle} />
            </Field>
          </div>
        </>
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
      <Field label="Second color (optional) · blends into a gradient">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setF({ ...f, color2: "" })} className="tap h-10 w-10 rounded-full flex items-center justify-center" style={{ background: T.paper, border: `1px solid ${T.line}`, color: T.faint }} aria-label="No second color" aria-pressed={!f.color2}>
            {!f.color2 ? <Check size={15} style={{ color: T.sub }} aria-hidden="true" /> : "—"}
          </button>
          {ACCOUNT_COLORS.map((c) => (
            <button key={c} onClick={() => setF({ ...f, color2: c })} className="tap h-10 w-10 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${f.color}, ${c})` }} aria-label={`Second color ${c}`} aria-pressed={f.color2 === c}>
              {f.color2 === c && <Check size={15} style={{ color: "#fff" }} aria-hidden="true" />}
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
          onSave({ ...rest, openingBalance, creditLimit: +f.creditLimit || 0, cardDigits, bank: (f.bank || "").trim(), network: f.network || "", dueDay: +f.dueDay || 0, minPayment: +f.minPayment || 0 });
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

/* ── Cards detail page (batch 2, design w/ Adham): every credit card with
   available-in-limit, signed owed, usage bar, due day and min payment. ── */
export function CardsSheet({ open, onClose, cards, balances, hide, base, rates }) {
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
    <Sheet open onClose={onClose} title="Cards" tall>
      <div className="flex gap-2 mb-4">
        <div className="flex-1 rounded-xl px-3.5 py-3" style={{ background: T.paper }}>
          <div className="ui text-[10px] mb-1" style={{ color: T.faint }}>Limit left · borrowing room</div>
          <div className="mono text-[17px]" style={{ color: T.sub }}>{hide ? "•••••" : `${Math.round(totAvail).toLocaleString("en-US")} ${base}`}</div>
        </div>
        <div className="flex-1 rounded-xl px-3.5 py-3" style={{ background: T.roseBg }}>
          <div className="ui text-[10px] mb-1" style={{ color: T.faint }}>Total owed</div>
          <div className="mono text-[17px]" style={{ color: totOwed > 0.005 ? T.rose : T.green }}>{hide ? "•••••" : `${totOwed > 0.005 ? "−" : ""}${Math.round(totOwed).toLocaleString("en-US")} ${base}`}</div>
        </div>
      </div>

      <p className="ui text-[11px] mb-4" style={{ color: T.faint }}>
        "Limit left" is how much the bank still lets you borrow — it is not money you own, and it never counts in your totals.
      </p>

      {rows.length === 0 && <p className="ui text-sm text-center py-8" style={{ color: T.sub }}>No credit cards yet — add one from Accounts.</p>}

      {rows.map(({ a, bal, owed, avail }) => {
        const bank = bankFor(a.bank || a.name);
        const usedPct = a.creditLimit ? Math.min(100, (owed / a.creditLimit) * 100) : 0;
        return (
          <div key={a.id} className="rounded-2xl p-4 mb-3 relative overflow-hidden" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
            <span aria-hidden="true" className="absolute inset-y-0 w-1" style={{ insetInlineStart: 0, background: accountStripe(a) }} />
            <div className="flex items-center gap-3 mb-3">
              <CardChip account={a} width={44} />
              <div className="min-w-0 flex-1">
                <div className="ui text-[15px] font-semibold truncate" style={{ color: T.text }}>{a.name}</div>
                <div className="mono text-[11px]" style={{ color: T.faint }}>
                  {a.cardDigits?.length ? `•••• ${a.cardDigits[0]}` : ""}{a.cardDigits?.length && (bank || a.bank) ? " · " : ""}{a.bank || bank?.label || ""}
                </div>
              </div>
              {a.dueDay > 0 && (
                <span className="ui text-[11px] font-semibold rounded-full px-2.5 py-1 shrink-0" style={{ background: owed > 0 ? T.amberBg : T.greenBg, color: owed > 0 ? T.amber : T.green }}>
                  {owed > 0 ? `Pay by ${humanDay(nextDueISO(a.dueDay))}` : "Nothing owed ✓"}
                </span>
              )}
            </div>
            <div className="flex gap-2.5 mb-3">
              <div className="flex-1 rounded-xl px-3 py-2.5" style={{ background: T.paper }}>
                <div className="ui text-[10px] mb-0.5" style={{ color: T.faint }}>Limit left</div>
                <div className="mono text-[17px]" style={{ color: T.sub }}>{avail != null ? fmtMoney(avail, a.currency, hide) : "—"}</div>
              </div>
              <div className="flex-1 rounded-xl px-3 py-2.5" style={{ background: T.paper }}>
                <div className="ui text-[10px] mb-0.5" style={{ color: T.faint }}>Owed</div>
                <div className="mono text-[17px]" style={{ color: owed > 0 ? T.rose : T.green }}>{hide ? "•••••" : owed > 0 ? `−${fmtMoney(owed, a.currency, false)}` : "0"}</div>
              </div>
            </div>
            {a.creditLimit > 0 && (
              <>
                <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: T.line }}>
                  <div className="h-full rounded-full" style={{ width: `${usedPct}%`, background: a.color, transition: "width .4s ease" }} />
                </div>
                <div className="flex justify-between ui text-[11px]" style={{ color: T.sub }}>
                  <span>used <b className="mono">{fmtMoney(owed, a.currency, hide)}</b> of <b className="mono">{fmtMoney(a.creditLimit, a.currency, hide)}</b></span>
                  {a.minPayment > 0 && owed > 0 && <span>min payment <b className="mono">{fmtMoney(a.minPayment, a.currency, hide)}</b></span>}
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
  if (!open || !f) return null;
  const sub = kind === "subscription";
  const ok = f.name.trim() && +f.amount > 0 && (sub || +f.monthsTotal > 0);
  return (
    <Sheet open onClose={onClose} title={initial ? (sub ? "Edit subscription" : "Edit installment") : (sub ? "New subscription" : "New installment")}>
      <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={sub ? "e.g. Netflix" : "e.g. Car loan"} className={inputCls} style={inputStyle} /></Field>
      <Field label="Whose is it?">
        <ChipRow value={f.owner} onChange={(v) => setF({ ...f, owner: v })} options={OWNERS.map((o) => ({ value: o.id, label: o.label }))} />
      </Field>
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
            {accounts.map((a) => <option key={a.id} value={a.id}>{`${a.name} · ${typeTag(a.type)}`}</option>)}
          </select>
        </Field>
      </div>
      <button
        onClick={() => ok && onSave({ id: initial?.id || uid(), kind, name: f.name.trim(), amount: +f.amount, currency: f.currency, cycle: sub ? f.cycle : "monthly", nextDue: f.nextDue, accountId: f.accountId, owner: f.owner || "me", paused: initial?.paused || false, toCancel: initial?.toCancel || false, ...(sub ? {} : { monthsTotal: +f.monthsTotal, monthsPaid: +f.monthsPaid || 0 }) })}
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
export function DebtSheet({ open, onClose, onSave, initial }) {
  const [f, setF] = useState(null);
  /* `initial` = prefill from a spoken loan phrase — user still reviews and Saves. */
  const init = React.useCallback(() => {
    setF({
      person: initial?.person || "",
      direction: initial?.direction === "borrowed" ? "borrowed" : "lent",
      amount: initial?.amount != null ? String(initial.amount) : "",
      currency: initial?.currency || "AED",
      note: initial?.note || "",
      date: todayISO(),
    });
  }, [initial]);
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

/* ── Edit a logged transaction (batch 9): fix the note, or move it to the
   right account. Amount/category stay put — delete + re-add for those. ── */
export function EditTxSheet({ open, onClose, tx, accounts, onSave }) {
  const [note, setNote] = useState("");
  const [accId, setAccId] = useState(null);
  const [cat, setCat] = useState(null);
  const init = React.useCallback(() => {
    setNote(tx?.note || "");
    setAccId(tx?.accountId || null);
    setCat(tx?.category || null);
  }, [tx]);
  useOpenTransition(open, init);
  if (!open || !tx) return null;
  const isTr = tx.type === "transfer";
  const movable = !isTr && tx.type !== "adjustment";
  const cats = tx.type === "income" ? INC_CATS : EXP_CATS.filter((c) => c.n !== "Adjustment");
  const save = () => {
    onSave({ ...tx, note: note.trim(), ...(movable && accId ? { accountId: accId } : {}), ...(movable && cat ? { category: cat } : {}) });
  };
  return (
    <Sheet open onClose={onClose} title="Edit transaction">
      {/* The header category is DIRECTLY editable — tap it, pick, done.
          (The chip row below stays in sync as a visual alternative.) */}
      <div className="rounded-xl px-3.5 py-3 mb-4 flex items-center justify-between" style={{ background: T.paper }}>
        <div className="ui text-[13px] flex items-center gap-1.5 min-w-0" style={{ color: T.text }}>
          {movable ? (
            <>
              {(() => {
                const def = cats.find((c) => c.n === (cat || tx.category));
                return def ? <def.I size={15} className="shrink-0" style={{ color: def.c }} aria-hidden="true" /> : null;
              })()}
              <select
                value={cat || tx.category}
                onChange={(e) => setCat(e.target.value)}
                className="ui text-[13px] font-semibold bg-transparent outline-none"
                style={{ color: T.text, WebkitAppearance: "none", appearance: "none", border: "none", padding: 0 }}
                aria-label="Category — tap to change"
              >
                {cats.map((c) => <option key={c.n} value={c.n}>{c.n}</option>)}
              </select>
              <ChevronDown size={13} className="shrink-0" style={{ color: T.goldDeep }} aria-hidden="true" />
            </>
          ) : (
            <span>{isTr ? "Transfer" : "Balance adjustment"}</span>
          )}
          <span className="ui text-[11px] shrink-0" style={{ color: T.faint }}>{tx.date}</span>
        </div>
        <Money n={isTr ? tx.sourceAmount : tx.amount} cur={isTr ? tx.sourceCurrency : tx.currency} hide={false} className="text-[15px]" />
      </div>
      <Field label="Note">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Carrefour weekly groceries" className={inputCls} style={inputStyle} />
      </Field>
      {movable && (
        <Field label="Category">
          <div className="overflow-x-auto no-scroll -mx-5 px-5">
            <div className="flex gap-2 w-max">
              {cats.map((c) => {
                const on = cat === c.n;
                return (
                  <button key={c.n} onClick={() => setCat(c.n)} aria-pressed={on} className="tap ui rounded-xl px-3.5 py-2.5 text-sm flex items-center gap-1.5 whitespace-nowrap" style={on ? { background: `${c.c}1A`, border: `1.5px solid ${c.c}`, color: T.text } : { background: T.paper, color: T.sub, border: `1px solid ${T.line}` }}>
                    <c.I size={14} style={{ color: c.c }} aria-hidden="true" />{c.n}
                  </button>
                );
              })}
            </div>
          </div>
        </Field>
      )}
      {movable && (
        <Field label="Paid from · move it if it's on the wrong account">
          <ChipRow
            value={accId}
            onChange={setAccId}
            options={accounts.map((a) => ({ value: a.id, label: `${a.name} · ${typeTag(a.type)}` }))}
          />
        </Field>
      )}
      {!movable && (
        <p className="ui text-[11px] mb-3" style={{ color: T.faint }}>
          {isTr ? "Transfers keep their two accounts — delete and re-add to change them." : "Adjustments stay on their account to keep reconciliation honest."}
        </p>
      )}
      <button onClick={save} className="tap ui w-full rounded-2xl py-3.5 text-[15px] font-semibold mt-2" style={{ background: T.ink, color: "#fff" }}>
        Save changes
      </button>
    </Sheet>
  );
}

/* ── SMS approval inbox (nothing posts without explicit approval) ── */
export function InboxSheet({ open, onClose, pending, accounts, onPasteImport, onManualImport, onApprove, onDismiss, onApproveAll }) {
  const [sel, setSel] = useState({});
  /* iOS PWAs often refuse programmatic clipboard reads — fall back to a
     plain text box, where the native long-press Paste always works. */
  const [manual, setManual] = useState(false);
  const [manualTxt, setManualTxt] = useState("");
  const init = React.useCallback(() => { setSel({}); setManual(false); setManualTxt(""); }, []);
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
    <Sheet open={open} onClose={onClose} title="Approval inbox" tall>
      <button
        onClick={async () => { const ok = await onPasteImport(); if (!ok) setManual(true); }}
        className="tap ui w-full rounded-xl py-3 text-sm font-medium mb-2 flex items-center justify-center gap-1.5"
        style={{ background: T.ink, color: "#fff" }}
      >
        <ClipboardPaste size={16} aria-hidden="true" />الصق رسائل البنك · Paste bank SMS
      </button>
      {manual && (
        <div className="rounded-xl px-3.5 py-3 mb-2" style={{ background: T.paper, border: `1px solid ${T.gold}` }}>
          <p className="ui text-[12px] mb-2" style={{ color: T.sub }}>
            iOS منع القراءة التلقائية — <b>دوس مطوّلًا جوه الصندوق واختار Paste</b> وهتتستورد لوحدها:
          </p>
          <textarea
            value={manualTxt}
            onChange={(e) => setManualTxt(e.target.value)}
            onPaste={(e) => { const t = e.clipboardData?.getData("text"); if (t) { e.preventDefault(); importManual(t); } }}
            rows={3}
            placeholder="الصق رسالة البنك هنا…"
            className="ui w-full rounded-lg px-3 py-2.5 text-[13px] outline-none"
            style={{ background: "#fff", border: `1px solid ${T.line}`, color: T.text }}
            aria-label="Paste bank SMS text manually"
          />
          {manualTxt.trim() && (
            <button onClick={() => importManual()} className="tap ui w-full rounded-lg py-2.5 text-[13px] font-medium mt-2" style={{ background: T.ink, color: "#fff" }}>
              استورد اللي فوق ✓
            </button>
          )}
        </div>
      )}
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
  open, onClose, settings, counts, onBase, onSaveRates, onFetchRates, onExportCsv, onExportBackup, onImportBackup, onResetRequest, backendName,
}) {
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
        <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 mb-3" style={{ background: T.greenBg }}>
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: T.green }} aria-hidden="true" />
          <span className="ui text-[12px] flex-1" style={{ color: T.text }}>
            Rates refresh automatically once a day.{settings.ratesUpdatedAt ? ` Last updated ${settings.ratesUpdatedAt}.` : ""}
          </span>
          <button
            onClick={() => {
              if (!onFetchRates || fx === "loading") return;
              setFx("loading");
              onFetchRates()
                .then((r) => { setDrafts(Object.fromEntries(CURRENCIES.map((c) => [c, String(r[c])]))); setFx("ok"); })
                .catch(() => setFx("err"));
            }}
            className="tap ui text-[12px] font-semibold rounded-lg px-3 py-1.5 shrink-0"
            style={{ background: T.ink, color: "#fff", opacity: fx === "loading" ? 0.6 : 1 }}
          >
            {fx === "loading" ? "Updating…" : "↻ Update now"}
          </button>
        </div>
        {fx === "ok" && <p role="status" className="ui text-[11px] mb-2" style={{ color: T.green }}>Rates updated ✓</p>}
        {fx === "err" && <p role="alert" className="ui text-[11px] mb-2" style={{ color: T.rose }}>Couldn't reach the rates service — using the last saved rates.</p>}
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
          Manual editing is a fallback for when you're offline. Past entries always keep their original rates.
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
