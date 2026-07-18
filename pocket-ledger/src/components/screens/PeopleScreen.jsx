import React from "react";
import { Plus, Coins } from "lucide-react";
import { T } from "../../styles/tokens.js";
import { Section, CardBox, EmptyHint, Money } from "../common/primitives.jsx";
import { DebtCard } from "../common/rows.jsx";

export default function PeopleScreen({ debts, owedToMe, iOwe, base, rates, hide, onAddDebt, onPay, onDelDebt }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <CardBox className="px-4 py-3">
          <div className="ui text-[11px] uppercase tracking-wider" style={{ color: T.faint }}>Owed to you</div>
          <Money n={Math.round(owedToMe)} cur={base} hide={hide} color={T.green} className="text-lg" />
        </CardBox>
        <CardBox className="px-4 py-3">
          <div className="ui text-[11px] uppercase tracking-wider" style={{ color: T.faint }}>You owe</div>
          <Money n={Math.round(iOwe)} cur={base} hide={hide} color={iOwe > 0 ? T.rose : T.text} className="text-lg" />
        </CardBox>
      </div>
      <Section
        title="Loans & IOUs"
        right={<button onClick={onAddDebt} className="tap ui text-xs flex items-center gap-1 rounded-lg px-2.5 py-2" style={{ background: T.ink, color: "#fff" }}><Plus size={13} aria-hidden="true" />Add</button>}
      >
        {debts.length === 0 ? (
          <EmptyHint icon={<Coins size={26} />} text="Money you've lent or borrowed lives here — who, how much, and every partial repayment — kept separate from your accounts by default." cta="Add a loan" onClick={onAddDebt} />
        ) : (
          debts.map((x) => <DebtCard key={x.id} x={x} hide={hide} onPay={onPay} onDel={onDelDebt} base={base} rates={rates} />)
        )}
      </Section>
    </>
  );
}
