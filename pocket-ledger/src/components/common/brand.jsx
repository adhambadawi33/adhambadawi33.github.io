import React from "react";
import { T } from "../../styles/tokens.js";
import { bankFor, networkFor, subBrandFor } from "../../lib/brands.js";

/* Network marks — Visa wordmark / Mastercard interlocking circles. */
export const VisaMark = ({ size = 8 }) => (
  <span className="ui" style={{ fontWeight: 800, fontStyle: "italic", fontSize: size, color: "#1A1F71", letterSpacing: ".02em" }} aria-label="Visa">VISA</span>
);
export const McMark = ({ size = 10 }) => (
  <span className="inline-flex relative" style={{ width: size * 1.6, height: size }} aria-label="Mastercard">
    <span className="absolute rounded-full" style={{ left: 0, top: 0, width: size, height: size, background: "#EB001B" }} />
    <span className="absolute rounded-full" style={{ right: 0, top: 0, width: size, height: size, background: "#F79E1B", mixBlendMode: "multiply" }} />
  </span>
);

/* Square badge with the bank's wordmark; null when the bank isn't known
   (caller falls back to its generic icon). */
export function BankMark({ name, size = 24, radius = 8 }) {
  const b = bankFor(name);
  if (!b) return null;
  return (
    <span
      className="flex items-center justify-center shrink-0"
      style={{ width: size, height: size, borderRadius: radius, background: "#fff", border: `1px solid ${T.line}`, boxShadow: "0 1px 2px rgba(30,40,28,.08)" }}
      aria-hidden="true"
    >
      <span className="ui" style={{ fontWeight: 800, fontSize: Math.max(6.5, size * 0.3), color: b.color, borderBottom: `2px solid ${b.accent}`, lineHeight: 1.4 }}>{b.label}</span>
    </span>
  );
}

/* Mini-card chip for credit cards: issuing bank wordmark + network corner.
   Distinguishes a CARD from a bank ACCOUNT at a glance (design w/ Adham). */
export function CardChip({ account, width = 38 }) {
  const bank = bankFor(account?.bank || account?.name);
  const net = networkFor(account);
  const h = Math.round(width * 0.66);
  return (
    <span
      className="relative shrink-0 block"
      style={{ width, height: h, borderRadius: Math.round(width * 0.14), background: "#fff", border: `1px solid ${T.line}`, boxShadow: "0 1px 3px rgba(30,40,28,.12)" }}
      aria-hidden="true"
    >
      <span className="absolute" style={{ top: Math.round(h * 0.14), insetInlineStart: Math.round(width * 0.1) }}>
        {bank
          ? <span className="ui" style={{ fontWeight: 800, fontSize: Math.max(6, width * 0.16), color: bank.color, lineHeight: 1 }}><span style={{ color: bank.accent }}>◆</span>{bank.label}</span>
          : <span className="ui" style={{ fontWeight: 800, fontSize: Math.max(6, width * 0.16), color: T.sub, lineHeight: 1 }}>{(account?.name || "").slice(0, 4).toUpperCase()}</span>}
      </span>
      <span className="absolute" style={{ bottom: Math.round(h * 0.1), insetInlineEnd: Math.round(width * 0.09), lineHeight: 1 }}>
        {net === "visa" && <VisaMark size={Math.max(5.5, width * 0.14)} />}
        {net === "mastercard" && <McMark size={Math.max(6, width * 0.16)} />}
      </span>
    </span>
  );
}

/* Subscription logo: known brand chip, else a letter avatar on the tint. */
export function SubLogo({ name, size = 38, tintBg, tintColor }) {
  const b = subBrandFor(name);
  const r = Math.round(size * 0.28);
  if (!b) {
    return (
      <span className="flex items-center justify-center shrink-0 ui font-semibold" style={{ width: size, height: size, borderRadius: r, background: tintBg || T.paper, color: tintColor || T.sub, fontSize: size * 0.4 }} aria-hidden="true">
        {(String(name || "?").trim()[0] || "?").toUpperCase()}
      </span>
    );
  }
  return (
    <span
      className={`flex items-center justify-center shrink-0 ${b.serif ? "disp" : "ui"}`}
      style={{ width: size, height: size, borderRadius: r, background: b.bg, color: b.fg, fontWeight: 800, fontSize: b.small ? size * 0.24 : size * 0.45 }}
      aria-hidden="true"
    >
      {b.ch}
    </span>
  );
}
