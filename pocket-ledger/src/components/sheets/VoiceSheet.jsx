import React, { useEffect, useRef, useState } from "react";
import { Mic, Keyboard, HandCoins, RotateCcw, Repeat, ChevronDown } from "lucide-react";
import { T, EXP_CATS, INC_CATS, OWNERS, fmtMoney } from "../../styles/tokens.js";
import { Sheet, Field, ChipRow } from "../common/primitives.jsx";
import { CURRENCIES } from "../../lib/finance/currency.js";
import { parseVoice } from "../../lib/voice/parse.js";
import { todayISO } from "../../lib/dates/localDate.js";
import { humanDay } from "../../lib/dates/ui.js";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const typeTag = (t) => (t === "credit" ? "card" : t === "debit" ? "debit" : t === "cash" ? "cash" : "bank");

const EXAMPLES = [
  "«دفعت ٣٥٠ جنيه كارفور من CIB»",
  "«بنزين ٢٠٠ جنيه امبارح»",
  "«سلّفت أحمد ٥٠٠»",
  "«قبضت المرتب ٨٠ ألف»",
  "«غدا ١٢٠ لعبير من يومين»",
];

/* Voice-first entry, redesigned (batch 14): live waveform while listening,
   the app SHOWS what it understood vs. what it defaulted (gold ✓ vs
   "افتراضي"), rarely-changed details fold into one line, and a sequential
   mode re-opens the mic after every save for end-of-day catch-ups.
   Nothing ever saves without the explicit confirm tap. */
export default function VoiceSheet({ open, onClose, accounts, settings, onSave, onDebtDraft, onTypeInstead }) {
  const [phase, setPhase] = useState("listening"); // listening | review | idle
  const [heard, setHeard] = useState("");
  const [err, setErr] = useState("");
  const [f, setF] = useState(null);
  const [debt, setDebt] = useState(null);
  const [seq, setSeq] = useState(false);
  const [hot, setHot] = useState(false);
  const [more, setMore] = useState(false);
  const [lastSaved, setLastSaved] = useState("");
  const [exIdx, setExIdx] = useState(0);
  const recRef = useRef(null);
  const gotRef = useRef(false);
  const hotTimer = useRef(null);
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
    const guessCat = p.category || (p.type === "income" ? "Other income" : "Other");
    setF({
      type: p.type === "income" ? "income" : "expense",
      amount: p.amount,
      currency: p.currency || acc?.currency || settings.base || "EGP",
      category: guessCat,
      guessCat,
      date: p.date || todayISO(),
      accountId: acc?.id || null,
      owner: p.owner || "me",
      note: p.note || text,
      /* what came FROM HIS WORDS vs. what we defaulted — drives the ✓ marks */
      det: {
        amount: p.amount != null, currency: !!p.currency, category: !!p.category,
        account: !!p.accountId, owner: !!p.owner, date: !!p.date,
      },
    });
    setDebt(null);
    setMore(false);
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
      /* the waveform "wakes up" whenever words are flowing in */
      setHot(true);
      clearTimeout(hotTimer.current);
      hotTimer.current = setTimeout(() => setHot(false), 700);
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
      gotRef.current = true;
      setPhase("idle");
      setErr(e.error === "not-allowed" || e.error === "service-not-allowed"
        ? "اسمح للمايكروفون من إعدادات المتصفح وجرّب تاني."
        : "الصوت وقف — دوس المايك وجرّب تاني.");
    };
    recRef.current = rec;
    setHeard("");
    setErr("");
    setF(null);
    setDebt(null);
    setPhase("listening");
    try { rec.start(); } catch { setPhase("idle"); setErr("مقدرتش أشغّل المايك — جرّب تاني."); }
  };

  useEffect(() => {
    if (open && !wasOpen.current) {
      setSeq(false);
      setLastSaved("");
      listen();
    }
    if (!open && wasOpen.current) {
      try { recRef.current?.stop(); } catch { /* noop */ }
    }
    wasOpen.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* rotate the example sentences while nothing has been said yet */
  useEffect(() => {
    if (!(open && phase === "listening" && !heard)) return;
    const t = setInterval(() => setExIdx((i) => i + 1), 2600);
    return () => clearInterval(t);
  }, [open, phase, heard]);

  if (!open) return null;
  const acc = f ? accounts.find((a) => a.id === f.accountId) : null;
  const ok = f && +f.amount > 0 && !!acc;
  const cats = f?.type === "income" ? INC_CATS : EXP_CATS.filter((c) => c.n !== "Adjustment");
  const today = todayISO();

  const save = () => {
    if (!ok) return;
    const correction = f.category !== f.guessCat ? { note: f.note, category: f.category } : null;
    onSave(
      {
        id: uid(), type: f.type, date: f.date || today, note: (f.note || "").trim(),
        snapshot: { ...settings.rates }, amount: +f.amount, currency: f.currency,
        accountId: acc.id, category: f.category, owner: f.owner,
      },
      correction,
      { keepOpen: seq }
    );
    if (seq) {
      setLastSaved(`${(+f.amount).toLocaleString("en-US")} ${f.currency} · ${f.category}`);
      listen();
    }
  };

  const Det = ({ on }) => on
    ? <span className="ui text-[10px] font-semibold" style={{ color: T.goldDeep }}>فهمتها من كلامك ✓</span>
    : <span className="ui text-[10px]" style={{ color: T.faint }}>مش متأكد — راجعها</span>;

  const SeqToggle = () => (
    <button
      onClick={() => setSeq(!seq)}
      aria-pressed={seq}
      className="tap ui text-[11px] flex items-center gap-1.5 rounded-full px-3 py-1.5"
      style={seq ? { background: T.greenBg, color: T.green, border: `1.5px solid ${T.green}` } : { background: T.paper, color: T.faint, border: `1px solid ${T.line}` }}
    >
      <Repeat size={12} aria-hidden="true" /> تسجيل متتابع{seq ? " ✓" : ""}
    </button>
  );

  return (
    <Sheet open onClose={onClose} title="Say it" tall>
      {phase === "listening" && (
        <div className="flex flex-col items-center pt-6 pb-6">
          {lastSaved && (
            <p className="fade-in ui text-[12px] mb-4 rounded-full px-3.5 py-1.5" style={{ background: T.greenBg, color: T.green }}>
              اتسجلت ✓ {lastSaved}
            </p>
          )}
          <div className={`flex items-center gap-[5px] h-10 mb-5 ${hot ? "wave-hot" : ""}`} aria-hidden="true">
            {Array.from({ length: 21 }, (_, i) => (
              <span key={i} className="wavebar h-full" style={{ background: T.gold, animationDelay: `${(i % 7) * 90}ms` }} />
            ))}
          </div>
          <button
            onClick={() => { try { recRef.current?.stop(); } catch { /* noop */ } }}
            className="tap pulse-mic h-28 w-28 rounded-full flex items-center justify-center"
            style={{ background: T.rose, color: "#fff", border: `3px solid ${hot ? T.gold : "transparent"}` }}
            aria-label="Listening — tap to stop"
          >
            <Mic size={46} />
          </button>
          <p className="ui text-[15px] mt-5" style={{ color: T.text }}>سامعك… قول جملتك</p>
          {heard ? (
            <p className="fade-in ui text-[19px] leading-relaxed mt-3 text-center px-5 min-h-[56px]" style={{ color: T.text }} aria-live="polite">
              {heard}
            </p>
          ) : (
            <p key={exIdx} className="fade-in ui text-[13px] mt-3 text-center px-6 min-h-[56px]" style={{ color: T.faint }}>
              {EXAMPLES[exIdx % EXAMPLES.length]}
            </p>
          )}
          <div className="flex items-center gap-2 mt-4">
            <SeqToggle />
            <button onClick={() => onTypeInstead(heard)} className="tap ui text-[11px] flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ border: `1px solid ${T.line}`, color: T.sub }}>
              <Keyboard size={12} aria-hidden="true" /> اكتبها
            </button>
          </div>
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
        <div className="pt-1 fade-in">
          <div className="text-center mb-1" aria-live="polite">
            <span className="mono text-[44px] leading-none" style={{ color: +f.amount > 0 ? T.text : T.rose }}>
              {+f.amount > 0 ? (+f.amount).toLocaleString("en-US") : "؟"}
            </span>
            <span className="ui text-base ml-2" style={{ color: T.faint }}>{f.currency}</span>
          </div>
          {!(+f.amount > 0) && (
            <p className="ui text-[12px] text-center mb-2" style={{ color: T.rose }}>مفيش مبلغ — دوس «قول تاني» أو «اكتبها»</p>
          )}
          <p className="ui text-[11px] text-center mb-1" style={{ color: T.faint }}>«{heard}»</p>
          {f.date && f.date !== today ? (
            <p className="ui text-[12px] text-center mb-3 font-medium" style={{ color: T.goldDeep }}>📅 {humanDay(f.date)} ✓</p>
          ) : (
            <div className="mb-3" />
          )}

          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="ui text-[11px] uppercase tracking-wider" style={{ color: T.faint }}>على إيه؟</span>
            <Det on={f.det.category} />
          </div>
          <div className="overflow-x-auto no-scroll -mx-5 px-5 mb-3.5">
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

          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="ui text-[11px] uppercase tracking-wider" style={{ color: T.faint }}>بتاع مين؟</span>
            <Det on={f.det.owner} />
          </div>
          <div className="mb-3.5">
            <ChipRow value={f.owner} onChange={(v) => setF({ ...f, owner: v })} options={OWNERS.map((o) => ({ value: o.id, label: o.label }))} />
          </div>

          {/* Rarely-changed details fold into one line: currency · account · date */}
          <button onClick={() => setMore(!more)} className="tap w-full rounded-xl px-3.5 py-3 mb-3 flex items-center justify-between gap-2" style={{ background: T.paper, border: `1px solid ${T.line}` }} aria-expanded={more}>
            <span className="ui text-[12px] truncate" style={{ color: T.sub }}>
              {f.currency}{f.det.currency ? " ✓" : ""} · {acc ? acc.name : "اختار حساب"}{acc ? (f.det.account ? " ✓" : " (افتراضي)") : ""}
            </span>
            <ChevronDown size={14} className="shrink-0" style={{ color: T.faint, transform: more ? "rotate(180deg)" : "none", transition: "transform .15s" }} aria-hidden="true" />
          </button>
          {more && (
            <div className="fade-in">
              <Field label="العملة">
                <div className="flex gap-1.5 flex-wrap">
                  {CURRENCIES.map((c) => (
                    <button key={c} onClick={() => setF({ ...f, currency: c })} aria-pressed={f.currency === c} className="tap mono rounded-full px-3.5 py-2 text-[12px]" style={f.currency === c ? { background: T.ink, color: "#fff" } : { background: T.paper, color: T.sub, border: `1px solid ${T.line}` }}>
                      {c}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="من فين؟">
                <ChipRow
                  value={f.accountId}
                  onChange={(v) => { const na = accounts.find((a) => a.id === v); setF({ ...f, accountId: v, currency: na ? na.currency : f.currency, det: { ...f.det, account: true } }); }}
                  options={accounts.map((a) => ({ value: a.id, label: `${a.name} · ${typeTag(a.type)}` }))}
                />
              </Field>
            </div>
          )}

          {acc && f.currency !== acc.currency && +f.amount > 0 && (
            <p className="ui text-[11px] text-center mb-2" style={{ color: T.faint }}>
              هيتسجل ≈ {fmtMoney(+f.amount, f.currency, false)} على {acc.name}
            </p>
          )}

          <button onClick={save} disabled={!ok} className="tap ui w-full rounded-2xl py-4 text-[17px] font-semibold mt-1" style={{ background: ok ? T.gold : T.line, color: ok ? T.ink : T.faint }}>
            {seq ? "سجّلها وكمّل 🎙️" : "تمام، سجّلها ✓"}
          </button>
          <div className="flex items-center gap-2 mt-3">
            <button onClick={listen} className="tap ui flex-1 text-[12px] rounded-xl py-3 flex items-center justify-center gap-1.5" style={{ border: `1px solid ${T.line}`, color: T.sub }}>
              <RotateCcw size={13} aria-hidden="true" /> قول تاني
            </button>
            <button onClick={() => onTypeInstead(heard)} className="tap ui flex-1 text-[12px] rounded-xl py-3 flex items-center justify-center gap-1.5" style={{ border: `1px solid ${T.line}`, color: T.sub }}>
              <Keyboard size={13} aria-hidden="true" /> اكتبها
            </button>
            <SeqToggle />
          </div>
        </div>
      )}
    </Sheet>
  );
}
