import { useT, catLabel, ownerLabel } from "../../i18n/index.js";
import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Printer, Repeat, CalendarClock } from "lucide-react";
import { T, fmtMoney, catDef, ownerDef } from "../../styles/tokens.js";
import { Sheet, CardBox, Section, Bar } from "../common/primitives.jsx";
import { monthReport, monthsWithData, monthLabel, prevMonthKey, nextMonthKey } from "../../lib/finance/report.js";
import { thisMonthKey } from "../../lib/dates/localDate.js";

const dayOf = (iso) => String(+(iso || "").slice(8, 10));

function HeroStat({ label, v, color }) {
  return (
    <div className="flex-1 min-w-0 text-center px-1 py-3">
      <div className="ui text-[11px] uppercase tracking-wider mb-1" style={{ color: T.faint }}>{label}</div>
      <div className="mono text-[14px] truncate" style={{ color }}>{v}</div>
    </div>
  );
}

/* Monthly report (handoff §5.5): one month, one page — where the money went,
   whose it was, which account paid, and how the subscriptions landed.
   The Print button turns the sheet into the print layout (print CSS in
   index.css keyed off body.report-open). */
export default function ReportSheet({ open, onClose, data, base, hide, accName }) {
  const tr = useT();
  const [monthKey, setMonthKey] = useState(thisMonthKey());
  useEffect(() => { if (open) setMonthKey(thisMonthKey()); }, [open]);

  /* Print CSS hook: while the report is open, printing shows ONLY the report. */
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("report-open");
    return () => document.body.classList.remove("report-open");
  }, [open]);

  const months = useMemo(
    () => (open ? monthsWithData(data.transactions) : []),
    [open, data.transactions]
  );
  const report = useMemo(
    () => (open ? monthReport(data, monthKey, base) : null),
    [open, data, monthKey, base]
  );
  if (!open || !report) return null;

  const first = months[0];
  const last = months[months.length - 1];
  const money = (n) => fmtMoney(Math.round(n), base, hide);
  const diff = report.expense - report.prevExpense;
  const maxCat = report.categories[0]?.v || 1;

  return (
    <Sheet open={open} onClose={onClose} title={tr("sheets.report.title")} tall overlayClass="print-overlay" panelClass="print-panel" bodyClass="print-body">
      {/* month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setMonthKey(prevMonthKey(monthKey))}
          disabled={monthKey <= first}
          className="tap no-print h-10 w-10 rounded-full flex items-center justify-center"
          style={{ background: T.paper, color: monthKey <= first ? T.line : T.sub }}
          aria-label={tr("sheets.report.prev")}
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <div className="disp text-xl" style={{ color: T.text }}>{monthLabel(monthKey)}</div>
          <div className="ui text-[11px]" style={{ color: T.faint }}>
            {report.txCount === 1 ? tr("sheets.report.txOne", { cur: base }) : tr("sheets.report.txCount", { n: report.txCount, cur: base })}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setMonthKey(nextMonthKey(monthKey))}
            disabled={monthKey >= last}
            className="tap no-print h-10 w-10 rounded-full flex items-center justify-center"
            style={{ background: T.paper, color: monthKey >= last ? T.line : T.sub }}
            aria-label={tr("sheets.report.next")}
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => window.print()}
            className="tap no-print h-10 w-10 rounded-full flex items-center justify-center"
            style={{ background: T.ink, color: "#fff" }}
            aria-label={tr("sheets.report.print")}
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      {/* in / out / net */}
      <CardBox className="flex divide-x mb-2" style={{ borderColor: T.line }}>
        <HeroStat label={tr("sheets.report.in")} v={money(report.income)} color={T.green} />
        <HeroStat label={tr("sheets.report.out")} v={money(report.expense)} color={T.rose} />
        <HeroStat label={tr("sheets.report.net")} v={`${report.net < 0 ? "−" : ""}${money(Math.abs(report.net))}`} color={report.net < 0 ? T.rose : T.text} />
      </CardBox>
      {report.prevHadExpense && (
        <p className="ui text-[12px] mb-5 px-0.5" style={{ color: Math.abs(diff) < 1 ? T.faint : diff > 0 ? T.rose : T.green }}>
          {Math.abs(diff) < 1
            ? tr("sheets.report.same", { month: monthLabel(prevMonthKey(monthKey)) })
            : tr(diff > 0 ? "sheets.report.more" : "sheets.report.less", { amt: money(Math.abs(diff)), month: monthLabel(prevMonthKey(monthKey)), prev: money(report.prevExpense) })}
        </p>
      )}

      {report.txCount === 0 ? (
        <CardBox className="px-5 py-8 text-center">
          <p className="ui text-sm" style={{ color: T.sub }}>{tr("sheets.report.nothing", { month: monthLabel(monthKey) })}</p>
        </CardBox>
      ) : (
        <>
          {report.categories.length > 0 && (
            <Section title={tr("sheets.report.whereItWent")}>
              <CardBox className="px-4 py-1">
                {report.categories.map((c, i) => {
                  const def = catDef(c.key);
                  const over = c.budget != null && c.v > c.budget;
                  return (
                    <div key={c.key} className="py-2.5" style={{ borderTop: i ? `1px solid ${T.line}` : "none" }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <def.I size={14} style={{ color: def.c }} aria-hidden="true" />
                        <span className="ui text-[13px] flex-1 truncate" style={{ color: T.text }}>{catLabel(c.key)}</span>
                        {c.budget != null && (
                          <span className="ui text-[11px]" style={{ color: over ? T.rose : T.green }}>
                            {over ? tr("sheets.report.over") : tr("sheets.report.of")} {fmtMoney(c.budget, base, hide)}
                          </span>
                        )}
                        <span className="mono text-[13px]" style={{ color: T.text }}>{money(c.v)}</span>
                      </div>
                      <Bar pct={(c.v / maxCat) * 100} color={over ? T.rose : def.c} />
                    </div>
                  );
                })}
              </CardBox>
            </Section>
          )}

          {report.owners.length > 1 && (
            <Section title={tr("sheets.report.whoFor")}>
              <CardBox className="px-4 py-1">
                {report.owners.map((o, i) => {
                  const def = ownerDef(o.key);
                  return (
                    <div key={o.key} className="flex items-center gap-2 py-2.5" style={{ borderTop: i ? `1px solid ${T.line}` : "none" }}>
                      <span className="ui text-[11px] rounded-lg px-2 py-0.5" style={{ background: def.bg, color: def.c }}>{ownerLabel(def.id)}</span>
                      <span className="ui text-[11px] flex-1" style={{ color: T.faint }}>{Math.round((o.v / report.expense) * 100)}%</span>
                      <span className="mono text-[13px]" style={{ color: T.text }}>{money(o.v)}</span>
                    </div>
                  );
                })}
              </CardBox>
            </Section>
          )}

          {report.accounts.length > 0 && (
            <Section title={tr("sheets.report.paidFrom")}>
              <CardBox className="px-4 py-1">
                {report.accounts.map((a, i) => (
                  <div key={a.key} className="flex items-center gap-2 py-2.5" style={{ borderTop: i ? `1px solid ${T.line}` : "none" }}>
                    <span className="ui text-[13px] flex-1 truncate" style={{ color: T.text }}>{accName(a.key)}</span>
                    <span className="mono text-[13px]" style={{ color: T.text }}>{money(a.v)}</span>
                  </div>
                ))}
              </CardBox>
            </Section>
          )}

          {(report.subsCharged.length > 0 || report.subsDue.length > 0) && (
            <Section title={tr("sheets.report.subs")}>
              <CardBox className="px-4 py-1">
                {report.subsCharged.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2 py-2.5" style={{ borderTop: i ? `1px solid ${T.line}` : "none" }}>
                    <Repeat size={13} style={{ color: T.goldDeep }} aria-hidden="true" />
                    <span className="ui text-[13px] flex-1 truncate" style={{ color: T.text }}>{s.name}</span>
                    <span className="ui text-[11px]" style={{ color: T.faint }}>{tr("sheets.report.day", { d: dayOf(s.date) })}</span>
                    <span className="mono text-[13px]" style={{ color: T.text }}>{money(s.baseValue)}</span>
                  </div>
                ))}
                {report.subsDue.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2 py-2.5" style={{ borderTop: i ? `1px solid ${T.line}` : "none" }}>
                    <CalendarClock size={13} style={{ color: T.amber }} aria-hidden="true" />
                    <span className="ui text-[13px] flex-1 truncate" style={{ color: T.sub }}>{s.name}</span>
                    <span className="ui text-[11px]" style={{ color: T.amber }}>{tr("sheets.report.dueDay", { d: dayOf(s.due) })}</span>
                    <span className="mono text-[13px]" style={{ color: T.sub }}>{fmtMoney(s.amount, s.currency, hide)}</span>
                  </div>
                ))}
              </CardBox>
            </Section>
          )}

          {report.largest.length > 0 && (
            <Section title={tr("sheets.report.biggest")}>
              <CardBox className="px-4 py-1">
                {report.largest.map((x, i) => {
                  const def = catDef(x.category);
                  return (
                    <div key={x.id} className="flex items-center gap-2 py-2.5" style={{ borderTop: i ? `1px solid ${T.line}` : "none" }}>
                      <def.I size={14} style={{ color: def.c }} aria-hidden="true" />
                      <span className="ui text-[13px] flex-1 truncate" style={{ color: T.text }}>{x.note || catLabel(x.category)}</span>
                      <span className="ui text-[11px]" style={{ color: T.faint }}>{tr("sheets.report.day", { d: dayOf(x.date) })}</span>
                      <span className="mono text-[13px]" style={{ color: T.text }}>{money(x.baseValue)}</span>
                    </div>
                  );
                })}
              </CardBox>
            </Section>
          )}

          <p className="ui text-[11px] text-center mb-2" style={{ color: T.faint }}>
            {tr("sheets.report.note")}
          </p>
        </>
      )}
    </Sheet>
  );
}
