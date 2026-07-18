import React from "react";
import { Plus, Check } from "lucide-react";
import { T, EXP_CATS, OWNERS, inputStyle } from "../../styles/tokens.js";
import { convert } from "../../lib/finance/currency.js";
import { Section, CardBox, Bar, Money } from "../common/primitives.jsx";
import { RecurrList, OwnerPill } from "../common/rows.jsx";
import { SubLogo } from "../common/brand.jsx";
import { fmtMoney } from "../../styles/tokens.js";

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
              <SubLogo name={r.name} size={32} />
              <div className="min-w-0 flex-1">
                <div className="ui text-sm truncate flex items-center gap-1.5" style={{ color: T.text }}>
                  <span className="truncate">{r.name}</span>
                  <OwnerPill id={r.owner} />
                </div>
                <div className="ui text-[10.5px]" style={{ color: T.rose }}>cancel at the service first</div>
              </div>
              <Money n={r.amount} cur={r.currency} hide={hide} className="text-[13px]" />
            </div>
            <div className="flex items-center gap-2 mt-2" style={{ paddingInlineStart: 44 }}>
              <button onClick={() => onDone(r)} className="tap ui text-[11.5px] font-semibold rounded-lg px-3 py-2 flex items-center gap-1" style={{ background: T.green, color: "#fff" }}>
                <Check size={12} aria-hidden="true" /> Cancelled — remove it
              </button>
              <button onClick={() => onKeep(r)} className="tap ui text-[11.5px] rounded-lg px-3 py-2" style={{ color: T.sub, border: `1px solid ${T.line}`, background: "#fff" }} aria-label={`Keep ${r.name}`}>
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

export default function PlannedScreen({ recurrs, budgets, monthByCat, base, rates, hide, accName, onAddRecurr, onPaid, onDelRecurr, onToggleCancel, dueTone, setBudget }) {
  const flagged = recurrs.filter((r) => r.kind === "subscription" && r.toCancel && !r.paused);
  const active = recurrs.filter((r) => !r.toCancel);
  return (
    <>
      <CancelWatchlist flagged={flagged} base={base} rates={rates} hide={hide} onDone={onDelRecurr} onKeep={onToggleCancel} />
      <Section title="Subscriptions" right={<AddMini onClick={() => onAddRecurr("subscription")} />}>
        <BleedSummary recurrs={recurrs} base={base} rates={rates} hide={hide} />
        <RecurrList kind="subscription" recurrs={active} hide={hide} onPaid={onPaid} onDel={onDelRecurr} onToggleCancel={onToggleCancel} dueTone={dueTone} accName={accName} />
      </Section>
      <Section title="Installments" right={<AddMini onClick={() => onAddRecurr("installment")} />}>
        <RecurrList kind="installment" recurrs={recurrs} hide={hide} onPaid={onPaid} onDel={onDelRecurr} dueTone={dueTone} accName={accName} />
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
