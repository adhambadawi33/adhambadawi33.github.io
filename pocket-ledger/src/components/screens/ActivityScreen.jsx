import React from "react";
import { Search, Download, Receipt, Sparkles } from "lucide-react";
import { T, fmtMoney } from "../../styles/tokens.js";
import { CardBox, EmptyHint, ChipRow } from "../common/primitives.jsx";
import { TxRow } from "../common/rows.jsx";
import { humanDay } from "../../lib/dates/ui.js";

/* Plain-language month summary — sentences, not charts (Adham's ask). */
function InsightCard({ insight, base, hide }) {
  if (!insight || insight.spent <= 0) return null;
  const money = (n) => fmtMoney(Math.round(n), base, hide);
  const diff = insight.spent - insight.lastToDate;
  const same = Math.abs(diff) < Math.max(50, insight.lastToDate * 0.02);
  return (
    <CardBox className="px-4 py-3.5 mb-4">
      <div className="ui text-[11px] uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: T.faint }}>
        <Sparkles size={12} style={{ color: T.goldDeep }} aria-hidden="true" /> This month, in plain words
      </div>
      <p className="ui text-[13px] leading-relaxed" style={{ color: T.text }}>
        You&apos;ve spent <span className="mono font-semibold">{money(insight.spent)}</span> so far
        {insight.top && <> — most of it on {insight.top.n} ({money(insight.top.v)}{insight.second ? `), then ${insight.second.n} (${money(insight.second.v)}` : ""})</>}.
      </p>
      {insight.hadLast && (
        <p className="ui text-[12px] mt-1" style={{ color: same ? T.faint : diff > 0 ? T.rose : T.green }}>
          {same
            ? "About the same as last month at this point."
            : `That's ${money(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than last month at this point.`}
        </p>
      )}
    </CardBox>
  );
}

export default function ActivityScreen({ txByDay, filter, setFilter, accounts, hide, accName, onDelTx, onExport, insight, base }) {
  return (
    <>
      <InsightCard insight={insight} base={base} hide={hide} />
      <div className="flex gap-2 mb-3">
        <div className="flex-1 flex items-center gap-2 rounded-xl px-3" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
          <Search size={15} style={{ color: T.faint }} aria-hidden="true" />
          <input
            value={filter.q}
            onChange={(e) => setFilter({ ...filter, q: e.target.value })}
            placeholder="Search notes or categories"
            className="ui w-full py-2.5 text-sm outline-none bg-transparent"
            style={{ color: T.text }}
            aria-label="Search transactions"
          />
        </div>
        <button onClick={onExport} className="tap h-[44px] w-[44px] rounded-xl flex items-center justify-center" style={{ background: T.surface, border: `1px solid ${T.line}`, color: T.sub }} aria-label="Export CSV">
          <Download size={16} />
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto no-scroll mb-4 -mx-4 px-4">
        <ChipRow
          value={filter.accountId}
          onChange={(v) => setFilter({ ...filter, accountId: v })}
          options={[{ value: "all", label: "All accounts" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
        />
      </div>
      {txByDay.length === 0 ? (
        <EmptyHint icon={<Receipt size={26} />} text="Every expense, income, transfer and adjustment lands here. Tap the gold + to log the first one — three taps is all it takes." />
      ) : (
        txByDay.map(([day, rows]) => (
          <div key={day} className="mb-4">
            <div className="ui text-[11px] uppercase tracking-wider mb-1.5 px-0.5" style={{ color: T.faint }}>{humanDay(day)}</div>
            <CardBox>
              {rows.map((t, i) => (
                <TxRow key={t.id} t={t} i={i} hide={hide} accName={accName} onDel={onDelTx} />
              ))}
            </CardBox>
          </div>
        ))
      )}
    </>
  );
}
