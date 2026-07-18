import React from "react";
import { Plus } from "lucide-react";
import { T, EXP_CATS, OWNERS, inputStyle } from "../../styles/tokens.js";
import { convert } from "../../lib/finance/currency.js";
import { Section, CardBox, Bar } from "../common/primitives.jsx";
import { RecurrList } from "../common/rows.jsx";
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

export default function PlannedScreen({ recurrs, budgets, monthByCat, base, rates, hide, accName, onAddRecurr, onPaid, onDelRecurr, dueTone, setBudget }) {
  return (
    <>
      <Section title="Subscriptions" right={<AddMini onClick={() => onAddRecurr("subscription")} />}>
        <BleedSummary recurrs={recurrs} base={base} rates={rates} hide={hide} />
        <RecurrList kind="subscription" recurrs={recurrs} hide={hide} onPaid={onPaid} onDel={onDelRecurr} dueTone={dueTone} accName={accName} />
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
