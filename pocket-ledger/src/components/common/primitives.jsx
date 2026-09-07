import React, { useEffect, useRef } from "react";
import { X, Delete, AlertTriangle, RotateCcw } from "lucide-react";
import { T, fmtMoney, inputCls, inputStyle } from "../../styles/tokens.js";
import { useT, makeT, uiLang } from "../../i18n/index.js";

export const Money = ({ n, cur, hide, color, className = "" }) => (
  <span className={`mono ${className}`} style={{ color: color || T.text }}>
    {fmtMoney(n, cur, hide)}
  </span>
);

/* Bottom sheet with dialog semantics (handoff §6.3): role=dialog, Escape to
   close, initial focus into the panel, focus restored to the opener. */
export function Sheet({ open, onClose, title, children, tall, overlayClass = "", panelClass = "", bodyClass = "" }) {
  const t = useT();
  const panel = useRef(null);
  const opener = useRef(null);
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    panel.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") return onClose();
      /* Keep Tab inside the dialog (WAI-ARIA dialog pattern). */
      if (e.key !== "Tab" || !panel.current) return;
      const focusables = panel.current.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    /* Lock the page behind the sheet — otherwise touch-scrolling the sheet
       (or the dimmed edge) scrolls the app in the background on iOS. */
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener.current?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center desk:items-stretch desk:justify-end ${overlayClass}`}
      style={{ background: T.scrim }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-t-[22px] overflow-hidden slide-up flex flex-col outline-none ${tall ? "h-[94%]" : "max-h-[88%]"} desk:h-full desk:max-h-full desk:max-w-[460px] desk:rounded-none ${panelClass}`}
        style={{ background: T.raised, boxShadow: T.shadow1 }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full desk:hidden" style={{ background: T.lineStrong }} aria-hidden="true" />
        <div className="shrink-0 flex items-center justify-between px-5 pt-2 pb-3 no-print" style={{ borderBottom: `1px solid ${T.line}` }}>
          <h2 className="disp text-lg" style={{ color: T.text }}>{title}</h2>
          <button onClick={onClose} className="tap h-10 w-10 rounded-full flex items-center justify-center" style={{ background: T.paper, color: T.sub }} aria-label={t("prim.close")}>
            <X size={18} />
          </button>
        </div>
        <div className={`overflow-y-auto px-5 py-4 ${bodyClass}`} style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export const Field = ({ label, children }) => (
  <div className="mb-3.5">
    <label className="ui text-[0.6875rem] uppercase tracking-wider block mb-1.5" style={{ color: T.faint }}>{label}</label>
    {children}
  </div>
);

export function ChipRow({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            className="tap ui rounded-full px-4 min-h-[40px] text-sm flex items-center gap-1.5"
            style={on ? { background: T.ink, color: "#fff", border: `1px solid ${T.ink}` } : { background: "transparent", color: T.sub, border: `1px solid ${T.lineStrong}` }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const Bar = ({ pct, color, h = 6 }) => (
  <div className="w-full rounded-full overflow-hidden" style={{ background: T.sunken, height: h }}>
    <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color, transition: "width .4s ease" }} />
  </div>
);

export const Section = ({ title, right, children }) => (
  <div className="mb-6">
    <div className="flex items-center justify-between mb-2.5 px-0.5">
      <h2 className="ui text-[0.8125rem] font-semibold tracking-wide m-0" style={{ color: T.sub }}>{title}</h2>
      {right}
    </div>
    {children}
  </div>
);

/* Quiet secondary action ("Add ›", "Manage ›"): text + chevron, 44px tall.
   Only "Paid" stays as a filled ink button, so one screen never shows a
   row of competing dark pills. */
export const GhostBtn = ({ onClick, children, className = "", ariaLabel, ariaExpanded }) => (
  <button onClick={onClick} aria-label={ariaLabel} aria-expanded={ariaExpanded} className={`tap ui text-xs flex items-center gap-0.5 min-h-[44px] px-1 -my-2 ${className}`} style={{ color: T.sub }}>
    {children}
  </button>
);

export const PaidBtn = ({ onClick, label }) => {
  const t = useT();
  return (
    <button onClick={onClick} className="tap ui text-[0.6875rem] font-medium rounded-lg px-3 min-h-[44px]" style={{ background: T.ink, color: "#fff" }}>
      {label || t("actions.paid")}
    </button>
  );
};

export const CardBox = ({ children, className = "", style = {}, flat = false }) => (
  <div className={`rounded-2xl ${className}`} style={flat ? { background: T.surface, border: `1px solid ${T.line}`, ...style } : { background: T.surface, boxShadow: T.shadow1, ...style }}>
    {children}
  </div>
);

/* Loading placeholder rows — shape of the content, no spinner. */
export const Skeleton = ({ rows = 3 }) => (
  <div className="rounded-2xl px-4 py-2" style={{ background: T.surface, boxShadow: T.shadow1 }} aria-hidden="true">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 py-3" style={{ borderTop: i ? `1px solid ${T.line}` : "none" }}>
        <div className="h-9 w-9 rounded-xl sk" />
        <div className="flex-1 flex flex-col gap-2"><div className="h-3 rounded sk" style={{ width: `${55 - i * 8}%` }} /><div className="h-2 rounded sk" style={{ width: "30%" }} /></div>
        <div className="h-3 w-16 rounded sk" />
      </div>
    ))}
  </div>
);

/* Row exit: mark a row as leaving, run the action after the fade. */
export function useLeaving(delay = 380) {
  const [leaving, setLeaving] = React.useState(null);
  const leave = (id, fn) => { setLeaving(id); setTimeout(() => { fn(); setLeaving(null); }, delay); };
  return [leaving, leave];
}

export const EmptyHint = ({ icon, text, cta, onClick }) => (
  <div className="rounded-2xl px-5 py-7 text-center" style={{ background: T.surface, border: `1px dashed ${T.lineStrong}` }}>
    <div className="mx-auto mb-2 h-11 w-11 rounded-xl flex items-center justify-center" style={{ background: T.goldBg, color: T.goldDeep }}>{icon}</div>
    <p className="ui text-sm" style={{ color: T.sub }}>{text}</p>
    {cta && (
      <button onClick={onClick} className="tap ui mt-3 rounded-xl px-4 min-h-[44px] text-sm font-semibold" style={{ background: T.goldBg, color: T.goldDeep }}>
        {cta}
      </button>
    )}
  </div>
);

export function Numpad({ value, onChange }) {
  const t = useT();
  const press = (k) => {
    if (k === "back") return onChange(value.slice(0, -1));
    if (k === "." && value.includes(".")) return;
    if (k === "." && value === "") return onChange("0.");
    const next = value + k;
    if (/^\d{0,9}(\.\d{0,2})?$/.test(next)) onChange(next);
  };
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];
  return (
    <div className="grid grid-cols-3 gap-2" role="group" dir="ltr" aria-label={t("prim.keypad")}>
      {keys.map((k) => (
        <button
          key={k}
          onClick={() => press(k)}
          className="tap mono rounded-2xl py-3.5 text-xl flex items-center justify-center select-none"
          style={{ background: T.paper, color: T.text, border: `1px solid ${T.line}` }}
          aria-label={k === "back" ? t("prim.deleteDigit") : k}
        >
          {k === "back" ? <Delete size={20} /> : k}
        </button>
      ))}
    </div>
  );
}

/* Undo toast for safe deletion & paid taps (handoff §4.8) — loud enough
   to catch the eye: gold-bordered, big Undo button, 10s window. */
export function UndoToast({ toast, onUndo }) {
  const t = useT();
  if (!toast) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-[70] w-[92%] max-w-md" style={{ bottom: "calc(88px + env(safe-area-inset-bottom))" }} role="status" aria-live="polite">
      <div className="pop flex items-center gap-3 rounded-2xl px-4 py-3.5" style={{ background: T.ink, color: "#fff", boxShadow: T.shadow1 }}>
        <span className="ui text-sm flex-1">{toast.label}</span>
        {toast.restore !== null && <button onClick={onUndo} className="tap ui text-sm font-bold rounded-xl px-3.5 py-2 flex items-center gap-1.5 shrink-0" style={{ background: T.gold, color: T.ink }}>
          <RotateCcw size={15} /> {t("prim.undo")}
        </button>}
      </div>
    </div>
  );
}

/* Persistent, visible save-failure warning (handoff §4.1 / acceptance 6). */
export function SaveErrorBanner({ show, message }) {
  if (!show) return null;
  return (
    <div role="alert" className="ui flex items-center gap-2 px-4 py-2.5 text-[0.8125rem]" style={{ background: T.roseBg, color: T.rose }}>
      <AlertTriangle size={15} className="shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/* Typed confirmation for full reset (handoff §4.8). */
export function TypedConfirm({ open, word, onCancel, onConfirm }) {
  const t = useT();
  const [val, setVal] = React.useState("");
  useEffect(() => { if (open) setVal(""); }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6" style={{ background: "rgba(15,27,45,0.6)" }} role="dialog" aria-modal="true" aria-label={t("prim.eraseTitle")}>
      <div className="pop w-full max-w-sm rounded-2xl p-5" style={{ background: T.surface }}>
        <h3 className="disp text-lg mb-1" style={{ color: T.text }}>{t("prim.eraseTitle")}</h3>
        <p className="ui text-sm mb-3" style={{ color: T.sub }}>
          {t("prim.eraseBody")}<b>{word}</b>{t("prim.eraseToConfirm")}
        </p>
        <input value={val} onChange={(e) => setVal(e.target.value)} className={inputCls} style={inputStyle()} aria-label={t("prim.eraseAria", { word })} autoFocus />
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="tap ui flex-1 rounded-xl py-2.5 text-sm" style={{ border: `1px solid ${T.line}`, color: T.sub }}>{t("actions.cancel")}</button>
          <button
            onClick={onConfirm}
            disabled={val !== word}
            className="tap ui flex-1 rounded-xl py-2.5 text-sm font-semibold"
            style={{ background: val === word ? T.rose : T.line, color: val === word ? "#fff" : T.faint }}
          >
            {t("prim.eraseBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Error boundary with recovery export (handoff §4.7). */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("Pocket Ledger crashed:", error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    const t = makeT(uiLang());
    return (
      <div className="min-h-screen flex items-center justify-center p-6 ui" style={{ background: T.paper }}>
        <div className="w-full max-w-sm rounded-2xl p-6 text-center" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
          <h2 className="disp text-xl mb-2" style={{ color: T.text }}>{t("prim.crashTitle")}</h2>
          <p className="text-sm mb-4" style={{ color: T.sub }}>{t("prim.crashBody")}</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => location.reload()} className="tap rounded-xl py-3 text-sm font-semibold" style={{ background: T.ink, color: "#fff" }}>{t("prim.reload")}</button>
            <button onClick={() => this.props.onExportRecovery?.()} className="tap rounded-xl py-3 text-sm" style={{ border: `1px solid ${T.line}`, color: T.sub }}>{t("prim.exportRecovery")}</button>
          </div>
          <details className="mt-4 text-start">
            <summary className="text-xs cursor-pointer" style={{ color: T.faint }}>{t("prim.tech")}</summary>
            <pre className="text-[0.6875rem] mt-2 overflow-auto max-h-32" style={{ color: T.sub }}>{String(this.state.error?.stack || this.state.error)}</pre>
          </details>
        </div>
      </div>
    );
  }
}
