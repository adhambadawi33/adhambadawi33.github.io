import React from "react";
import { Search, Download, Receipt } from "lucide-react";
import { T } from "../../styles/tokens.js";
import { CardBox, EmptyHint, ChipRow } from "../common/primitives.jsx";
import { TxRow } from "../common/rows.jsx";
import { humanDay } from "../../lib/dates/ui.js";

export default function ActivityScreen({ txByDay, filter, setFilter, accounts, hide, accName, onDelTx, onExport }) {
  return (
    <>
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
