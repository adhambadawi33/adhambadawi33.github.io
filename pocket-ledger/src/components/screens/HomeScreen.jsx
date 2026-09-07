import React, { useState } from "react";
import { Landmark, CalendarClock, Repeat, Layers, ChevronRight, ChevronDown, Lightbulb, X } from "lucide-react";
import { T, ACCOUNT_TYPE_DEFS, catDef, fmtMoney, accountStripe } from "../../styles/tokens.js";
import { convert } from "../../lib/finance/currency.js";
import { Section, CardBox, EmptyHint, Money, Bar, PaidBtn, useLeaving } from "../common/primitives.jsx";
import { BankMark, CardChip, SubLogo } from "../common/brand.jsx";
import { subBrandFor } from "../../lib/brands.js";
import { TxRow } from "../common/rows.jsx";
import { humanDay } from "../../lib/dates/ui.js";
import { useT, catLabel } from "../../i18n/index.js";
import { hintSeen, dismissHint } from "../../lib/hints.js";
import { Check, Circle } from "lucide-react";

/* Accounts are shown grouped by kind (deliberate design): banks
   together, credit cards together, cash alone — each with its own subtotal. */
const ACCOUNT_GROUPS = [
  { key: "banks", types: ["bank", "debit"], dot: "#4C6350" },
  /* أمانة — accounts holding someone else's money live in their own group
     so the banks subtotal stays "his" money only (matches the hero). */
  { key: "trust", types: ["bank", "debit", "cash"], custodial: true, dot: "#8C7A50" },
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
  const t = useT();
  if (!nudge) return null;
  const amber = nudge.tone === "amber";
  return (
    <div className="rounded-2xl px-4 py-3 mb-4 flex items-start gap-3" style={{ background: amber ? T.amberBg : T.infoBg }}>
      <Lightbulb size={16} className="shrink-0 mt-0.5" style={{ color: amber ? T.amber : T.info }} aria-hidden="true" />
      <p className="ui text-[0.75rem] leading-relaxed flex-1" style={{ color: T.text }}>{nudge.text}</p>
      <button onClick={() => onDismiss(nudge.key)} className="tap p-3 -m-3 shrink-0 opacity-50" style={{ color: T.sub }} aria-label={t("ux.snooze")} title={t("ux.snooze")}>
        <X size={14} />
      </button>
    </div>
  );
}

export default function HomeScreen({
  nudge, onDismissNudge,
  accounts, balances, upcoming, topCats, monthExpense, recent,
  hide, accName, base, dueTone, rates, groupLabels,
  onManageAccounts, onOpenPlanned, onOpenActivity, onOpenCards, onDelTx, onPaid, onAccountTap, counts, onAddRecurr, onAddTx,
}) {
  const t = useT();
  /* Banks stay open; cards, cash and custodial fold behind their subtotal. */
  const [openGroups, setOpenGroups] = useState({});
  const [leaving, leave] = useLeaving();
  /* Three-step start: shown until all three are done or it is dismissed. */
  const [startHidden, setStartHidden] = useState(() => hintSeen("start") > 0);
  const steps = counts ? [
    { key: "account", done: counts.accounts > 0, label: t("ux.stepAccount"), go: onManageAccounts },
    { key: "tx", done: counts.tx > 0, label: t("ux.stepTx"), go: onAddTx },
    { key: "sub", done: counts.recurrs > 0, label: t("ux.stepSub"), go: onAddRecurr },
  ] : [];
  const showStart = steps.length > 0 && !startHidden && steps.some((s) => !s.done) && counts.accounts > 0;
  return (
    <>
      <NudgeCard nudge={nudge} onDismiss={onDismissNudge} />
      {showStart && (
        <CardBox className="px-4 py-3 mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="ui text-[0.8125rem] font-semibold" style={{ color: T.text }}>{t("ux.start")}</span>
            <button onClick={() => { dismissHint("start"); setStartHidden(true); }} className="tap ui text-[0.75rem] min-h-[44px] -my-2 px-1" style={{ color: T.sub }}>{t("ux.dismiss")}</button>
          </div>
          {steps.map((s) => (
            <button key={s.key} onClick={s.done ? undefined : s.go} disabled={s.done} className="tap w-full flex items-center gap-3 min-h-[44px] text-start" style={{ color: s.done ? T.faint : T.text, textDecoration: s.done ? "line-through" : "none" }}>
              {s.done ? <Check size={16} style={{ color: T.green }} aria-hidden="true" /> : <Circle size={16} style={{ color: T.lineStrong }} aria-hidden="true" />}
              <span className="ui text-[0.875rem]">{s.label}</span>
            </button>
          ))}
        </CardBox>
      )}
      {accounts.length === 0 && (
        <EmptyHint
          icon={<Landmark size={26} />}
          text={t("home.emptyAccounts")}
          cta={t("home.addAccounts")}
          onClick={onManageAccounts}
        />
      )}

      {accounts.length > 0 && (
        <Section
          title={t("home.accounts")}
          right={<button onClick={onManageAccounts} className="tap ui text-xs flex items-center gap-0.5 min-h-[44px] -my-2 px-1" style={{ color: T.sub }}>{t("actions.manage")} <ChevronRight size={13} /></button>}
        >
          <CardBox>
          {ACCOUNT_GROUPS.map((g, gi) => {
            const list = accounts.filter((a) => g.types.includes(a.type) && !!a.custodial === !!g.custodial);
            if (!list.length) return null;
            /* Signed by design: owing on a card is negative, red. */
            const subtotal = list.reduce((s, a) => s + convert(balances[a.id] || 0, a.currency, base, rates), 0);
            /* A custodial group with nothing in it is noise, not information. */
            if (g.custodial && Math.abs(subtotal) < 0.005 && list.every((a) => Math.abs(balances[a.id] || 0) < 0.005)) return null;
            const fmtSigned = (n, cur) => (hide ? "•••••" : `${n < 0 ? "−" : ""}${fmtMoney(Math.abs(n), cur, false)}`);
            const open = openGroups[g.key] ?? g.key === "banks";
            return (
              <div key={g.key} style={{ borderTop: gi ? `1px solid ${T.line}` : "none" }}>
                <div className="flex items-center gap-2 px-4">
                  <button onClick={() => setOpenGroups({ ...openGroups, [g.key]: !open })} aria-expanded={open} className="tap flex items-center gap-2 flex-1 min-w-0 text-start min-h-[52px]">
                    <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: g.dot }} aria-hidden="true" />
                    <span className="ui text-[0.8125rem] font-semibold flex-1 truncate" style={{ color: T.text }}>{groupLabels?.[g.key] || g.key}</span>
                    <span className="ui text-[0.75rem] shrink-0" style={{ color: T.faint }}>{list.length === 1 ? t("home.accountOne") : t("home.accountsN", { n: list.length })}</span>
                    <span className="mono text-[0.8125rem] shrink-0" style={{ color: subtotal < -0.005 ? T.rose : T.text }}>{fmtSigned(Math.round(subtotal), base)}</span>
                    <ChevronDown size={15} className="shrink-0" style={{ color: T.faint, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} aria-hidden="true" />
                  </button>

                </div>
                {open && list.map((a, i) => {
                  const bal = balances[a.id] || 0;
                  const Ico = (ACCOUNT_TYPE_DEFS.find((t) => t.id === a.type) || ACCOUNT_TYPE_DEFS[0]).icon;
                  const isCredit = a.type === "credit";
                  const owed = isCredit ? Math.max(0, -bal) : 0;
                  return (
                    <button
                      key={a.id} onClick={() => onAccountTap(a)}
                      className="tap w-full flex items-center gap-3 text-start px-4 min-h-[56px] relative"
                      style={{ borderTop: `1px solid ${T.line}`, background: i % 2 ? "transparent" : "transparent" }}
                    >
                      <span aria-hidden="true" className="absolute inset-y-2 w-[3px] rounded-full" style={{ insetInlineStart: 0, background: accountStripe(a) }} />
                      <AccountBadge a={a} Ico={Ico} isCredit={isCredit} />
                      <span className="flex-1 min-w-0">
                        <span className="ui text-[0.9375rem] block truncate" style={{ color: T.text }}>{a.name}</span>
                        <span className="ui text-[0.75rem] block" style={{ color: isCredit ? (owed > 0 ? T.rose : T.green) : T.faint }}>
                          {isCredit ? (owed > 0 ? t("common.youOweThis") : t("common.nothingOwed")) : `${t(`accountTypes.${a.type}`)} · ${a.currency}`}
                        </span>
                      </span>
                      <span className="mono text-[0.9375rem] shrink-0" style={{ color: isCredit && bal < 0 ? T.rose : T.text }}>{fmtSigned(bal, a.currency)}</span>
                      <ChevronRight size={15} className="shrink-0" style={{ color: T.faint }} aria-hidden="true" />
                    </button>
                  );
                })}
                {open && g.key === "cards" && (
                  <button onClick={onOpenCards} className="tap w-full flex items-center justify-between px-4 min-h-[48px] text-start" style={{ borderTop: `1px solid ${T.line}`, color: T.goldDeep }}>
                    <span className="ui text-[0.8125rem] font-medium">{t("ux.cardsDetail")}</span><ChevronRight size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })}
          </CardBox>
        </Section>
      )}

      <Section
        title={t("home.comingUp")}
        right={<button onClick={onOpenPlanned} className="tap ui text-xs flex items-center gap-0.5 min-h-[44px] -my-2 px-1" style={{ color: T.sub }}>{t("actions.all")} <ChevronRight size={13} /></button>}
      >
        {upcoming.length === 0 ? (
          <EmptyHint icon={<CalendarClock size={24} />} text={t("home.emptyUpcoming")} cta={t("home.addOne")} onClick={onOpenPlanned} />
        ) : (
          <CardBox>
            {upcoming.slice(0, 4).map((r, i) => {
              const tone = dueTone(r.d);
              return (
                <div key={r.id} className={`flex items-center gap-3 px-4 py-3 ${leaving === r.id ? "row-leave" : ""}`} style={{ borderTop: i ? `1px solid ${T.line}` : "none" }}>
                  {subBrandFor(r.name) ? (
                    <SubLogo name={r.name} size={36} />
                  ) : (
                    <span className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: tone.bg, color: tone.c }} aria-hidden="true">
                      {r.kind === "subscription" ? <Repeat size={16} /> : <Layers size={16} />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="ui text-sm truncate" style={{ color: T.text }}>{r.name}</div>
                    <div className="ui text-[0.75rem]" style={{ color: tone.c }}>{tone.t} · {humanDay(r.nextDue)}</div>
                  </div>
                  <Money n={r.amount} cur={r.currency} hide={hide} className="text-sm" />
                  <PaidBtn onClick={() => leave(r.id, () => onPaid(r))} />
                </div>
              );
            })}
          </CardBox>
        )}
      </Section>

      {topCats.length > 0 && (
        <Section title={t("home.byCategory")}>
          <CardBox className="px-4 py-3.5">
            {topCats.map((c) => {
              const def = catDef(c.n);
              const max = topCats[0].v || 1;
              return (
                <div key={c.n} className="flex items-center gap-3 py-1.5">
                  <def.I size={15} style={{ color: def.c }} className="shrink-0" aria-hidden="true" />
                  <span className="ui text-[0.8125rem] w-24 truncate" style={{ color: T.sub }}>{catLabel(c.n)}</span>
                  <div className="flex-1"><Bar pct={(c.v / max) * 100} color={def.c} /></div>
                  <Money n={c.v} cur={base} hide={hide} className="text-[0.75rem] w-20 text-right" />
                </div>
              );
            })}
            {monthExpense > 0 && (
              <div className="ui text-[0.6875rem] mt-1 text-right" style={{ color: T.faint }}>{t("home.ratesNote")}</div>
            )}
          </CardBox>
        </Section>
      )}

      {recent.length > 0 && (
        <Section title={t("home.recent")} right={<button onClick={onOpenActivity} className="tap ui text-xs flex items-center gap-0.5 min-h-[44px] -my-2 px-1" style={{ color: T.sub }}>{t("actions.all")} <ChevronRight size={13} /></button>}>
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
