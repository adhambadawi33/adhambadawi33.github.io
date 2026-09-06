import React, { useState } from "react";
import { Check, Landmark, ChevronDown, ChevronRight, Trash2, Luggage, Lightbulb, Repeat, Layers, PiggyBank, CalendarClock } from "lucide-react";
import { T, EXP_CATS, OWNERS, inputStyle } from "../../styles/tokens.js";
import { convert } from "../../lib/finance/currency.js";
import { planStats } from "../../lib/finance/plans.js";
import { tripStats } from "../../lib/finance/trips.js";
import { Section, CardBox, Bar, Money, ChipRow, GhostBtn, PaidBtn, EmptyHint } from "../common/primitives.jsx";
import { RecurrList, OwnerPill } from "../common/rows.jsx";
import { SubLogo } from "../common/brand.jsx";
import { fmtMoney } from "../../styles/tokens.js";
import { daysUntilFromToday, humanDay, monthYear } from "../../lib/dates/ui.js";

const AddMini = ({ onClick, label }) => (
  <GhostBtn onClick={onClick}>{label || "Add"} <span aria-hidden="true">›</span></GhostBtn>
);

/* Normalize any billing cycle to a monthly figure for the bleed total. */
const monthlyOf = (r) => (r.cycle === "yearly" ? r.amount / 12 : r.cycle === "weekly" ? r.amount * 4.33 : r.amount);

/* The subscription "bleed monitor" (the core pain point): one glance =
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
    <div className="mb-5">
      <div className="rounded-2xl px-4 py-3.5" style={{ background: T.roseBg, border: "1px solid rgba(178,114,79,.25)" }}>
        {flagged.map((r, i) => (
          <div key={r.id} className="py-3" style={{ borderTop: i ? "1px solid rgba(178,114,79,.15)" : "none" }}>
            <div className="flex items-center gap-3">
              <SubLogo name={r.name} size={36} />
              <div className="min-w-0 flex-1">
                <div className="ui text-sm truncate flex items-center gap-1.5" style={{ color: T.text }}>
                  <span className="truncate">{r.name}</span>
                  <OwnerPill id={r.owner} />
                </div>
                <div className="ui text-[11px]" style={{ color: T.rose }}>cancel it at the service, then confirm here</div>
              </div>
              <Money n={r.amount} cur={r.currency} hide={hide} className="text-[13px]" />
            </div>
            <div className="flex items-center gap-2 mt-2" style={{ paddingInlineStart: 44 }}>
              <button onClick={() => onDone(r)} className="tap ui text-[12px] font-semibold rounded-lg px-3 min-h-[44px] flex items-center gap-1" style={{ background: T.green, color: "#fff" }}>
                <Check size={12} aria-hidden="true" /> Cancelled — remove it
              </button>
              <button onClick={() => onKeep(r)} className="tap ui text-[12px] rounded-lg px-3 min-h-[44px]" style={{ color: T.sub, border: `1px solid ${T.line}`, background: "#fff" }} aria-label={`Keep ${r.name}`}>
                Keep it
              </button>
            </div>
          </div>
        ))}
        <p className="ui text-[11px] mt-2 pt-2" style={{ color: T.rose, borderTop: "1px solid rgba(178,114,79,.15)" }}>
          Stopping these saves ≈ <b className="mono">{f(saving)}</b> {base}/month = <b className="mono">{f(saving * 12)}</b> a year.
        </p>
      </div>
    </div>
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
            <div className="ui text-[10px] mt-0.5 truncate" style={{ color: T.sub }}>from {accName(p.accountId)}</div>
          )}
        </div>
        <button onClick={() => onDel(p)} className="tap p-3.5 -m-2 opacity-40" style={{ color: T.rose }} aria-label={`Delete ${p.name}`}>
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
          <PaidBtn onClick={() => onPayNext(p.id, s.next.id)} />
        </div>
      ) : (
        <div className="ui text-[12px] mt-3 flex items-center gap-1.5" style={{ color: T.green }}>
          <Check size={14} aria-hidden="true" /> Fully paid ✓
        </div>
      )}

      <div className="mt-3"><Bar pct={pct} color={s.done ? T.green : T.gold} /></div>
      <div className="mono text-[10px] mt-1" style={{ color: T.sub }}>
        {fmtMoney(Math.round(s.paidSum), p.currency, hide)} of {fmtMoney(Math.round(s.totalSum), p.currency, hide)} paid · {Math.round(pct)}%
        {!s.done && ` · ends ${monthYear(s.endDue)}`}
      </div>

      <button onClick={() => setOpen(!open)} className="tap ui text-xs flex items-center gap-1 mt-1 min-h-[44px]" style={{ color: T.sub }} aria-expanded={open}>
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

/* Trip card (Aug 2026): everything spent on a trip, personal vs work, in the
   trip's currency with an ≈ base line. Work share = what the company owes. */
function TripCard({ trip, transactions, base, rates, hide, accName, onEdit, onClose, onDel, onSettle }) {
  const [open, setOpen] = useState(false);
  const s = tripStats(trip, transactions, rates);
  const approx = (n) => (trip.currency === base ? null : `≈ ${fmtMoney(Math.round(convert(n, trip.currency, base, rates)), base, hide)}`);
  return (
    <CardBox className="px-4 py-3.5 mb-3">
      <div className="flex items-center gap-3">
        <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#4E7A9B22", color: "#4E7A9B" }} aria-hidden="true">
          <Luggage size={17} />
        </span>
        <button onClick={() => onEdit(trip)} className="tap min-w-0 flex-1 text-left" aria-label={`Edit trip ${trip.name}`}>
          <div className="ui text-sm truncate" style={{ color: T.text }}>{trip.name}</div>
          <div className="ui text-[10px] mt-0.5" style={{ color: trip.open ? T.green : T.faint }}>
            {trip.open ? "● Open — new expenses ask about this trip" : `Closed · ${trip.startDate}${trip.endDate ? ` → ${trip.endDate}` : ""}`}
          </div>
        </button>
        <button onClick={() => onDel(trip)} className="tap p-3.5 -m-2 opacity-40" style={{ color: T.rose }} aria-label={`Delete trip ${trip.name}`}>
          <Trash2 size={14} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        {[
          { l: "Total", v: s.total, c: T.text },
          { l: "Personal · شخصي", v: s.personal, c: T.text },
          { l: "Work · شغل", v: s.work, c: T.goldDeep },
        ].map((x) => (
          <div key={x.l} className="rounded-xl px-3 py-2" style={{ background: T.paper }}>
            <div className="ui text-[10px] truncate" style={{ color: T.faint }}>{x.l}</div>
            <div className="mono text-[13px] truncate" style={{ color: x.c }}>{fmtMoney(Math.round(x.v), trip.currency, hide)}</div>
            {approx(x.v) && <div className="mono text-[9px] truncate" style={{ color: T.faint }}>{approx(x.v)}</div>}
          </div>
        ))}
      </div>

      {s.work > 0 && !trip.settledDebtId && (
        <button onClick={() => onSettle(trip, s.work)} className="tap ui w-full text-[12px] font-medium rounded-xl px-3 py-2.5 mt-2.5" style={{ background: T.goldBg || "#B08D5722", color: T.goldDeep, border: `1px solid ${T.gold}` }}>
          Company owes {fmtMoney(Math.round(s.work), trip.currency, hide)} → record as a debt
        </button>
      )}
      {trip.settledDebtId && (
        <div className="ui text-[11px] mt-2.5 flex items-center gap-1.5" style={{ color: T.green }}><Check size={13} aria-hidden="true" /> Work share recorded as a debt on the company</div>
      )}
      {trip.open && (
        <button onClick={() => onClose(trip)} className="tap ui text-[12px] mt-1 min-h-[44px] underline" style={{ color: T.sub }}>Close trip (back home)</button>
      )}

      <button onClick={() => setOpen(!open)} className="tap ui text-xs flex items-center gap-1 mt-1 min-h-[44px]" style={{ color: T.sub }} aria-expanded={open}>
        <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
        {open ? "Hide" : `Show all ${s.count} spends`}
      </button>
      {open && s.items.length > 0 && (
        <div className="mt-2 rounded-xl px-3.5 py-1" style={{ background: T.paper }}>
          {s.items.map((t) => (
            <div key={t.id} className="flex items-center gap-2 py-1.5" style={{ borderBottom: `1px solid ${T.line}22` }}>
              <span className="ui text-[10px] shrink-0 rounded px-1" style={{ background: t.tripKind === "work" ? "#B08D5722" : "#4E7A9B22", color: t.tripKind === "work" ? T.goldDeep : "#4E7A9B" }}>{t.tripKind === "work" ? "work" : "me"}</span>
              <span className="ui text-[11px] flex-1 truncate" style={{ color: T.text }}>{t.note || t.category}<span style={{ color: T.faint }}> · {accName(t.accountId)}</span></span>
              <span className="mono text-[11px] shrink-0" style={{ color: T.text }}>{fmtMoney(t.amount, t.currency, hide)}</span>
            </div>
          ))}
        </div>
      )}
    </CardBox>
  );
}

/* One folded group in "Everything planned": a 56px row with a one-line
   summary; tap to unfold the full section underneath. */
function Group({ id, icon: Icon, name, summary, open, onToggle, right, children, first }) {
  return (
    <div style={{ borderTop: first ? "none" : `1px solid ${T.paper}` }}>
      <div className="flex items-center gap-3 px-4">
        <button onClick={() => onToggle(id)} aria-expanded={open} className="tap flex items-center gap-3 flex-1 min-w-0 text-left min-h-[56px]">
          <Icon size={18} strokeWidth={1.8} style={{ color: T.sub }} className="shrink-0" aria-hidden="true" />
          <span className="flex-1 min-w-0">
            <span className="ui text-sm block" style={{ color: T.text }}>{name}</span>
            <span className="ui text-[12px] block truncate" style={{ color: T.sub }}>{summary}</span>
          </span>
          <ChevronRight size={16} style={{ color: T.sub, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }} aria-hidden="true" />
        </button>
        {open && right}
      </div>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

export default function PlannedScreen({ recurrs, plans = [], trips = [], transactions = [], upcoming = [], budgets, monthByCat, base, rates, hide, accName, onAddRecurr, onEditRecurr, onPaid, onDelRecurr, onToggleCancel, dueTone, setBudget, onPayMilestone, onDelPlan, onAddTrip, onEditTrip, onCloseTrip, onDelTrip, onSettleTrip }) {
  /* "Which subscriptions sit on which card / belong to whom?" —
     the two chip rows compose, and the bleed summary follows both. */
  const [subAcc, setSubAcc] = useState("all");
  const [subOwner, setSubOwner] = useState("all");
  const [openGroup, setOpenGroup] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const toggle = (id) => setOpenGroup(openGroup === id ? null : id);
  const flagged = recurrs.filter((r) => r.kind === "subscription" && r.toCancel && !r.paused);
  const active = recurrs.filter((r) => !r.toCancel);
  const subsOnly = active.filter((r) => r.kind === "subscription");
  const subAccIds = [...new Set(subsOnly.map((r) => r.accountId || "none"))];
  const accFilterOptions = [
    { value: "all", label: "All" },
    ...subAccIds.filter((id) => id !== "none").map((id) => ({ value: id, label: accName(id) })),
    ...(subAccIds.includes("none") ? [{ value: "none", label: "No card" }] : []),
  ];
  const subOwnerIds = [...new Set(subsOnly.map((r) => r.owner || "me"))];
  const ownerFilterOptions = [
    { value: "all", label: "Everyone" },
    ...OWNERS.filter((o) => subOwnerIds.includes(o.id)).map((o) => ({ value: o.id, label: o.label })),
  ];
  const bySubAcc = (r) => subAcc === "all" || (r.accountId || "none") === subAcc;
  const bySubOwner = (r) => subOwner === "all" || (r.owner || "me") === subOwner;
  const filteredSubs = active.filter((r) => r.kind !== "subscription" || (bySubAcc(r) && bySubOwner(r)));

  /* The one number: everything leaving in the next 30 days (overdue counts). */
  const soon = upcoming.filter((r) => r.d <= 30 && !r.toCancel);
  const soonTotal = soon.reduce((s, r) => s + convert(r.amount, r.currency, base, rates), 0);
  const biggest = soon.length ? soon.reduce((a, b) => (convert(b.amount, b.currency, base, rates) > convert(a.amount, a.currency, base, rates) ? b : a)) : null;
  const f = (n) => (hide ? "•••••" : Math.round(n).toLocaleString("en-US"));

  /* Group summaries — one line each, read without opening. */
  const liveSubs = subsOnly.filter((r) => !r.paused);
  const subMonthly = liveSubs.reduce((s, r) => s + convert(monthlyOf(r), r.currency, base, rates), 0);
  const insts = recurrs.filter((r) => r.kind === "installment" && r.monthsPaid < r.monthsTotal);
  const instSummary = insts.length === 0 ? "none running" : insts.length === 1 ? `${insts[0].name} · ${insts[0].monthsTotal - insts[0].monthsPaid} months left` : `${insts.length} running`;
  const openPlans = plans.filter((p) => !planStats(p).done);
  const planSummary = plans.length === 0 ? "none" : openPlans.length === 1 ? (() => { const st = planStats(openPlans[0]); return `${openPlans[0].name} · ${Math.round((st.paidSum / st.totalSum) * 100)}% paid · ends ${monthYear(st.endDue)}`; })() : openPlans.length === 0 ? "all paid" : `${openPlans.length} running`;
  const budgetCats = EXP_CATS.filter((c) => !["Subscriptions", "Installments", "Adjustment"].includes(c.n));
  const setBudgets = budgetCats.filter((c) => (budgets[c.n] || 0) > 0);
  const overBudget = setBudgets.filter((c) => (monthByCat[c.n] || 0) > budgets[c.n]);
  const budgetSummary = setBudgets.length === 0 ? "none set" : overBudget.length === 0 ? `${setBudgets.length} set · all on track this month` : `${overBudget.length} over: ${overBudget.map((c) => c.n).join(", ")}`;
  const openTrips = trips.filter((t) => t.open);
  const tripSummary = openTrips.length ? `${openTrips[0].name} · open` : trips.length ? `${trips.length} closed` : "none open";
  const groupAdd = (label, onClick) => <GhostBtn onClick={onClick} className="shrink-0">{label} <span aria-hidden="true">›</span></GhostBtn>;

  return (
    <>
      <div className="px-0.5 pb-4">
        <div className="ui text-[11px] uppercase tracking-wider" style={{ color: T.sub }}>Leaving your accounts · next 30 days</div>
        <div className="mono text-[34px] leading-tight mt-1" style={{ color: T.text }}>{f(soonTotal)} {base}</div>
        <div className="ui text-[13px] mt-1" style={{ color: T.sub }}>
          {soon.length === 0 ? "Nothing due in the next 30 days." : `${soon.length} ${soon.length === 1 ? "payment" : "payments"}${biggest ? ` · biggest: ${biggest.name} on ${humanDay(biggest.nextDue)}` : ""}`}
        </div>
      </div>

      {flagged.length > 0 && (
        <>
          <button onClick={() => setCancelOpen(!cancelOpen)} aria-expanded={cancelOpen} className="tap w-full flex items-center gap-3 rounded-xl px-3.5 min-h-[44px] mb-3 text-left" style={{ background: T.amberBg, border: `1px solid ${T.amber}` }}>
            <Lightbulb size={16} style={{ color: T.goldDeep }} className="shrink-0" aria-hidden="true" />
            <span className="ui text-[12px] flex-1" style={{ color: T.text }}>
              {flagged.length === 1 ? `${flagged[0].name} is still waiting to be cancelled` : `${flagged.length} subscriptions are waiting to be cancelled`}
              {" · saves "}{f(flagged.reduce((s, r) => s + convert(monthlyOf(r), r.currency, base, rates), 0))} {base} a month
            </span>
            <ChevronRight size={14} style={{ color: T.goldDeep, transform: cancelOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} aria-hidden="true" />
          </button>
          {cancelOpen && <CancelWatchlist flagged={flagged} base={base} rates={rates} hide={hide} onDone={onDelRecurr} onKeep={onToggleCancel} />}
        </>
      )}

      <Section title="Next up">
        {soon.length === 0 ? (
          <EmptyHint icon={<CalendarClock size={24} />} text="Subscriptions, installments and plan payments show up here as they come due." />
        ) : (
          <CardBox>
            {soon.map((r, i) => {
              const tone = dueTone(r.d);
              const count = r.kind === "installment" ? `${r.monthsPaid + 1} of ${r.monthsTotal}` : r.kind === "plan" ? (() => { const p = plans.find((x) => x.id === r.planId); const st = p ? planStats(p) : null; return st ? `${st.paidCount + 1} of ${st.count}` : ""; })() : "";
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 min-h-[64px]" style={{ borderTop: i ? `1px solid ${T.paper}` : "none" }}>
                  {r.kind === "plan" ? (
                    <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#B08D5722", color: T.goldDeep }} aria-hidden="true"><Landmark size={17} /></span>
                  ) : (
                    <SubLogo name={r.name} size={36} tintBg={tone.bg} tintColor={tone.c} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="ui text-sm leading-snug flex items-start gap-1.5" style={{ color: T.text }}><span>{r.name}</span><OwnerPill id={r.owner} /></div>
                    <div className="ui text-[12px] leading-snug" style={{ color: tone.c }}>
                      {r.d < 0 ? tone.t : humanDay(r.nextDue)}{count ? <span style={{ color: T.sub }}> · {count}</span> : null}
                    </div>
                  </div>
                  <Money n={r.amount} cur={r.currency} hide={hide} className="text-sm text-right shrink-0" />
                  <PaidBtn onClick={() => onPaid(r)} />
                </div>
              );
            })}
          </CardBox>
        )}
      </Section>

      <Section title="Everything planned">
        <CardBox>
          <Group id="subs" icon={Repeat} name="Subscriptions" summary={liveSubs.length ? `≈ ${f(subMonthly)} ${base} a month · ${liveSubs.length} active` : "none"} open={openGroup === "subs"} onToggle={toggle} first right={groupAdd("Add", () => onAddRecurr("subscription"))}>
            {accFilterOptions.length > 2 && (
              <div className="overflow-x-auto no-scroll -mx-4 px-4 mb-2">
                <div className="w-max"><ChipRow value={subAcc} onChange={setSubAcc} options={accFilterOptions} /></div>
              </div>
            )}
            {ownerFilterOptions.length > 2 && (
              <div className="overflow-x-auto no-scroll -mx-4 px-4 mb-3">
                <div className="w-max"><ChipRow value={subOwner} onChange={setSubOwner} options={ownerFilterOptions} /></div>
              </div>
            )}
            <BleedSummary recurrs={filteredSubs} base={base} rates={rates} hide={hide} />
            <RecurrList kind="subscription" recurrs={filteredSubs} hide={hide} onPaid={onPaid} onDel={onDelRecurr} onToggleCancel={onToggleCancel} dueTone={dueTone} accName={accName} onEdit={onEditRecurr} />
          </Group>
          <Group id="inst" icon={Layers} name="Installments" summary={instSummary} open={openGroup === "inst"} onToggle={toggle} right={groupAdd("Add", () => onAddRecurr("installment"))}>
            <RecurrList kind="installment" recurrs={recurrs} hide={hide} onPaid={onPaid} onDel={onDelRecurr} dueTone={dueTone} accName={accName} onEdit={onEditRecurr} />
          </Group>
          <Group id="plans" icon={Landmark} name="Payment plans" summary={planSummary} open={openGroup === "plans"} onToggle={toggle}>
            {plans.length === 0 ? (
              <div className="ui text-[12px]" style={{ color: T.sub }}>A payment plan is a fixed schedule of dated payments — a property contract, for example. Add one from Settings.</div>
            ) : (
              plans.map((p) => <PlanCard key={p.id} p={p} hide={hide} accName={accName} dueTone={dueTone} onPayNext={onPayMilestone} onDel={onDelPlan} />)
            )}
          </Group>
          <Group id="budgets" icon={PiggyBank} name={`Budgets · ${base}`} summary={budgetSummary} open={openGroup === "budgets"} onToggle={toggle}>
            <div className="rounded-xl px-4 py-1" style={{ background: T.paper }}>
              {budgetCats.map((c) => {
                const b = budgets[c.n] || 0;
                const spent = monthByCat[c.n] || 0;
                const over = b > 0 && spent > b;
                const warn = b > 0 && !over && spent / b >= 0.8;
                return (
                  <div key={c.n} className="flex items-center gap-3 py-2.5" style={{ borderBottom: `1px solid ${T.line}` }}>
                    <c.I size={15} style={{ color: c.c }} className="shrink-0" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <div className="ui text-[13px]" style={{ color: T.text }}>{c.n}</div>
                      {b > 0 && (
                        <>
                          <div className="mt-1"><Bar pct={(spent / b) * 100} color={over ? T.rose : warn ? T.gold : T.green} /></div>
                          <div className="mono text-[10px] mt-0.5" style={{ color: over ? T.rose : T.sub }}>
                            {fmtMoney(spent, base, hide)} spent · {over ? `${fmtMoney(spent - b, base, hide)} over` : `${fmtMoney(b - spent, base, hide)} left`}
                          </div>
                        </>
                      )}
                    </div>
                    <input
                      type="number" inputMode="decimal" value={b || ""} placeholder="—"
                      onChange={(e) => setBudget(c.n, e.target.value)}
                      className="mono w-24 rounded-lg px-2.5 min-h-[44px] text-sm text-right outline-none" style={{ ...inputStyle, background: T.surface }}
                      aria-label={`Monthly budget for ${c.n} in ${base}`}
                    />
                  </div>
                );
              })}
              <p className="ui text-[10px] py-2" style={{ color: T.sub }}>
                Subscriptions &amp; installments are fixed commitments — they post to their own categories when paid.
              </p>
            </div>
          </Group>
          <Group id="trips" icon={Luggage} name="Trips" summary={tripSummary} open={openGroup === "trips"} onToggle={toggle} right={groupAdd("New trip", onAddTrip)}>
            {trips.length === 0 && (
              <div className="ui text-[12px] mb-2" style={{ color: T.sub }}>Travelling? Start a trip — every expense you log asks “personal or work?” and rolls up here.</div>
            )}
            {trips.map((tr) => (
              <TripCard key={tr.id} trip={tr} transactions={transactions} base={base} rates={rates} hide={hide} accName={accName} onEdit={onEditTrip} onClose={onCloseTrip} onDel={onDelTrip} onSettle={onSettleTrip} />
            ))}
          </Group>
        </CardBox>
      </Section>
    </>
  );
}
