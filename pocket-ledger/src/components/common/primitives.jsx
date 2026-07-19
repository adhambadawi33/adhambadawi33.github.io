import React, { useEffect, useRef } from "react";
import { X, Delete, AlertTriangle, RotateCcw } from "lucide-react";
import { T, fmtMoney, inputCls, inputStyle } from "../../styles/tokens.js";

export const Money = ({ n, cur, hide, color, className = "" }) => (
  <span className={`mono ${className}`} style={{ color: color || T.text }}>
    {fmtMoney(n, cur, hide)}
  </span>
);

/* Bottom sheet with dialog semantics (handoff §6.3): role=dialog, Escape to
   close, initial focus into the panel, focus restored to the opener. */
export function Sheet({ open, onClose, title, children, tall }) {
  const panel = useRef(null);
  const opener = useRef(null);
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    panel.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
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
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(15,27,45,0.5)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-t-3xl overflow-hidden slide-up flex flex-col outline-none ${tall ? "h-[94%]" : "max-h-[88%]"}`}
        style={{ background: T.surface }}
      >
        <div className="shrink-0 flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${T.line}` }}>
          <h2 className="disp text-lg" style={{ color: T.text }}>{title}</h2>
          <button onClick={onClose} className="tap h-10 w-10 rounded-full flex items-center justify-center" style={{ background: T.paper, color: T.sub }} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4" style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export const Field = ({ label, children }) => (
  <div className="mb-3.5">
    <label className="ui text-[11px] uppercase tracking-wider block mb-1.5" style={{ color: T.faint }}>{label}</label>
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
            className="tap ui rounded-xl px-3.5 py-2.5 text-sm flex items-center gap-1.5"
            style={on ? { background: T.ink, color: "#fff" } : { background: T.paper, color: T.sub, border: `1px solid ${T.line}` }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const Bar = ({ pct, color }) => (
  <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: T.paper }}>
    <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color, transition: "width .4s ease" }} />
  </div>
);

export const Section = ({ title, right, children }) => (
  <div className="mb-6">
    <div className="flex items-center justify-between mb-2.5 px-0.5">
      <h3 className="ui text-[13px] font-semibold tracking-wide" style={{ color: T.sub }}>{title}</h3>
      {right}
    </div>
    {children}
  </div>
);

export const CardBox = ({ children, className = "", style = {} }) => (
  <div className={`rounded-2xl ${className}`} style={{ background: T.surface, border: `1px solid ${T.line}`, ...style }}>
    {children}
  </div>
);

export const EmptyHint = ({ icon, text, cta, onClick }) => (
  <CardBox className="px-5 py-8 text-center">
    <div className="flex justify-center mb-2" style={{ color: T.faint }}>{icon}</div>
    <p className="ui text-sm" style={{ color: T.sub }}>{text}</p>
    {cta && (
      <button onClick={onClick} className="tap ui mt-3 rounded-xl px-4 py-2.5 text-sm font-medium" style={{ background: T.ink, color: "#fff" }}>
        {cta}
      </button>
    )}
  </CardBox>
);

export function Numpad({ value, onChange }) {
  const press = (k) => {
    if (k === "back") return onChange(value.slice(0, -1));
    if (k === "." && value.includes(".")) return;
    if (k === "." && value === "") return onChange("0.");
    const next = value + k;
    if (/^\d{0,9}(\.\d{0,2})?$/.test(next)) onChange(next);
  };
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Amount keypad">
      {keys.map((k) => (
        <button
          key={k}
          onClick={() => press(k)}
          className="tap mono rounded-2xl py-3.5 text-xl flex items-center justify-center select-none"
          style={{ background: T.paper, color: T.text, border: `1px solid ${T.line}` }}
          aria-label={k === "back" ? "Delete last digit" : k}
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
  if (!toast) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-[70] w-[92%] max-w-md" style={{ bottom: "calc(88px + env(safe-area-inset-bottom))" }} role="status" aria-live="polite">
      <div className="pop flex items-center gap-3 rounded-2xl px-4 py-3.5" style={{ background: T.ink, color: "#fff", border: `1.5px solid ${T.gold}`, boxShadow: "0 8px 24px rgba(15,27,45,0.35)" }}>
        <span className="ui text-sm flex-1">{toast.label}</span>
        <button onClick={onUndo} className="tap ui text-sm font-bold rounded-xl px-3.5 py-2 flex items-center gap-1.5 shrink-0" style={{ background: T.gold, color: T.ink }}>
          <RotateCcw size={15} /> Undo
        </button>
      </div>
    </div>
  );
}

/* Persistent, visible save-failure warning (handoff §4.1 / acceptance 6). */
export function SaveErrorBanner({ show, message }) {
  if (!show) return null;
  return (
    <div role="alert" className="ui flex items-center gap-2 px-4 py-2.5 text-[13px]" style={{ background: T.roseBg, color: T.rose }}>
      <AlertTriangle size={15} className="shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/* Typed confirmation for full reset (handoff §4.8). */
export function TypedConfirm({ open, word, onCancel, onConfirm }) {
  const [val, setVal] = React.useState("");
  useEffect(() => { if (open) setVal(""); }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6" style={{ background: "rgba(15,27,45,0.6)" }} role="dialog" aria-modal="true" aria-label="Confirm reset">
      <div className="pop w-full max-w-sm rounded-2xl p-5" style={{ background: T.surface }}>
        <h3 className="disp text-lg mb-1" style={{ color: T.text }}>Erase everything?</h3>
        <p className="ui text-sm mb-3" style={{ color: T.sub }}>
          This deletes all accounts, transactions, plans and debts. Export a backup first if unsure. Type <b>{word}</b> to confirm.
        </p>
        <input value={val} onChange={(e) => setVal(e.target.value)} className={inputCls} style={inputStyle} aria-label={`Type ${word} to confirm`} autoFocus />
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="tap ui flex-1 rounded-xl py-2.5 text-sm" style={{ border: `1px solid ${T.line}`, color: T.sub }}>Cancel</button>
          <button
            onClick={onConfirm}
            disabled={val !== word}
            className="tap ui flex-1 rounded-xl py-2.5 text-sm font-semibold"
            style={{ background: val === word ? T.rose : T.line, color: val === word ? "#fff" : T.faint }}
          >
            Erase all data
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
    return (
      <div className="min-h-screen flex items-center justify-center p-6 ui" style={{ background: T.paper }}>
        <div className="w-full max-w-sm rounded-2xl p-6 text-center" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
          <h2 className="disp text-xl mb-2" style={{ color: T.text }}>Something went wrong</h2>
          <p className="text-sm mb-4" style={{ color: T.sub }}>Your data is safe in storage. Reload to continue, or export a recovery copy first.</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => location.reload()} className="tap rounded-xl py-3 text-sm font-semibold" style={{ background: T.ink, color: "#fff" }}>Reload app</button>
            <button onClick={() => this.props.onExportRecovery?.()} className="tap rounded-xl py-3 text-sm" style={{ border: `1px solid ${T.line}`, color: T.sub }}>Export recovery data</button>
          </div>
          <details className="mt-4 text-left">
            <summary className="text-xs cursor-pointer" style={{ color: T.faint }}>Technical details</summary>
            <pre className="text-[10px] mt-2 overflow-auto max-h-32" style={{ color: T.sub }}>{String(this.state.error?.stack || this.state.error)}</pre>
          </details>
        </div>
      </div>
    );
  }
}
