import React from "react";
import { Plus } from "lucide-react";
import { T, EXP_CATS, inputStyle } from "../../styles/tokens.js";
import { Section, CardBox, Bar } from "../common/primitives.jsx";
import { RecurrList } from "../common/rows.jsx";
import { fmtMoney } from "../../styles/tokens.js";

const AddMini = ({ onClick, label }) => (
  <button onClick={onClick} className="tap ui text-xs flex items-center gap-1 rounded-lg px-2.5 py-2" style={{ background: T.ink, color: "#fff" }}>
    <Plus size={13} aria-hidden="true" />{label || "Add"}
  </button>
);

export default function PlannedScreen({ recurrs, budgets, monthByCat, base, hide, onAddRecurr, onPaid, onDelRecurr, dueTone, setBudget }) {
  return (
    <>
      <Section title="Subscriptions" right={<AddMini onClick={() => onAddRecurr("subscription")} />}>
        <RecurrList kind="subscription" recurrs={recurrs} hide={hide} onPaid={onPaid} onDel={onDelRecurr} dueTone={dueTone} />
      </Section>
      <Section title="Installments" right={<AddMini onClick={() => onAddRecurr("installment")} />}>
        <RecurrList kind="installment" recurrs={recurrs} hide={hide} onPaid={onPaid} onDel={onDelRecurr} dueTone={dueTone} />
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
