import React, { useState } from "react";
import { Plus, Check, Landmark, ChevronDown, Trash2 } from "lucide-react";
import { T, EXP_CATS, OWNERS, inputStyle } from "../../styles/tokens.js";
import { convert } from "../../lib/finance/currency.js";
import { planStats } from "../../lib/finance/plans.js";
import { Section, CardBox, Bar, Money, ChipRow } from "../common/primitives.jsx";
import { RecurrList, OwnerPill } from "../common/rows.jsx";
import { SubLogo } from "../common/brand.jsx";
import { fmtMoney } from "../../styles/tokens.js";
import { daysUntilFromToday, humanDay, monthYear } from "../../lib/dates/ui.js";

const AddMini = ({ onClick, label }) => (
  <button onClick={onClick} className="tap ui text-xs flex items-center gap-1 rounded-lg px-2.5 py-2" style={{ background: T.ink, color: "#fff" }}>
    <Plus size={13} aria-hidden="true" />{label || "Add"}
  </button>
);

/* Normalize any billing cycle to a monthly figure for the bleed total. */
const monthlyOf = (r) => (r.cycle === "yearly" ? r.amount / 12 : r.cycle === "weekly" ? r.amount * 4.33 : r.amount);

/* The subscription "bleed monitor" (Adham's biggest pain): one glance =
   what leaks monthly, what that means per year, and whose it is. */
function BleedSummary({ recurrs, base, rates, hide }) {
  const subs = recurrs.filter((r) => r.kind === "subscription" && !r.paused);
  if (!subs.length) return null;
  let total = 0;
  const byOwner = { me: 0, abeer: 0, kids: 0 };
  for (const r of subs) {
    const v = convert(monthlyOf(r), r.currency, base, rates);
    total += v;
    byOwner[r.owner || "me"] += v;
  }
  const f = (n) => (hide ? "•••••" : Math.round(n).toLocaleString("en-US"));
  return (
    <CardBox className="px-4 py-3.5 mb-3">
      <div className="flex items-baseline justify-between mb-1">
        <span className="mono text-[22px]" style={{ color: T.text }}>≈ {f(total)} <span className="ui text-[12px]" style={{ color: T.faint }}>{base} / month</span></span>
        <span className="ui text-[11px]" style={{ color: T.sub }}>= <b className="mono">{f(total * 12)}</b> a year</span>
      </div>
      <div className="flex gap-2 mt-2.5">
        {OWNERS.filter((o) => byOwner[o.id] > 0.005).map((o) => (
          <span key={o.id} className="ui text-[11px] font-medium rounded-lg px-2.5 py-1.5 flex-1 text-center" style={{ background: o.bg, color: o.c }}>
            {o.label} · <b className="mono">{f(byOwner[o.id])}</b>
          </span>
        ))}
      </div>
    </CardBox>
  );
}

/* "Needs cancelling" watchlist: flagged subs stay loudly in sight until the
   user actually cancels them at the service and confirms here. */
function CancelWatchlist({ flagged, base, rates, hide, onDone, onKeep }) {
  if (!flagged.length) return null;
  const saving = flagged.reduce((s, r) => s + convert(monthlyOf(r), r.currency, base, rates), 0);
  const f = (n) => (hide ? "•••••" : Math.round(n).toLocaleString("en-US"));
  return (
    <Section title="Needs cancelling">
      <div className="rounded-2xl px-4 py-3.5 mb-3" style={{ background: T.roseBg, border: "1px solid rgba(178,114,79,.25)" }}>
        {flagged.map((r, i) => (
          <div key={r.id} className="py-3" style={{ borderTop: i ? "1px solid rgba(178,114,79,.15)" : "none" }}>
            <div className="flex items-center gap-3">
              <SubLogo name={r.name} size={36} />
              <div className="min-w-0 flex-1">
                <div className="ui text-sm truncate flex items-center gap-1.5" style={{ color: T.text }}>
                  <span className="truncate">{r.name}</span>
                  <OwnerPill id={r.owner} />
                </div>
                <div className="ui text-[11px]" style={{ color: T.rose }}>cancel at the service first</div>
              </div>
              <Money n={r.amount} cur={r.currency} hide={hide} className="text-[13px]" />
            </div>
            <div className="flex items-center gap-2 mt-2" style={{ paddingInlineStart: 44 }}>
              <button onClick={() => onDone(r)} className="tap ui text-[12px] font-semibold rounded-lg px-3 py-2 flex items-center gap-1" style={{ background: T.green, color: "#fff" }}>
                <Check size={12} aria-hidden="true" /> Cancelled — remove it
              </button>
              <button onClick={() => onKeep(r)} className="tap ui text-[12px] rounded-lg px-3 py-2" style={{ color: T.sub, border: `1px solid ${T.line}`, background: "#fff" }} aria-label={`Keep ${r.name}`}>
                Keep it
              </button>
            </div>
          </div>
        ))}
        <p className="ui text-[11px] mt-2 pt-2" style={{ color: T.rose, borderTop: "1px solid rgba(178,114,79,.15)" }}>
          Stopping these saves ≈ <b className="mono">{f(saving)}</b> {base}/month = <b className="mono">{f(saving * 12)}</b> a year.
        </p>
      </div>
    </Section>
  );
}

/* Payment plan (batch 7): one card = the whole contract. Next payment on
   top (that's the actionable bit), overall progress under it, and the full
   schedule folded away — surface, don't dig. */
function PlanCard({ p, hide, accName, dueTone, onPayNext, onDel }) {
  const [open, setOpen] = useState(false);
  const s = planStats(p);
  const tone = s.next ? dueTone(daysUntilFromToday(s.next.due)) : null;
  const pct = s.totalSum > 0 ? (s.paidSum / s.totalSum) * 100 : 0;
  return (
    <CardBox className="px-4 py-3.5 mb-3">
      <div className="flex items-center gap-3">
        <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: T.goldBg || "#B08D5722", color: T.goldDeep }} aria-hidden="true">
          <Landmark size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="ui text-sm truncate flex items-center gap-1.5" style={{ color: T.text }}>
            <span className="truncate">{p.name}</span>
            <OwnerPill id={p.owner} />
          </div>
          {accName && p.accountId && (
            <div className="ui text-[10px] mt-0.5 truncate" style={{ color: T.faint }}>from {accName(p.accountId)}</div>
          )}
        </div>
        <button onClick={() => onDel(p)} className="tap p-2 opacity-40" style={{ color: T.rose }} aria-label={`Delete ${p.name}`}>
          <Trash2 size={14} />
        </button>
      </div>

      {s.next ? (
        <div className="flex items-center gap-3 mt-3 rounded-xl px-3.5 py-3" style={{ background: T.paper }}>
          <div className="min-w-0 flex-1">
            <div className="ui text-[11px]" style={{ color: T.faint }}>Next payment · {s.paidCount + 1} of {s.count}</div>
            <Money n={s.next.amount} cur={p.currency} hide={hide} className="text-[17px]" />
            <div className="ui text-[11px] mt-0.5" style={{ color: tone.c }}>{tone.t} · {humanDay(s.next.due)}</div>
          </div>
          <button onClick={() => onPayNext(p.id, s.next.id)} className="tap ui text-[11px] font-medium rounded-lg px-3 py-2 shrink-0" style={{ background: T.ink, color: "#fff" }}>
            Paid
          </button>
        </div>
      ) : (
        <div className="ui text-[12px] mt-3 flex items-center gap-1.5" style={{ color: T.green }}>
          <Check size={14} aria-hidden="true" /> Fully paid ✓
        </div>
      )}

      <div className="mt-3"><Bar pct={pct} color={s.done ? T.green : T.gold} /></div>
      <div className="mono text-[10px] mt-1" style={{ color: T.faint }}>
        {fmtMoney(Math.round(s.paidSum), p.currency, hide)} of {fmtMoney(Math.round(s.totalSum), p.currency, hide)} paid · {Math.round(pct)}%
        {!s.done && ` · ends ${monthYear(s.endDue)}`}
      </div>

      <button onClick={() => setOpen(!open)} className="tap ui text-xs flex items-center gap-1 mt-2.5" style={{ color: T.sub }} aria-expanded={open}>
        <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
        {open ? "Hide schedule" : `Show all ${s.count} payments`}
      </button>
      {open && (
        <div className="mt-2 rounded-xl px-3.5 py-1" style={{ background: T.paper }}>
          {p.milestones.map((m) => {
            const isNext = s.next && m.id === s.next.id;
            return (
              <div key={m.id} className="flex items-center gap-2 py-1.5" style={{ borderBottom: `1px solid ${T.line}22` }}>
                <span className="ui text-[10px] w-10 shrink-0" style={{ color: m.paid ? T.green : isNext ? T.goldDeep : T.faint }}>
                  {m.paid ? "✓" : isNext ? "next" : ""} {m.label}
                </span>
                <span className="mono text-[10px] flex-1" style={{ color: m.paid ? T.faint : T.sub }}>{m.due}</span>
                <span className="mono text-[11px]" style={{ color: m.paid ? T.faint : T.text, textDecoration: m.paid ? "line-through" : "none" }}>
                  {fmtMoney(m.amount, p.currency, hide)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </CardBox>
  );
}

export default function PlannedScreen({ recurrs, plans = [], budgets, monthByCat, base, rates, hide, accName, onAddRecurr, onEditRecurr, onPaid, onDelRecurr, onToggleCancel, dueTone, setBudget, onPayMilestone, onDelPlan }) {
  /* "Which subscriptions sit on which card?" (Adham) — one tap filters the
     list AND the bleed summary to a single account. */
  const [subAcc, setSubAcc] = useState("all");
  const flagged = recurrs.filter((r) => r.kind === "subscription" && r.toCancel && !r.paused);
  const active = recurrs.filter((r) => !r.toCancel);
  const subAccIds = [...new Set(active.filter((r) => r.kind === "subscription").map((r) => r.accountId || "none"))];
  const accFilterOptions = [
    { value: "all", label: "All" },
    ...subAccIds.filter((id) => id !== "none").map((id) => ({ value: id, label: accName(id) })),
    ...(subAccIds.includes("none") ? [{ value: "none", label: "No card" }] : []),
  ];
  const bySubAcc = (r) => subAcc === "all" || (r.accountId || "none") === subAcc;
  const filteredSubs = active.filter((r) => r.kind !== "subscription" || bySubAcc(r));
  return (
    <>
      <CancelWatchlist flagged={flagged} base={base} rates={rates} hide={hide} onDone={onDelRecurr} onKeep={onToggleCancel} />
      {plans.length > 0 && (
        <Section title="Payment plans">
          {plans.map((p) => (
            <PlanCard key={p.id} p={p} hide={hide} accName={accName} dueTone={dueTone} onPayNext={onPayMilestone} onDel={onDelPlan} />
          ))}
        </Section>
      )}
      <Section title="Subscriptions" right={<AddMini onClick={() => onAddRecurr("subscription")} />}>
        {accFilterOptions.length > 2 && (
          <div className="overflow-x-auto no-scroll -mx-4 px-4 mb-3">
            <div className="w-max"><ChipRow value={subAcc} onChange={setSubAcc} options={accFilterOptions} /></div>
          </div>
        )}
        <BleedSummary recurrs={filteredSubs} base={base} rates={rates} hide={hide} />
        <RecurrList kind="subscription" recurrs={filteredSubs} hide={hide} onPaid={onPaid} onDel={onDelRecurr} onToggleCancel={onToggleCancel} dueTone={dueTone} accName={accName} onEdit={onEditRecurr} />
      </Section>
      <Section title="Installments" right={<AddMini onClick={() => onAddRecurr("installment")} />}>
        <RecurrList kind="installment" recurrs={recurrs} hide={hide} onPaid={onPaid} onDel={onDelRecurr} dueTone={dueTone} accName={accName} onEdit={onEditRecurr} />
      </Section>
      <Section title={`Monthly budgets · ${base}`}>
        <CardBox className="px-4 py-2">
          {EXP_CATS.filter((c) => !["Subscriptions", "Installments", "Adjustment"].includes(c.n)).map((c) => {
            const b = budgets[c.n] || 0;
            const spent = monthByCat[c.n] || 0;
            const over = b > 0 && spent > b;
            const warn = b > 0 && !over && spent / b >= 0.8;
            return (
              <div key={c.n} className="flex items-center gap-3 py-2.5" style={{ borderBottom: `1px solid ${T.paper}` }}>
                <c.I size={15} style={{ color: c.c }} className="shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <div className="ui text-[13px]" style={{ color: T.text }}>{c.n}</div>
                  {b > 0 && (
                    <>
                      <div className="mt-1"><Bar pct={(spent / b) * 100} color={over ? T.rose : warn ? T.gold : T.green} /></div>
                      <div className="mono text-[10px] mt-0.5" style={{ color: over ? T.rose : T.faint }}>
                        {fmtMoney(spent, base, hide)} spent · {over ? `${fmtMoney(spent - b, base, hide)} over` : `${fmtMoney(b - spent, base, hide)} left`}
                      </div>
                    </>
                  )}
                </div>
                <input
                  type="number" inputMode="decimal" value={b || ""} placeholder="0"
                  onChange={(e) => setBudget(c.n, e.target.value)}
                  className="mono w-24 rounded-lg px-2.5 py-2 text-sm text-right outline-none" style={inputStyle}
                  aria-label={`Monthly budget for ${c.n} in ${base}`}
                />
              </div>
            );
          })}
          <p className="ui text-[10px] py-2" style={{ color: T.faint }}>
            Subscriptions & installments are tracked above as fixed commitments — they post to their own categories when paid.
          </p>
        </CardBox>
      </Section>
    </>
  );
}
