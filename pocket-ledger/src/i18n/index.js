import en from "./en.js";
import ar from "./ar.js";

/* i18n foundation (handoff §6.4). English default (Decision B); core chrome is
   wired now, full copy coverage lands in Phase 2. */
const dicts = { en, ar };

export function makeT(lang) {
  const d = dicts[lang] || en;
  return (path) => path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), d)
    ?? path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : path), en);
}
export const applyDir = (lang) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }
};
