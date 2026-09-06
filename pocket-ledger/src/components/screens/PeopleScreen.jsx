import React, { useState } from "react";
import { Coins, ChevronDown } from "lucide-react";
import { T } from "../../styles/tokens.js";
import { Section, CardBox, EmptyHint, Money, GhostBtn } from "../common/primitives.jsx";
import { DebtCard, GivenRow } from "../common/rows.jsx";
import { convert } from "../../lib/finance/currency.js";
import { collectGifts, isGift } from "../../lib/finance/gifts.js";
import { useT } from "../../i18n/index.js";

/* People answers one question: who owes whom right now. Open loans are the
   action list. Everything given away (help or gifts, handed over or bought)
   is one memory list under a single total, folded until you want it. */
export default function PeopleScreen({ debts, transactions = [], owedToMe, iOwe, base, rates, hide, onAddDebt, onPay, onDelDebt }) {
  const t = useT();
  const [givenOpen, setGivenOpen] = useState(false);
  const [settledOpen, setSettledOpen] = useState(false);
  /* Settled loans stay in the file for memory, but out of the way. */
  const allLoans = debts.filter((x) => !x.noReturn);
  const loans = allLoans.filter((x) => x.amount - x.repaid > 0.005);
  const settled = allLoans.filter((x) => x.amount - x.repaid <= 0.005);
  const help = debts
    .filter((x) => x.noReturn && !isGift(x))
    .map((x) => ({ id: `help:${x.id}`, source: "debt", kind: "help", who: x.person, what: x.note, amount: x.amount, currency: x.currency, date: x.date, ref: x }));
  const gifts = collectGifts(debts, transactions).map((g) => ({ ...g, kind: "gift" }));
  const given = [...help, ...gifts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const givenTotal = given.reduce((s, x) => s + convert(x.amount, x.currency, base, rates), 0);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <CardBox className="px-4 py-3">
          <div className="ui text-[11px] uppercase tracking-wider" style={{ color: T.sub }}>{t("people.owedToYou")}</div>
          <Money n={Math.round(owedToMe)} cur={base} hide={hide} color={T.green} className="text-lg" />
        </CardBox>
        <CardBox className="px-4 py-3">
          <div className="ui text-[11px] uppercase tracking-wider" style={{ color: T.sub }}>{t("people.youOwe")}</div>
          <Money n={Math.round(iOwe)} cur={base} hide={hide} color={iOwe > 0 ? T.rose : T.text} className="text-lg" />
        </CardBox>
      </div>
      <Section title={t("people.openLoans")} right={<GhostBtn onClick={onAddDebt}>{t("actions.add")} <span aria-hidden="true">›</span></GhostBtn>}>
        {loans.length === 0 && settled.length === 0 ? (
          <EmptyHint icon={<Coins size={26} />} text={t("people.empty")} cta={t("people.addLoan")} onClick={onAddDebt} />
        ) : loans.length === 0 ? (
          <div className="ui text-[13px] px-0.5 py-3" style={{ color: T.sub }}>{t("people.allSquare")}</div>
        ) : (
          loans.map((x) => <DebtCard key={x.id} x={x} hide={hide} onPay={onPay} onDel={onDelDebt} base={base} rates={rates} />)
        )}
        {settled.length > 0 && (
          <>
            <button onClick={() => setSettledOpen(!settledOpen)} aria-expanded={settledOpen} className="tap ui text-[12px] flex items-center gap-1 min-h-[44px] px-0.5" style={{ color: T.sub }}>
              <ChevronDown size={14} style={{ transform: settledOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} aria-hidden="true" />
              {settledOpen ? t("people.hideSettled") : t("people.settledShow", { n: settled.length })}
            </button>
            {settledOpen && settled.map((x) => <DebtCard key={x.id} x={x} hide={hide} onPay={onPay} onDel={onDelDebt} base={base} rates={rates} />)}
          </>
        )}
      </Section>
      {given.length > 0 && (
        <Section
          title={t("people.givenAway")}
          right={
            <button onClick={() => setGivenOpen(!givenOpen)} aria-expanded={givenOpen} className="tap flex items-center gap-1.5 min-h-[44px] -my-2 px-1">
              <Money n={Math.round(givenTotal)} cur={base} hide={hide} color={T.goldDeep} className="text-sm" />
              <ChevronDown size={14} style={{ color: T.sub, transform: givenOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} aria-hidden="true" />
            </button>
          }
        >
          {givenOpen ? (
            <CardBox>
              {given.map((g, i) => <GivenRow key={g.id} g={g} hide={hide} onDel={onDelDebt} base={base} rates={rates} first={i === 0} />)}
            </CardBox>
          ) : (
            <button onClick={() => setGivenOpen(true)} className="tap ui text-[12px] w-full text-left px-0.5 min-h-[44px] -my-2" style={{ color: T.sub }}>
              {given.length === 1 ? t("people.givenOne") : t("people.givenSummary", { n: given.length })}
            </button>
          )}
        </Section>
      )}
    </>
  );
}
