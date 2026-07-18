import React, { useState } from "react";
import { ArrowLeftRight, Trash2, Repeat, Layers, SlidersHorizontal } from "lucide-react";
import { T, catDef, fmtMoney, inputStyle } from "../../styles/tokens.js";
import { Money, Bar, CardBox, EmptyHint } from "./primitives.jsx";
import { daysUntilFromToday, humanDay } from "../../lib/dates/ui.js";

export function TxRow({ t, i, hide, accName, onDel, compact }) {
  const isIn = t.type === "income";
  const isTr = t.type === "transfer";
  const isAdj = t.type === "adjustment";
  const def = catDef(isAdj ? "Adjustment" : t.category);
  const amount = isTr ? t.sourceAmount : t.amount;
  const currency = isTr ? t.sourceCurrency : t.currency;
  return (
    <div className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${T.paper}` : "none" }}>
      <span
        className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: isIn ? T.greenBg : isTr || isAdj ? T.paper : `${def.c}1A`, color: isIn ? T.green : isTr || isAdj ? T.sub : def.c }}
        aria-hidden="true"
      >
        {isTr ? <ArrowLeftRight size={15} /> : isAdj ? <SlidersHorizontal size={15} /> : <def.I size={15} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="ui text-sm truncate" style={{ color: T.text }}>
          {isTr ? "Transfer" : isAdj ? "Balance adjustment" : t.category}
        </div>
        <div className="ui text-[11px] truncate" style={{ color: T.faint }}>
          {isTr ? `${accName(t.sourceAccountId)} → ${accName(t.destinationAccountId)}` : accName(t.accountId)}
          {t.note ? ` · ${t.note}` : ""}
        </div>
      </div>
      <span className="ui sr-only">{isIn || (isAdj && amount > 0) ? "money in" : "money out"}</span>
      <Money n={amount} cur={currency} hide={hide} color={isIn || (isAdj && amount > 0) ? T.green : T.text} className="text-sm" />
      {!compact && (
        <button onClick={() => onDel(t)} className="tap p-2 opacity-40 hover:opacity-100" style={{ color: T.rose }} aria-label={`Delete ${isTr ? "transfer" : t.category} of ${fmtMoney(amount, currency)}`}>
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

export function RecurrList({ kind, recurrs, hide, onPaid, onDel, dueTone }) {
  const list = recurrs.filter((r) => r.kind === kind);
  if (list.length === 0)
    return (
      <EmptyHint
        icon={kind === "subscription" ? <Repeat size={24} /> : <Layers size={24} />}
        text={
          kind === "subscription"
            ? "Recurring charges live here — streaming, iCloud, gym. Add each with its renewal date and Pocket Ledger will surface it before it hits."
            : "Installment plans live here — car, phone, furniture. Add the monthly amount and months paid, and the countdown takes care of itself."
        }
      />
    );
  return (
    <CardBox>
      {[...list].sort((a, b) => a.nextDue.localeCompare(b.nextDue)).map((r, i) => {
        const done = r.kind === "installment" && r.monthsPaid >= r.monthsTotal;
        const tone = dueTone(daysUntilFromToday(r.nextDue));
        return (
          <div key={r.id} className="px-4 py-3" style={{ borderTop: i ? `1px solid ${T.paper}` : "none", opacity: done ? 0.55 : 1 }}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="ui text-sm truncate" style={{ color: T.text }}>{r.name}</div>
                <div className="ui text-[11px]" style={{ color: done ? T.green : tone.c }}>
                  {done ? "Completed ✓" : `${tone.t} · ${humanDay(r.nextDue)}`}
                  {!done && r.kind === "subscription" ? ` · ${r.cycle}` : ""}
                </div>
              </div>
              <Money n={r.amount} cur={r.currency} hide={hide} className="text-sm" />
              {!done && (
                <button onClick={() => onPaid(r)} className="tap ui text-[11px] font-medium rounded-lg px-3 py-2" style={{ background: T.ink, color: "#fff" }}>
                  Paid
                </button>
              )}
              <button onClick={() => onDel(r)} className="tap p-2 opacity-40" style={{ color: T.rose }} aria-label={`Delete ${r.name}`}>
                <Trash2 size={14} />
              </button>
            </div>
            {r.kind === "installment" && (
              <div className="mt-2">
                <Bar pct={(r.monthsPaid / r.monthsTotal) * 100} color={done ? T.green : T.gold} />
                <div className="mono text-[10px] mt-1" style={{ color: T.faint }}>
                  {r.monthsPaid}/{r.monthsTotal} months · {fmtMoney(Math.max(0, (r.monthsTotal - r.monthsPaid) * r.amount), r.currency, hide)} left
                </div>
              </div>
            )}
          </div>
        );
      })}
    </CardBox>
  );
}

export function DebtCard({ x, hide, onPay, onDel }) {
  const [amt, setAmt] = useState("");
  const left = Math.max(0, x.amount - x.repaid);
  const lent = x.direction === "lent";
  return (
    <CardBox className="px-4 py-3.5 mb-3">
      <div className="flex items-start gap-3">
        <span className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 ui text-sm font-semibold" style={{ background: lent ? T.greenBg : T.roseBg, color: lent ? T.green : T.rose }} aria-hidden="true">
          {x.person.slice(0, 1).toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <div className="ui text-sm" style={{ color: T.text }}>{x.person}</div>
          <div className="ui text-[11px]" style={{ color: T.faint }}>{lent ? "owes you" : "you owe"} · {x.note || x.date}</div>
        </div>
        <div className="text-right">
          <Money n={left} cur={x.currency} hide={hide} color={left === 0 ? T.green : lent ? T.green : T.rose} className="text-base" />
          <div className="mono text-[10px]" style={{ color: T.faint }}>of {fmtMoney(x.amount, x.currency, hide)}</div>
        </div>
      </div>
      <div className="mt-2.5"><Bar pct={(x.repaid / x.amount) * 100} color={left === 0 ? T.green : T.gold} /></div>
      <div className="flex gap-2 mt-2.5">
        <input
          type="number" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)}
          placeholder="Repayment amount" className={`mono flex-1 rounded-lg px-3 py-2 text-sm outline-none`} style={inputStyle}
          aria-label={`Repayment amount for ${x.person}`}
        />
        <button
          onClick={() => { if (+amt > 0) { onPay(x.id, +amt); setAmt(""); } }}
          disabled={!(+amt > 0)}
          className="tap ui text-xs font-medium rounded-lg px-3"
          style={{ background: +amt > 0 ? T.ink : T.line, color: +amt > 0 ? "#fff" : T.faint }}
        >
          Record
        </button>
        <button onClick={() => onDel(x)} className="tap px-2 opacity-40" style={{ color: T.rose }} aria-label={`Delete loan with ${x.person}`}>
          <Trash2 size={15} />
        </button>
      </div>
    </CardBox>
  );
}
