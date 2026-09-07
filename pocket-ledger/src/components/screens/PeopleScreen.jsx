import React, { useState } from "react";
import { Coins, ChevronDown } from "lucide-react";
import { hintSeen, dismissHint } from "../../lib/hints.js";
import { Sheet } from "../common/primitives.jsx";
import { TxRow } from "../common/rows.jsx";
import { T } from "../../styles/tokens.js";
import { Section, CardBox, EmptyHint, Money, GhostBtn } from "../common/primitives.jsx";
import { DebtCard, GivenRow } from "../common/rows.jsx";
import { convert } from "../../lib/finance/currency.js";
import { fmtMoney } from "../../styles/tokens.js";
import { collectGifts, isGift } from "../../lib/finance/gifts.js";
import { useT } from "../../i18n/index.js";

/* People answers one question: who owes whom right now. Open loans are the
   action list. Everything given away (help or gifts, handed over or bought)
   is one memory list under a single total, folded until you want it. */
export default function PeopleScreen({ debts, transactions = [], owedToMe, iOwe, base, rates, hide, onAddDebt, onPay, onDelDebt, accName = () => "" }) {
  const t = useT();
  const [givenOpen, setGivenOpen] = useState(false);
  const [settledOpen, setSettledOpen] = useState(false);
  const [person, setPerson] = useState(null);
  /* Settled loans stay in the file for memory, but out of the way. */
  const allLoans = debts.filter((x) => !x.noReturn);
  const loans = allLoans.filter((x) => x.amount - x.repaid > 0.005);
  const settled = allLoans.filter((x) => x.amount - x.repaid <= 0.005);
  /* Offsetting pairs: an open lent + an open borrowed with the same remaining
     amount and currency (e.g. money passing through for the company) cancel
     out and are left out of the net. */
  const openLoans = debts.filter((x) => !x.noReturn && x.amount - x.repaid > 0.005);
  const words = (s) => new Set((s || "").split(/[\s—–\-·/]+/).filter((w) => w.length >= 3));
  const shareWord = (a, b) => { const wa = words(a.person + " " + a.note), wb = words(b.person + " " + b.note); return [...wa].some((w) => wb.has(w)); };
  const pairedIds = new Set();
  for (const a of openLoans.filter((x) => x.direction === "lent")) {
    const b = openLoans.find((y) => y.direction === "borrowed" && !pairedIds.has(y.id) && y.currency === a.currency && Math.abs((y.amount - y.repaid) - (a.amount - a.repaid)) < 0.005 && shareWord(a, y));
    if (b) { pairedIds.add(a.id); pairedIds.add(b.id); }
  }
  const pairedTotal = [...pairedIds].reduce((s, id) => { const x = debts.find((d) => d.id === id); return x && x.direction === "lent" ? s + convert(x.amount - x.repaid, x.currency, base, rates) : s; }, 0);
  const net = (owedToMe - pairedTotal) - (iOwe - pairedTotal);
  const [tagHintHidden, setTagHintHidden] = useState(() => hintSeen("giftHelp") > 0);
  const help = debts
    .filter((x) => x.noReturn && !isGift(x))
    .map((x) => ({ id: `help:${x.id}`, source: "debt", kind: "help", who: x.person, what: x.note, amount: x.amount, currency: x.currency, date: x.date, ref: x }));
  const gifts = collectGifts(debts, transactions).map((g) => ({ ...g, kind: "gift" }));
  const given = [...help, ...gifts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const givenTotal = given.reduce((s, x) => s + convert(x.amount, x.currency, base, rates), 0);
  return (
    <>
      {/* One line, not two tiles: the question is "who owes whom", the numbers are its answer. */}
      <div className="px-0.5 pb-5">
        <div className="ui text-[0.6875rem] uppercase tracking-wider" style={{ color: T.sub }}>{t("ux.net")}</div>
        <div className="mono text-[1.875rem] leading-tight mt-1" style={{ color: net < -0.5 ? T.rose : net > 0.5 ? T.green : T.text }}>{hide ? "•••••" : `${net < 0 ? "−" : net > 0 ? "+" : ""}${fmtMoney(Math.abs(Math.round(net)), base, false)}`}</div>
        <div className="ui text-[0.75rem] mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5" style={{ color: T.sub }}>
          <span>{t("people.owedToYou")} <Money n={Math.round(owedToMe)} cur={base} hide={hide} color={T.green} className="text-[0.75rem]" /></span>
          <span>{t("people.youOwe")} <Money n={Math.round(iOwe)} cur={base} hide={hide} color={T.rose} className="text-[0.75rem]" /></span>
          {pairedTotal > 0.5 && <span title={t("ux.pairedHint")} className="rounded-full px-2 py-0.5" style={{ background: T.goldBg, color: T.goldDeep }}>{t("ux.paired", { amt: fmtMoney(Math.round(pairedTotal), base, hide) })}</span>}
        </div>
      </div>
      <Section title={t("people.openLoans")} right={<GhostBtn onClick={onAddDebt}>{t("actions.add")} <span aria-hidden="true">›</span></GhostBtn>}>
        {loans.length === 0 && settled.length === 0 ? (
          <EmptyHint icon={<Coins size={26} />} text={t("people.empty")} cta={t("people.addLoan")} onClick={onAddDebt} />
        ) : loans.length === 0 ? (
          <div className="ui text-[0.8125rem] px-0.5 py-3" style={{ color: T.sub }}>{t("people.allSquare")}</div>
        ) : (
          loans.map((x) => <DebtCard key={x.id} x={x} hide={hide} onPay={onPay} onDel={onDelDebt} base={base} rates={rates} onOpenPerson={setPerson} />)
        )}
        {settled.length > 0 && (
          <>
            <button onClick={() => setSettledOpen(!settledOpen)} aria-expanded={settledOpen} className="tap ui text-[0.75rem] flex items-center gap-1 min-h-[44px] px-0.5" style={{ color: T.sub }}>
              <ChevronDown size={14} style={{ transform: settledOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} aria-hidden="true" />
              {settledOpen ? t("people.hideSettled") : t("people.settledShow", { n: settled.length })}
            </button>
            {settledOpen && settled.map((x) => <DebtCard key={x.id} x={x} hide={hide} onPay={onPay} onDel={onDelDebt} base={base} rates={rates} onOpenPerson={setPerson} />)}
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
          {givenOpen && !tagHintHidden && (
            <div className="ui text-[0.75rem] rounded-lg px-3 py-2 mb-2 flex items-start gap-2" style={{ background: T.goldBg, color: T.goldDeep }}>
              <span className="flex-1">{t("ux.giftHelpHint")}</span>
              <button onClick={() => { dismissHint("giftHelp"); setTagHintHidden(true); }} className="tap ui text-[0.75rem] shrink-0 min-h-[28px]" style={{ color: T.goldDeep }}>✕</button>
            </div>
          )}
          {givenOpen ? (
            <CardBox>
              {given.map((g, i) => <GivenRow key={g.id} g={g} hide={hide} onDel={onDelDebt} base={base} rates={rates} first={i === 0} />)}
            </CardBox>
          ) : (
            <button onClick={() => setGivenOpen(true)} className="tap ui text-[0.75rem] w-full text-start px-0.5 min-h-[44px] -my-2" style={{ color: T.sub }}>
              {given.length === 1 ? t("people.givenOne") : t("people.givenSummary", { n: given.length })}
            </button>
          )}
        </Section>
      )}
      <PersonSheet person={person} onClose={() => setPerson(null)} debts={debts} transactions={transactions} hide={hide} base={base} rates={rates} accName={accName} onPay={onPay} onDel={onDelDebt} t={t} />
    </>
  );
}

/* Person page: every loan, gift and logged transaction that names them. */
function PersonSheet({ person, onClose, debts, transactions, hide, base, rates, accName, onPay, onDel, t }) {
  if (!person) return null;
  const key = person.trim().toLowerCase();
  const theirs = debts.filter((x) => x.person.trim().toLowerCase() === key);
  const txs = transactions.filter((x) => (x.note || "").toLowerCase().includes(key)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  return (
    <Sheet open onClose={onClose} title={person} tall>
      <div className="ui text-[0.75rem] mb-3" style={{ color: T.sub }}>{t("people.allWith", { name: person })}</div>
      <Section title={t("people.loans")}>
        {theirs.map((x) => <DebtCard key={x.id} x={x} hide={hide} onPay={onPay} onDel={onDel} base={base} rates={rates} />)}
      </Section>
      <Section title={t("people.txs")}>
        {txs.length === 0 ? (
          <div className="ui text-[0.8125rem] px-0.5" style={{ color: T.sub }}>{t("people.noTx")}</div>
        ) : (
          <CardBox>{txs.map((x, i) => <TxRow key={x.id} t={x} i={i} hide={hide} accName={accName} compact />)}</CardBox>
        )}
      </Section>
    </Sheet>
  );
}
