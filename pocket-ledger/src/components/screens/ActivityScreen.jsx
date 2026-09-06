import React from "react";
import { Search, Download, Receipt, Sparkles, FileText } from "lucide-react";
import { T, fmtMoney } from "../../styles/tokens.js";
import { CardBox, EmptyHint, ChipRow } from "../common/primitives.jsx";
import { TxRow } from "../common/rows.jsx";
import { humanDay } from "../../lib/dates/ui.js";
import { useT, catLabel } from "../../i18n/index.js";

/* Plain-language month summary — sentences, not charts (user preference). */
function InsightCard({ insight, base, hide }) {
  const t = useT();
  if (!insight || insight.spent <= 0) return null;
  const money = (n) => fmtMoney(Math.round(n), base, hide);
  const diff = insight.spent - insight.lastToDate;
  const same = Math.abs(diff) < Math.max(50, insight.lastToDate * 0.02);
  return (
    <CardBox className="px-4 py-3.5 mb-4">
      <div className="ui text-[11px] uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: T.faint }}>
        <Sparkles size={12} style={{ color: T.goldDeep }} aria-hidden="true" /> {t("activity.plainWords")}
      </div>
      <p className="ui text-[13px] leading-relaxed" style={{ color: T.text }}>
        {t("activity.spent")} <span className="mono font-semibold">{money(insight.spent)}</span> {t("activity.soFar")}
        {insight.top && <>{t("activity.mostOn", { top: catLabel(insight.top.n), topAmt: money(insight.top.v) })}{insight.second ? t("activity.then", { second: catLabel(insight.second.n), secondAmt: money(insight.second.v) }) : ""}</>}.
      </p>
      {insight.hadLast && (
        <p className="ui text-[12px] mt-1" style={{ color: T.sub }}>
          {same ? t("activity.same") : t(diff > 0 ? "activity.more" : "activity.less", { amt: money(Math.abs(diff)) })}
        </p>
      )}
    </CardBox>
  );
}

export default function ActivityScreen({ txByDay, filter, setFilter, accounts, hide, accName, onDelTx, onEditTx, onExport, onOpenReport, insight, base }) {
  const t = useT();
  return (
    <>
      <InsightCard insight={insight} base={base} hide={hide} />
      <div className="flex gap-2 mb-3">
        <div className="flex-1 flex items-center gap-2 rounded-xl px-3" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
          <Search size={15} style={{ color: T.faint }} aria-hidden="true" />
          <input
            value={filter.q}
            onChange={(e) => setFilter({ ...filter, q: e.target.value })}
            placeholder={t("activity.searchPh")}
            className="ui w-full py-2.5 text-sm outline-none bg-transparent"
            style={{ color: T.text }}
            aria-label={t("activity.searchAria")}
          />
        </div>
        <button onClick={onOpenReport} className="tap h-[44px] w-[44px] rounded-xl flex items-center justify-center" style={{ background: T.surface, border: `1px solid ${T.line}`, color: T.sub }} aria-label={t("activity.report")}>
          <FileText size={16} />
        </button>
        <button onClick={onExport} className="tap h-[44px] w-[44px] rounded-xl flex items-center justify-center" style={{ background: T.surface, border: `1px solid ${T.line}`, color: T.sub }} aria-label={t("activity.export")}>
          <Download size={16} />
        </button>
      </div>
      <div className="overflow-x-auto no-scroll mb-4 -mx-4 px-4">
        <div className="w-max"><ChipRow
          value={filter.accountId}
          onChange={(v) => setFilter({ ...filter, accountId: v })}
          options={[{ value: "all", label: t("activity.allAccounts") }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
        /></div>
      </div>
      {txByDay.length === 0 ? (
        <EmptyHint icon={<Receipt size={26} />} text={t("activity.empty")} />
      ) : (
        txByDay.map(([day, rows]) => (
          <div key={day} className="mb-4">
            <div className="ui text-[11px] uppercase tracking-wider mb-1.5 px-0.5" style={{ color: T.faint }}>{humanDay(day)}</div>
            <CardBox>
              {rows.map((t, i) => (
                <TxRow key={t.id} t={t} i={i} hide={hide} accName={accName} onDel={onDelTx} onEdit={onEditTx} />
              ))}
            </CardBox>
          </div>
        ))
      )}
    </>
  );
}
