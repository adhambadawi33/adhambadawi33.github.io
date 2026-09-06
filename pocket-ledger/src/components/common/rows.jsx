import React, { useState } from "react";
import { ArrowLeftRight, Trash2, Repeat, Layers, SlidersHorizontal, Ban, MoreHorizontal, Gift, ChevronRight } from "lucide-react";
import { SubLogo } from "./brand.jsx";
import { T, catDef, ownerDef, fmtMoney, inputStyle, curLabel } from "../../styles/tokens.js";
import { convert } from "../../lib/finance/currency.js";
import { Money, Bar, CardBox, EmptyHint, PaidBtn } from "./primitives.jsx";
import { daysUntilFromToday, humanDay, monthYear } from "../../lib/dates/ui.js";
import { addMonthsClamped } from "../../lib/dates/localDate.js";
import { useT, catLabel, ownerLabel } from "../../i18n/index.js";

/* Owner tag — shown only for non-default owners to keep "mine" rows quiet. */
export function OwnerPill({ id, size = "text-[10px]" }) {
  if (!id || id === "me") return null;
  const o = ownerDef(id);
  return <span className={`ui ${size} font-semibold rounded-lg px-1.5 py-0.5 shrink-0`} style={{ background: o.bg, color: o.c }}>{ownerLabel(o.id)}</span>;
}

export function TxRow({ t, i, hide, accName, onDel, onEdit, compact }) {
  const tr = useT();
  const isIn = t.type === "income";
  const isTr = t.type === "transfer";
  const isAdj = t.type === "adjustment";
  const def = catDef(isAdj ? "Adjustment" : t.category);
  const amount = isTr ? t.sourceAmount : t.amount;
  const currency = isTr ? t.sourceCurrency : t.currency;
  /* With onEdit, the row body becomes a button: tap to edit note / move account. */
  const Body = onEdit ? "button" : "div";
  return (
    <div className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${T.paper}` : "none" }}>
      <Body
        {...(onEdit ? { onClick: () => onEdit(t), "aria-label": tr("rows.editTx", { what: isTr ? tr("rows.transfer") : catLabel(t.category), amt: amount }) } : {})}
        className={`flex items-center gap-3 flex-1 min-w-0 text-left ${onEdit ? "tap" : ""}`}
      >
      <span
        className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: isIn ? T.greenBg : isTr || isAdj ? T.paper : `${def.c}1A`, color: isIn ? T.green : isTr || isAdj ? T.sub : def.c }}
        aria-hidden="true"
      >
        {isTr ? <ArrowLeftRight size={15} /> : isAdj ? <SlidersHorizontal size={15} /> : <def.I size={15} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="ui text-sm truncate flex items-center gap-1.5" style={{ color: T.text }}>
          <span className="truncate">{isTr ? tr("rows.transfer") : isAdj ? tr("rows.adjustment") : catLabel(t.category)}</span>
          <OwnerPill id={t.owner} />
          {t.tripId && (
            <span className="ui text-[9px] shrink-0 rounded px-1 py-px" style={{ background: t.tripKind === "work" ? "#B08D5722" : "#4E7A9B22", color: t.tripKind === "work" ? T.goldDeep : "#4E7A9B" }} title="Trip spend">
              🧳 {t.tripKind === "work" ? tr("rows.work") : tr("rows.trip")}
            </span>
          )}
        </div>
        <div className="ui text-[11px] truncate" style={{ color: T.sub }}>
          {isTr ? `${accName(t.sourceAccountId)} → ${accName(t.destinationAccountId)}` : accName(t.accountId)}
          {t.note ? ` · ${t.note}` : ""}
        </div>
      </div>
      <span className="ui sr-only">{isIn || (isAdj && amount > 0) ? tr("rows.moneyIn") : tr("rows.moneyOut")}</span>
      <Money n={amount} cur={currency} hide={hide} color={isIn || (isAdj && amount > 0) ? T.green : T.text} className="text-sm" />
      </Body>
      {!compact && (
        <button onClick={() => onDel(t)} className="tap p-3.5 -m-2 opacity-40 hover:opacity-100" style={{ color: T.rose }} aria-label={tr("rows.deleteTx", { what: isTr ? tr("rows.transfer") : catLabel(t.category), amt: fmtMoney(amount, currency) })}>
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

export function RecurrList({ kind, recurrs, hide, onPaid, onDel, onToggleCancel, dueTone, accName, onEdit }) {
  const t = useT();
  /* Ban/Delete live behind a per-row "…" toggle so the name and due date
     keep their width on narrow phones. */
  const [moreId, setMoreId] = useState(null);
  const list = recurrs.filter((r) => r.kind === kind);
  if (list.length === 0)
    return (
      <EmptyHint
        icon={kind === "subscription" ? <Repeat size={24} /> : <Layers size={24} />}
        text={kind === "subscription" ? t("rows.emptySubs") : t("rows.emptyInst")}
      />
    );
  return (
    <CardBox>
      {[...list].sort((a, b) => a.nextDue.localeCompare(b.nextDue)).map((r, i) => {
        const done = r.kind === "installment" && r.monthsPaid >= r.monthsTotal;
        const tone = dueTone(daysUntilFromToday(r.nextDue));
        return (
          <div key={r.id} className="px-4 py-3" style={{ borderTop: i ? `1px solid ${T.paper}` : "none", opacity: done ? 0.55 : 1 }}>
            <div className="flex items-start gap-3">
              {/* Tap the row body to edit — move it to another card, fix the
                  amount or date (batch 12). */}
              <button
                onClick={() => onEdit?.(r)}
                disabled={!onEdit}
                aria-label={onEdit ? t("rows.editRow", { name: r.name }) : undefined}
                className={`flex items-start gap-3 flex-1 min-w-0 text-left ${onEdit ? "tap" : ""}`}
              >
              <SubLogo name={r.name} size={36} tintBg={tone.bg} tintColor={tone.c} />
              <div className="min-w-0 flex-1">
                <div className="ui text-sm truncate flex items-center gap-1.5" style={{ color: T.text }}>
                  <span className="truncate">{r.name}</span>
                  <OwnerPill id={r.owner} />
                </div>
                <div className="ui text-[11px] truncate" style={{ color: done ? T.green : tone.c }}>
                  {done ? t("rows.completed") : `${tone.t} · ${humanDay(r.nextDue)}`}
                  {!done && r.kind === "subscription" ? ` · ${t(`sheets.recurr.${r.cycle}`)}` : ""}
                </div>
                {accName && r.accountId && (
                  <div className="ui text-[10px] mt-0.5 truncate" style={{ color: T.sub }}>{t("common.from", { name: accName(r.accountId) })}</div>
                )}
              </div>
              </button>
              <div className="shrink-0 flex flex-col items-end gap-1.5">
                <Money n={r.amount} cur={r.currency} hide={hide} className="text-sm" />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setMoreId(moreId === r.id ? null : r.id)}
                    className="tap p-3.5 -m-2 opacity-50" style={{ color: T.sub }}
                    aria-label={t("rows.moreActions", { name: r.name })} aria-expanded={moreId === r.id}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  {!done && (
                    <PaidBtn onClick={() => onPaid(r)} />
                  )}
                </div>
              </div>
            </div>
            {moreId === r.id && (
              <div className="flex items-center justify-end gap-2 mt-1.5" style={{ paddingInlineStart: 46 }}>
                {kind === "subscription" && onToggleCancel && !done && (
                  <button onClick={() => { onToggleCancel(r); setMoreId(null); }} className="tap ui text-[12px] rounded-lg px-3 py-2 flex items-center gap-1.5" style={{ background: T.roseBg, color: T.rose }}>
                    <Ban size={12} aria-hidden="true" /> {t("rows.needsCancelling")}
                  </button>
                )}
                <button onClick={() => { onDel(r); setMoreId(null); }} className="tap ui text-[12px] rounded-lg px-3 py-2 flex items-center gap-1.5" style={{ background: T.roseBg, color: T.rose }} aria-label={t("rows.deleteRow", { name: r.name })}>
                  <Trash2 size={12} aria-hidden="true" /> {t("actions.delete")}
                </button>
              </div>
            )}
            {r.kind === "installment" && (
              <div className="mt-2">
                <Bar pct={(r.monthsPaid / r.monthsTotal) * 100} color={done ? T.green : T.gold} />
                <div className="mono text-[10px] mt-1" style={{ color: T.sub }}>
                  {t("rows.monthsLeft", { paid: r.monthsPaid, total: r.monthsTotal, left: fmtMoney(Math.max(0, (r.monthsTotal - r.monthsPaid) * r.amount), r.currency, hide) })}
                  {!done && t("rows.ends", { date: monthYear(addMonthsClamped(r.nextDue, r.monthsTotal - r.monthsPaid - 1)) })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </CardBox>
  );
}

/* One "given away" row: help or gift, money handed over (a People entry) or
   a thing bought (an expense). Same shape either way; the tag says which. */
export function GivenRow({ g, hide, onDel, base, rates, first }) {
  const t = useT();
  const eq = base && rates && g.currency !== base ? convert(g.amount, g.currency, base, rates) : null;
  const isGift = g.kind === "gift";
  return (
    <div className="flex items-center gap-3 px-4 py-3 min-h-[60px]" style={{ borderTop: first ? "none" : `1px solid ${T.paper}` }}>
      <span className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 ui text-sm font-semibold" style={{ background: T.amberBg, color: T.goldDeep }} aria-hidden="true">
        {isGift ? <Gift size={16} /> : g.who.slice(0, 1).toUpperCase()}
      </span>
      <div className="flex-1 min-w-0">
        <div className="ui text-sm leading-snug flex items-start gap-1.5" style={{ color: T.text }}>
          <span>{g.who || g.what || humanDay(g.date)}</span>
          <span className="ui text-[10px] font-semibold rounded-lg px-1.5 py-0.5 shrink-0" style={{ background: T.amberBg, color: T.goldDeep }}>{isGift ? t("people.gift") : t("people.help")}</span>
        </div>
        <div className="ui text-[12px] truncate" style={{ color: T.sub }}>
          {g.who && g.what ? `${g.what} · ` : ""}{g.source === "transaction" ? `${t("people.bought")} · ` : ""}{humanDay(g.date)}
        </div>
      </div>
      <div className="text-right">
        <Money n={g.amount} cur={g.currency} hide={hide} className="text-sm" />
        {eq != null && <div className="mono text-[10px]" style={{ color: T.sub }}>≈ {hide ? "•••••" : `${Math.round(eq).toLocaleString("en-US")} ${curLabel(base)}`}</div>}
      </div>
      {onDel && g.source === "debt" && (
        <button onClick={() => onDel(g.ref)} className="tap p-4 -m-2.5 opacity-40" style={{ color: T.rose }} aria-label={t("people.deleteGiven", { name: g.who })}>
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

/* Kept for callers/tests that still import the old cards. */
export const GivenCard = ({ x, hide, onDel, base, rates }) => (
  <CardBox><GivenRow g={{ id: x.id, source: "debt", kind: "help", who: x.person, what: x.note, amount: x.amount, currency: x.currency, date: x.date, ref: x }} hide={hide} onDel={onDel} base={base} rates={rates} first /></CardBox>
);
export const GiftCard = ({ g, hide, base, rates }) => <CardBox><GivenRow g={{ ...g, kind: "gift" }} hide={hide} base={base} rates={rates} first /></CardBox>;

/* Loan card: name, what's left, progress. The repayment form stays folded
   behind "Record a repayment" so a list of loans reads as a list, not as a
   stack of open forms. Delete lives in the same fold. */
export function DebtCard({ x, hide, onPay, onDel, base, rates }) {
  const t = useT();
  const [amt, setAmt] = useState("");
  const [open, setOpen] = useState(false);
  const left = Math.max(0, x.amount - x.repaid);
  const lent = x.direction === "lent";
  /* Native currency is the source of truth; base is a small ≈ line only. */
  const eq = base && rates && x.currency !== base && left > 0 ? convert(left, x.currency, base, rates) : null;
  const settled = left === 0;
  return (
    <CardBox className="px-4 py-3.5 mb-3">
      <div className="flex items-center gap-3">
        <span className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 ui text-sm font-semibold" style={{ background: lent ? T.greenBg : T.roseBg, color: lent ? T.green : T.rose }} aria-hidden="true">
          {x.person.slice(0, 1).toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <div className="ui text-sm truncate" style={{ color: T.text }}>{x.person}</div>
          <div className="ui text-[12px] truncate" style={{ color: T.sub }}>{settled ? t("people.settled") : lent ? t("people.owesYou") : t("people.youOweShort")} · {x.note || humanDay(x.date)}</div>
        </div>
        <div className="text-right shrink-0">
          <Money n={left} cur={x.currency} hide={hide} color={settled ? T.green : lent ? T.green : T.rose} className="text-base" />
          <div className="mono text-[11px] whitespace-nowrap" style={{ color: T.sub }}>
            {eq != null ? `≈ ${hide ? "•••••" : `${Math.round(eq).toLocaleString("en-US")} ${curLabel(base)}`}` : `${t("common.of")} ${fmtMoney(x.amount, x.currency, hide)}`}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2.5">
        <div className="flex-1"><Bar pct={(x.repaid / x.amount) * 100} color={settled ? T.green : T.gold} /></div>
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="tap ui text-[12px] flex items-center gap-0.5 min-h-[44px] -my-3 shrink-0" style={{ color: T.goldDeep }}>
          {open ? t("actions.close") : settled ? t("actions.details") : t("people.recordRepayment")}<ChevronRight size={13} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div className="flex gap-2 mt-2.5">
          <input
            type="number" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} autoFocus
            placeholder={t("people.amountIn", { cur: x.currency })} className="mono flex-1 rounded-lg px-3 min-h-[44px] text-sm outline-none" style={inputStyle}
            aria-label={t("people.repayAria", { name: x.person })}
          />
          <button
            onClick={() => { if (+amt > 0) { onPay(x.id, +amt); setAmt(""); setOpen(false); } }}
            disabled={!(+amt > 0)}
            className="tap ui text-xs font-medium rounded-lg px-3 min-h-[44px]"
            style={{ background: +amt > 0 ? T.ink : T.line, color: +amt > 0 ? "#fff" : T.sub }}
          >
            {t("actions.record")}
          </button>
          <button onClick={() => onDel(x)} className="tap px-3 min-h-[44px] opacity-50" style={{ color: T.rose }} aria-label={t("people.deleteLoan", { name: x.person })}>
            <Trash2 size={15} />
          </button>
        </div>
      )}
    </CardBox>
  );
}
