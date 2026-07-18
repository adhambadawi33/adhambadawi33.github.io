import React from "react";
import { Landmark, CalendarClock, Repeat, Layers, ChevronRight } from "lucide-react";
import { T, ACCOUNT_TYPE_DEFS, catDef, fmtMoney } from "../../styles/tokens.js";
import { Section, CardBox, EmptyHint, Money, Bar } from "../common/primitives.jsx";
import { TxRow } from "../common/rows.jsx";
import { humanDay } from "../../lib/dates/ui.js";

export default function HomeScreen({
  accounts, balances, upcoming, topCats, monthExpense, recent,
  hide, accName, base, dueTone, onManageAccounts, onOpenPlanned, onOpenActivity, onDelTx, onPaid, onAccountTap,
}) {
  return (
    <>
      {accounts.length === 0 && (
        <EmptyHint
          icon={<Landmark size={26} />}
          text="Your money picture starts with accounts — each bank, card and your cash wallet, with a rough balance. Two minutes, no precision needed."
          cta="Add accounts"
          onClick={onManageAccounts}
        />
      )}

      {accounts.length > 0 && (
        <Section
          title="Accounts"
          right={<button onClick={onManageAccounts} className="tap ui text-xs flex items-center gap-0.5" style={{ color: T.sub }}>Manage <ChevronRight size={13} /></button>}
        >
          <div className="flex gap-3 overflow-x-auto no-scroll -mx-4 px-4 pb-1">
            {accounts.map((a) => {
              const bal = balances[a.id] || 0;
              const Ico = (ACCOUNT_TYPE_DEFS.find((t) => t.id === a.type) || ACCOUNT_TYPE_DEFS[0]).icon;
              const owed = a.type === "credit" && bal < 0;
              return (
                <button key={a.id} onClick={() => onAccountTap(a)} className="tap shrink-0 w-40 rounded-2xl p-3.5 text-left" style={{ background: a.color, color: "#fff" }}>
                  <div className="flex items-center justify-between mb-4 opacity-90"><Ico size={16} aria-hidden="true" /><span className="ui text-[10px] uppercase tracking-wider">{a.type}</span></div>
                  <div className="ui text-[12px] truncate opacity-90">{a.name}</div>
                  <div className="mono text-[17px] mt-0.5">{fmtMoney(owed ? -bal : bal, a.currency, hide)}</div>
                  {owed && <div className="ui text-[10px] opacity-80 mt-0.5">owed{a.creditLimit ? ` · limit ${fmtMoney(a.creditLimit, a.currency, hide)}` : ""}</div>}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <Section
        title="Coming up"
        right={<button onClick={onOpenPlanned} className="tap ui text-xs flex items-center gap-0.5" style={{ color: T.sub }}>All <ChevronRight size={13} /></button>}
      >
        {upcoming.length === 0 ? (
          <EmptyHint icon={<CalendarClock size={24} />} text="Subscriptions and installments appear here before they're due, so nothing sneaks up on you. Add the first one from Planned." cta="Add one" onClick={onOpenPlanned} />
        ) : (
          <CardBox>
            {upcoming.slice(0, 4).map((r, i) => {
              const tone = dueTone(r.d);
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${T.paper}` : "none" }}>
                  <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: tone.bg, color: tone.c }} aria-hidden="true">
                    {r.kind === "subscription" ? <Repeat size={16} /> : <Layers size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="ui text-sm truncate" style={{ color: T.text }}>{r.name}</div>
                    <div className="ui text-[11px]" style={{ color: tone.c }}>{tone.t} · {humanDay(r.nextDue)}</div>
                  </div>
                  <Money n={r.amount} cur={r.currency} hide={hide} className="text-sm" />
                  <button onClick={() => onPaid(r)} className="tap ui text-[11px] font-medium rounded-lg px-3 py-2" style={{ background: T.ink, color: "#fff" }}>Paid</button>
                </div>
              );
            })}
          </CardBox>
        )}
      </Section>

      {topCats.length > 0 && (
        <Section title="This month by category">
          <CardBox className="px-4 py-3.5">
            {topCats.map((c) => {
              const def = catDef(c.n);
              const max = topCats[0].v || 1;
              return (
                <div key={c.n} className="flex items-center gap-3 py-1.5">
                  <def.I size={15} style={{ color: def.c }} className="shrink-0" aria-hidden="true" />
                  <span className="ui text-[13px] w-24 truncate" style={{ color: T.sub }}>{c.n}</span>
                  <div className="flex-1"><Bar pct={(c.v / max) * 100} color={def.c} /></div>
                  <Money n={c.v} cur={base} hide={hide} className="text-[12px] w-20 text-right" />
                </div>
              );
            })}
            {monthExpense > 0 && (
              <div className="ui text-[10px] mt-1 text-right" style={{ color: T.faint }}>values fixed at entry-time rates</div>
            )}
          </CardBox>
        </Section>
      )}

      {recent.length > 0 && (
        <Section title="Recent" right={<button onClick={onOpenActivity} className="tap ui text-xs flex items-center gap-0.5" style={{ color: T.sub }}>All <ChevronRight size={13} /></button>}>
          <CardBox>
            {recent.map((t, i) => (
              <TxRow key={t.id} t={t} i={i} hide={hide} accName={accName} onDel={onDelTx} compact />
            ))}
          </CardBox>
        </Section>
      )}
    </>
  );
}
