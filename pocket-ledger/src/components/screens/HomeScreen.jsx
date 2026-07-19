import React from "react";
import { Landmark, CalendarClock, Repeat, Layers, ChevronRight, Lightbulb, X } from "lucide-react";
import { T, ACCOUNT_TYPE_DEFS, catDef, fmtMoney, accountStripe } from "../../styles/tokens.js";
import { convert } from "../../lib/finance/currency.js";
import { Section, CardBox, EmptyHint, Money, Bar } from "../common/primitives.jsx";
import { BankMark, CardChip, SubLogo } from "../common/brand.jsx";
import { subBrandFor } from "../../lib/brands.js";
import { TxRow } from "../common/rows.jsx";
import { humanDay } from "../../lib/dates/ui.js";

/* Accounts are shown grouped by kind (design decision with Adham): banks
   together, credit cards together, cash alone — each with its own subtotal. */
const ACCOUNT_GROUPS = [
  { key: "banks", types: ["bank", "debit"], dot: "#4C6350" },
  { key: "cards", types: ["credit"], dot: "#B08D57" },
  { key: "cash", types: ["cash"], dot: "#9E6E6E" },
];

/* Bank wordmark when the bank is recognized; card chip for credit cards;
   tinted type icon otherwise. */
function AccountBadge({ a, Ico, isCredit }) {
  if (isCredit) return <CardChip account={a} width={44} />;
  const mark = BankMark({ name: a.name, size: 24 });
  if (mark) return mark;
  return (
    <span className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${a.color}22`, color: a.color }} aria-hidden="true">
      <Ico size={13} />
    </span>
  );
}

/* One gentle nudge, tops (batch 10) — calm colors, plain words, easy to
   dismiss. Never a stack of warnings. */
function NudgeCard({ nudge, onDismiss }) {
  if (!nudge) return null;
  const amber = nudge.tone === "amber";
  return (
    <div className="rounded-2xl px-4 py-3 mb-4 flex items-start gap-3" style={{ background: amber ? T.amberBg : T.surface, border: `1px solid ${amber ? T.amber : T.line}` }}>
      <Lightbulb size={16} className="shrink-0 mt-0.5" style={{ color: amber ? T.amber : T.goldDeep }} aria-hidden="true" />
      <p className="ui text-[12px] leading-relaxed flex-1" style={{ color: T.text }}>{nudge.text}</p>
      <button onClick={() => onDismiss(nudge.key)} className="tap p-1 -m-1 shrink-0 opacity-50" style={{ color: T.sub }} aria-label="Dismiss hint">
        <X size={14} />
      </button>
    </div>
  );
}

export default function HomeScreen({
  nudge, onDismissNudge,
  accounts, balances, upcoming, topCats, monthExpense, recent,
  hide, accName, base, dueTone, rates, groupLabels,
  onManageAccounts, onOpenPlanned, onOpenActivity, onOpenCards, onDelTx, onPaid, onAccountTap,
}) {
  return (
    <>
      <NudgeCard nudge={nudge} onDismiss={onDismissNudge} />
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
          {ACCOUNT_GROUPS.map((g) => {
            const list = accounts.filter((a) => g.types.includes(a.type));
            if (!list.length) return null;
            /* Signed by design (Adham): owing on a card is negative, red. */
            const subtotal = list.reduce((s, a) => s + convert(balances[a.id] || 0, a.currency, base, rates), 0);
            const fmtSigned = (n, cur) => (hide ? "•••••" : `${n < 0 ? "−" : ""}${fmtMoney(Math.abs(n), cur, false)}`);
            return (
              <div key={g.key} className="mb-3">
                <div className="flex items-baseline justify-between mb-1.5 px-0.5">
                  <span className="ui text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: T.sub }}>
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: g.dot }} aria-hidden="true" />
                    {groupLabels?.[g.key] || g.key}
                  </span>
                  {g.key === "cards" ? (
                    <button onClick={onOpenCards} className="tap flex items-center gap-0.5">
                      <span className="mono text-[12px]" style={{ color: subtotal < -0.005 ? T.rose : T.text }}>{fmtSigned(Math.round(subtotal), base)}</span>
                      <ChevronRight size={12} style={{ color: T.faint }} aria-hidden="true" />
                    </button>
                  ) : (
                    <span className="mono text-[12px]" style={{ color: subtotal < -0.005 ? T.rose : T.text }}>{fmtSigned(Math.round(subtotal), base)}</span>
                  )}
                </div>
                <div className="flex gap-3 overflow-x-auto no-scroll -mx-4 px-4 pb-1">
                  {list.map((a) => {
                    const bal = balances[a.id] || 0;
                    const Ico = (ACCOUNT_TYPE_DEFS.find((t) => t.id === a.type) || ACCOUNT_TYPE_DEFS[0]).icon;
                    const isCredit = a.type === "credit";
                    const owed = isCredit ? Math.max(0, -bal) : 0;
                    return (
                      <button
                        key={a.id} onClick={() => onAccountTap(a)}
                        className="tap shrink-0 w-40 rounded-2xl p-3 text-left relative overflow-hidden"
                        style={{ background: T.surface, border: `1px solid ${T.line}` }}
                      >
                        <span aria-hidden="true" className="absolute inset-y-0 w-1" style={{ insetInlineStart: 0, background: accountStripe(a) }} />
                        <div className="flex items-center gap-2 mb-3">
                          <AccountBadge a={a} Ico={Ico} isCredit={isCredit} />
                          <span className="ui text-[10px] uppercase tracking-wider" style={{ color: T.faint }}>{a.type}</span>
                        </div>
                        <div className="ui text-[12px] truncate" style={{ color: T.sub }}>{a.name}</div>
                        <div className="mono text-[15px] mt-0.5" style={{ color: isCredit && bal < 0 ? T.rose : T.text }}>{fmtSigned(bal, a.currency)}</div>
                        {/* No "available" here — credit headroom reads like money
                            you own (Adham). Owed state only; details live in Cards. */}
                        {isCredit && (
                          owed > 0
                            ? <div className="ui text-[10px] mt-0.5" style={{ color: T.rose }}>you owe this ↑</div>
                            : <div className="ui text-[10px] mt-0.5" style={{ color: T.green }}>nothing owed ✓</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
                  {subBrandFor(r.name) ? (
                    <SubLogo name={r.name} size={36} />
                  ) : (
                    <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: tone.bg, color: tone.c }} aria-hidden="true">
                      {r.kind === "subscription" ? <Repeat size={16} /> : <Layers size={16} />}
                    </span>
                  )}
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
