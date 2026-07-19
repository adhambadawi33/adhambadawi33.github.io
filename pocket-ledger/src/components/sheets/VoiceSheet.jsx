import React, { useEffect, useRef, useState } from "react";
import { Mic, Keyboard, HandCoins, RotateCcw } from "lucide-react";
import { T, EXP_CATS, INC_CATS, OWNERS, fmtMoney } from "../../styles/tokens.js";
import { Sheet, Field, ChipRow } from "../common/primitives.jsx";
import { CURRENCIES } from "../../lib/finance/currency.js";
import { parseVoice } from "../../lib/voice/parse.js";
import { todayISO } from "../../lib/dates/localDate.js";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const typeTag = (t) => (t === "credit" ? "card" : t === "debit" ? "debit" : t === "cash" ? "cash" : "bank");

/* Voice-first entry (batch 8, from the approved voice mockup): long-press the
   gold + and just talk. Big mic listens immediately, the sentence becomes a
   confirmation card with tappable chips, and ONE tap saves. Wrong chip? Tap
   it. Wrong amount? Say it again or drop to the keyboard. Nothing is ever
   saved without the explicit confirm tap. */
export default function VoiceSheet({ open, onClose, accounts, settings, onSave, onDebtDraft, onTypeInstead }) {
  const [phase, setPhase] = useState("listening"); // listening | review | idle
  const [heard, setHeard] = useState("");
  const [err, setErr] = useState("");
  const [f, setF] = useState(null);
  const [debt, setDebt] = useState(null);
  const recRef = useRef(null);
  const gotRef = useRef(false);
  const wasOpen = useRef(false);

  const applyParse = (text) => {
    const p = parseVoice(text, accounts, settings);
    if (!p) {
      setPhase("idle");
      setErr("مسمعتش جملة واضحة — دوس المايك وجرّب تاني، أو اكتبها.");
      return;
    }
    if (p.type === "debt") {
      setDebt(p);
      setF(null);
      setPhase("review");
      return;
    }
    const acc = accounts.find((a) => a.id === p.accountId) || accounts.find((a) => a.id === settings.lastAccount) || accounts[0];
    setF({
      type: p.type === "income" ? "income" : "expense",
      amount: p.amount,
      currency: p.currency || acc?.currency || settings.base || "EGP",
      /* Unknown expenses go to "Other" — never silently to the first category. */
      category: p.category || (p.type === "income" ? "Other income" : "Other"),
      accountId: acc?.id || null,
      owner: p.owner || "me",
      note: p.note || text,
    });
    setDebt(null);
    setPhase("review");
  };

  const listen = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setPhase("idle");
      setErr("المتصفح ده مش بيدعم الإملاء — اكتبها بدل كده.");
      return;
    }
    try { recRef.current?.stop(); } catch { /* noop */ }
    const rec = new SR();
    rec.lang = "ar-EG";
    rec.interimResults = true;
    rec.continuous = false;
    gotRef.current = false;
    rec.onresult = (e) => {
      const txt = Array.from(e.results).map((r) => r[0].transcript).join(" ").trim();
      setHeard(txt);
      if (e.results[e.results.length - 1].isFinal && txt) {
        gotRef.current = true;
        applyParse(txt);
      }
    };
    rec.onend = () => {
      if (!gotRef.current) {
        setPhase("idle");
        setErr("مسمعتش حاجة — دوس المايك وجرّب تاني.");
      }
    };
    rec.onerror = (e) => {
      gotRef.current = true; // stop onend from double-reporting
      setPhase("idle");
      setErr(e.error === "not-allowed" || e.error === "service-not-allowed"
        ? "اسمح للمايكروفون من إعدادات المتصفح وجرّب تاني."
        : "الصوت وقف — دوس المايك وجرّب تاني.");
    };
    recRef.current = rec;
    setHeard("");
    setErr("");
    setPhase("listening");
    try { rec.start(); } catch { setPhase("idle"); setErr("مقدرتش أشغّل المايك — جرّب تاني."); }
  };

  /* Auto-listen on the closed->open transition; stop cleanly on close. */
  useEffect(() => {
    if (open && !wasOpen.current) {
      setF(null); setDebt(null); setHeard(""); setErr("");
      listen();
    }
    if (!open && wasOpen.current) {
      try { recRef.current?.stop(); } catch { /* noop */ }
    }
    wasOpen.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  const acc = f ? accounts.find((a) => a.id === f.accountId) : null;
  const ok = f && +f.amount > 0 && !!acc;
  const cats = f?.type === "income" ? INC_CATS : EXP_CATS.filter((c) => c.n !== "Adjustment");

  const save = () => {
    if (!ok) return;
    onSave({
      id: uid(), type: f.type, date: todayISO(), note: (f.note || "").trim(),
      snapshot: { ...settings.rates }, amount: +f.amount, currency: f.currency,
      accountId: acc.id, category: f.category, owner: f.owner,
    });
  };

  return (
    <Sheet open onClose={onClose} title="Say it" tall>
      {phase === "listening" && (
        <div className="flex flex-col items-center pt-10 pb-6">
          <button
            onClick={() => { try { recRef.current?.stop(); } catch { /* noop */ } }}
            className="tap pulse-mic h-28 w-28 rounded-full flex items-center justify-center"
            style={{ background: T.rose, color: "#fff" }}
            aria-label="Listening — tap to stop"
          >
            <Mic size={46} />
          </button>
          <p className="ui text-[15px] mt-6" style={{ color: T.text }}>سامعك… قول جملتك</p>
          <p className="ui text-[13px] mt-3 text-center px-6 min-h-[40px]" style={{ color: heard ? T.text : T.faint }} aria-live="polite">
            {heard || "مثال: «دفعت ٣٥٠ جنيه كارفور من CIB» أو «سلّفت أحمد ٥٠٠»"}
          </p>
          <button onClick={() => onTypeInstead(heard)} className="tap ui text-[12px] mt-6 flex items-center gap-1.5 rounded-xl px-4 py-2.5" style={{ border: `1px solid ${T.line}`, color: T.sub }}>
            <Keyboard size={14} aria-hidden="true" /> اكتبها بدل كده
          </button>
        </div>
      )}

      {phase === "idle" && (
        <div className="flex flex-col items-center pt-10 pb-6">
          <button onClick={listen} className="tap h-28 w-28 rounded-full flex items-center justify-center" style={{ background: T.ink, color: "#fff" }} aria-label="Start listening">
            <Mic size={46} />
          </button>
          <p className="ui text-[13px] mt-5 text-center px-6" style={{ color: T.sub }}>{err}</p>
          <button onClick={() => onTypeInstead(heard)} className="tap ui text-[12px] mt-5 flex items-center gap-1.5 rounded-xl px-4 py-2.5" style={{ border: `1px solid ${T.line}`, color: T.sub }}>
            <Keyboard size={14} aria-hidden="true" /> اكتبها بدل كده
          </button>
        </div>
      )}

      {phase === "review" && debt && (
        <div className="pt-2">
          <div className="rounded-2xl px-4 py-4 flex items-center gap-3" style={{ background: T.paper, border: `1px solid ${T.gold}` }}>
            <HandCoins size={22} style={{ color: T.goldDeep }} aria-hidden="true" />
            <div className="ui text-[15px] flex-1 min-w-0" style={{ color: T.text }}>
              ده دين — {debt.direction === "lent" ? "انت سلّفت" : "انت استلفت"}
              {debt.person ? ` ${debt.person}` : ""}{debt.amount != null ? ` · ${debt.amount} ${debt.currency || ""}`.trimEnd() : ""}
            </div>
          </div>
          <p className="ui text-[11px] mt-2 px-1" style={{ color: T.faint }}>«{heard}»</p>
          <button onClick={() => onDebtDraft(debt)} className="tap ui w-full rounded-2xl py-4 text-[15px] font-semibold mt-4" style={{ background: T.gold, color: T.ink }}>
            افتح نموذج الدين متعبّي ←
          </button>
          <div className="flex gap-2 mt-3">
            <button onClick={listen} className="tap ui flex-1 text-[12px] rounded-xl py-3 flex items-center justify-center gap-1.5" style={{ border: `1px solid ${T.line}`, color: T.sub }}>
              <RotateCcw size={13} aria-hidden="true" /> قول تاني
            </button>
            <button onClick={() => onTypeInstead(heard)} className="tap ui flex-1 text-[12px] rounded-xl py-3 flex items-center justify-center gap-1.5" style={{ border: `1px solid ${T.line}`, color: T.sub }}>
              <Keyboard size={13} aria-hidden="true" /> اكتبها
            </button>
          </div>
        </div>
      )}

      {phase === "review" && f && (
        <div className="pt-1">
          <div className="text-center mb-1" aria-live="polite">
            <span className="mono text-[44px] leading-none" style={{ color: +f.amount > 0 ? T.text : T.rose }}>
              {+f.amount > 0 ? (+f.amount).toLocaleString("en-US") : "؟"}
            </span>
            <span className="ui text-base ml-2" style={{ color: T.faint }}>{f.currency}</span>
          </div>
          {!(+f.amount > 0) && (
            <p className="ui text-[12px] text-center mb-2" style={{ color: T.rose }}>مفيش مبلغ — دوس «قول تاني» أو «اكتبها»</p>
          )}
          <p className="ui text-[11px] text-center mb-4" style={{ color: T.faint }}>«{heard}»</p>

          <div className="flex justify-center gap-1.5 mb-4">
            {CURRENCIES.map((c) => (
              <button key={c} onClick={() => setF({ ...f, currency: c })} aria-pressed={f.currency === c} className="tap mono rounded-full px-3.5 py-2 text-[12px]" style={f.currency === c ? { background: T.ink, color: "#fff" } : { background: T.paper, color: T.sub, border: `1px solid ${T.line}` }}>
                {c}
              </button>
            ))}
          </div>

          <Field label="ده إيه؟">
            <ChipRow
              value={f.type}
              onChange={(v) => setF({ ...f, type: v, category: v === "income" ? INC_CATS[0].n : (f.type === "income" ? EXP_CATS[0].n : f.category) })}
              options={[{ value: "expense", label: "مصروف" }, { value: "income", label: "دخل" }]}
            />
          </Field>
          <Field label="على إيه؟">
            <div className="overflow-x-auto no-scroll -mx-5 px-5">
              <div className="flex gap-2 w-max">
                {cats.map((c) => {
                  const on = f.category === c.n;
                  return (
                    <button key={c.n} onClick={() => setF({ ...f, category: c.n })} aria-pressed={on} className="tap ui rounded-xl px-3.5 py-2.5 text-sm flex items-center gap-1.5 whitespace-nowrap" style={on ? { background: `${c.c}1A`, border: `1.5px solid ${c.c}`, color: T.text } : { background: T.paper, color: T.sub, border: `1px solid ${T.line}` }}>
                      <c.I size={14} style={{ color: c.c }} aria-hidden="true" />{c.n}
                    </button>
                  );
                })}
              </div>
            </div>
          </Field>
          <Field label="بتاع مين؟">
            <ChipRow value={f.owner} onChange={(v) => setF({ ...f, owner: v })} options={OWNERS.map((o) => ({ value: o.id, label: o.label }))} />
          </Field>
          <Field label="من فين؟">
            <ChipRow
              value={f.accountId}
              onChange={(v) => { const na = accounts.find((a) => a.id === v); setF({ ...f, accountId: v, currency: na ? na.currency : f.currency }); }}
              options={accounts.map((a) => ({ value: a.id, label: `${a.name} · ${typeTag(a.type)}` }))}
            />
          </Field>

          {acc && f.currency !== acc.currency && +f.amount > 0 && (
            <p className="ui text-[11px] text-center mb-2" style={{ color: T.faint }}>
              هيتسجل ≈ {fmtMoney(+f.amount, f.currency, false)} على {acc.name}
            </p>
          )}

          <button onClick={save} disabled={!ok} className="tap ui w-full rounded-2xl py-4 text-[17px] font-semibold mt-2" style={{ background: ok ? T.gold : T.line, color: ok ? T.ink : T.faint }}>
            تمام، سجّلها ✓
          </button>
          <div className="flex gap-2 mt-3">
            <button onClick={listen} className="tap ui flex-1 text-[12px] rounded-xl py-3 flex items-center justify-center gap-1.5" style={{ border: `1px solid ${T.line}`, color: T.sub }}>
              <RotateCcw size={13} aria-hidden="true" /> قول تاني
            </button>
            <button onClick={() => onTypeInstead(heard)} className="tap ui flex-1 text-[12px] rounded-xl py-3 flex items-center justify-center gap-1.5" style={{ border: `1px solid ${T.line}`, color: T.sub }}>
              <Keyboard size={13} aria-hidden="true" /> اكتبها
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
