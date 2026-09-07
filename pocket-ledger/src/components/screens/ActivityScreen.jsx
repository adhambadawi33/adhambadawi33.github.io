import React, { useState } from "react";
import { Search, Download, Receipt, Sparkles, FileText, SlidersHorizontal } from "lucide-react";
import { T, fmtMoney } from "../../styles/tokens.js";
import { CardBox, EmptyHint, ChipRow, SortToggle } from "../common/primitives.jsx";
import { convertWithSnapshot } from "../../lib/finance/currency.js";
import { TxRow } from "../common/rows.jsx";
import { humanDay } from "../../lib/dates/ui.js";
import { useT, catLabel, ownerLabel } from "../../i18n/index.js";
import { EXP_CATS, INC_CATS, OWNERS } from "../../styles/tokens.js";
import { thisMonthKey } from "../../lib/dates/localDate.js";
import { monthLabel, prevMonthKey } from "../../lib/finance/report.js";

/* Plain-language month summary — sentences, not charts (user preference). */
function InsightCard({ insight, base, hide }) {
  const t = useT();
  if (!insight || insight.spent <= 0) return null;
  const money = (n) => fmtMoney(Math.round(n), base, hide);
  const diff = insight.spent - insight.lastToDate;
  const same = Math.abs(diff) < Math.max(50, insight.lastToDate * 0.02);
  return (
    <CardBox className="px-4 py-3.5 mb-4">
      <div className="ui text-[0.6875rem] uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: T.faint }}>
        <Sparkles size={12} style={{ color: T.goldDeep }} aria-hidden="true" /> {t("activity.plainWords")}
      </div>
      <p className="ui text-[0.8125rem] leading-relaxed" style={{ color: T.text }}>
        {t("activity.spent")} <span className="mono font-semibold">{money(insight.spent)}</span> {t("activity.soFar")}
        {insight.top && <>{t("activity.mostOn", { top: catLabel(insight.top.n), topAmt: money(insight.top.v) })}{insight.second ? t("activity.then", { second: catLabel(insight.second.n), secondAmt: money(insight.second.v) }) : ""}</>}.
      </p>
      {insight.hadLast && (
        <p className="ui text-[0.75rem] mt-1" style={{ color: T.sub }}>
          {same ? t("activity.same") : t(diff > 0 ? "activity.more" : "activity.less", { amt: money(Math.abs(diff)) })}
        </p>
      )}
    </CardBox>
  );
}

export default function ActivityScreen({ txByDay, filter, setFilter, accounts, hide, accName, onDelTx, onEditTx, onExport, onOpenReport, insight, base }) {
  const [sort, setSort] = useState("date");
  const byAmount = sort === "amount" ? txByDay.flatMap(([, rows]) => rows).sort((a, b) => { const v = (x) => { const amt = x.type === "transfer" ? x.sourceAmount : x.amount; const cur = x.type === "transfer" ? x.sourceCurrency : x.currency; return Math.abs(convertWithSnapshot(amt, cur, base, x.snapshot)); }; return v(b) - v(a); }) : null;
  const t = useT();
  const activeCount = ["accountId", "month", "owner", "category"].filter((k) => (filter[k] || "all") !== "all").length;
  const active = activeCount > 0;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const showChips = filtersOpen || active;
  const m0 = thisMonthKey(), m1 = prevMonthKey(m0), m2 = prevMonthKey(m1);
  const set = (k) => (v) => setFilter({ ...filter, [k]: v });
  return (
    <>
      <InsightCard insight={insight} base={base} hide={hide} />
      <div className="flex gap-2 mb-3">
        <div className="flex-1 flex items-center gap-2 rounded-xl px-3" style={{ background: T.surface, border: `1px solid ${T.lineStrong}` }}>
          <Search size={15} style={{ color: T.faint }} aria-hidden="true" />
          <input
            value={filter.q}
            onChange={(e) => setFilter({ ...filter, q: e.target.value })}
            placeholder={t("ux.searchPh")}
            className="ui w-full py-2.5 text-sm outline-none bg-transparent"
            style={{ color: T.text }}
            aria-label={t("activity.searchAria")}
          />
        </div>
        <button onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={showChips} className="tap relative h-[44px] w-[44px] rounded-xl flex items-center justify-center" style={{ background: active ? T.ink : T.surface, border: `1px solid ${active ? T.ink : T.line}`, color: active ? "#fff" : T.sub }} aria-label={t("ux.filters")}>
          <SlidersHorizontal size={16} />
          {active && <span className="absolute -top-1 -end-1 h-4 min-w-4 px-1 rounded-full mono text-[0.6875rem] flex items-center justify-center" style={{ background: T.gold, color: T.ink }}>{activeCount}</span>}
        </button>
        <button onClick={onOpenReport} className="tap h-[44px] w-[44px] rounded-xl flex items-center justify-center" style={{ background: T.surface, border: `1px solid ${T.line}`, color: T.sub }} aria-label={t("activity.report")}>
          <FileText size={16} />
        </button>
        <button onClick={onExport} className="tap h-[44px] w-[44px] rounded-xl flex items-center justify-center" style={{ background: T.surface, border: `1px solid ${T.line}`, color: T.sub }} aria-label={t("activity.export")}>
          <Download size={16} />
        </button>
      </div>
      {showChips && (
        <div className="mb-4 flex flex-col gap-2">
          <div className="overflow-x-auto no-scroll -mx-4 px-4"><div className="w-max"><ChipRow value={filter.month || "all"} onChange={set("month")} options={[{ value: "all", label: t("ux.allMonths") }, { value: m0, label: t("ux.thisMonth") }, { value: m1, label: monthLabel(m1) }, { value: m2, label: monthLabel(m2) }]} /></div></div>
          <div className="overflow-x-auto no-scroll -mx-4 px-4"><div className="w-max"><ChipRow value={filter.accountId} onChange={set("accountId")} options={[{ value: "all", label: t("activity.allAccounts") }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]} /></div></div>
          <div className="overflow-x-auto no-scroll -mx-4 px-4"><div className="w-max"><ChipRow value={filter.owner || "all"} onChange={set("owner")} options={[{ value: "all", label: t("ux.anyone") }, ...OWNERS.map((o) => ({ value: o.id, label: ownerLabel(o.id) }))]} /></div></div>
          <div className="overflow-x-auto no-scroll -mx-4 px-4"><div className="w-max"><ChipRow value={filter.category || "all"} onChange={set("category")} options={[{ value: "all", label: t("ux.anyCat") }, ...[...EXP_CATS, ...INC_CATS].filter((c) => c.n !== "Adjustment").map((c) => ({ value: c.n, label: catLabel(c.n) }))]} /></div></div>
        </div>
      )}
      {txByDay.length > 0 && <SortToggle value={sort} onChange={setSort} className="mb-3" />}
      {txByDay.length === 0 ? (
        <EmptyHint icon={<Receipt size={26} />} text={t("activity.empty")} />
      ) : byAmount ? (
        <CardBox>
          {byAmount.map((t, i) => (
            <TxRow key={t.id} t={t} i={i} hide={hide} accName={accName} onDel={onDelTx} onEdit={onEditTx} compact />
          ))}
        </CardBox>
      ) : (
        txByDay.map(([day, rows]) => (
          <div key={day} className="mb-4">
            <div className="sticky-day ui text-[0.75rem] font-medium uppercase tracking-wider py-1.5 px-0.5 mb-1" style={{ color: T.faint }}>{humanDay(day)}</div>
            <CardBox>
              {rows.map((t, i) => (
                <TxRow key={t.id} t={t} i={i} hide={hide} accName={accName} onDel={onDelTx} onEdit={onEditTx} compact />
              ))}
            </CardBox>
          </div>
        ))
      )}
    </>
  );
}
