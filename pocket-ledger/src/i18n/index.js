import { createContext, useContext } from "react";
import en from "./en.js";
import ar from "./ar.js";

/* i18n: `useT()` inside components; `t(path, vars)` interpolates {vars}.
   Non-React helpers (dates, category labels) read the module-level language,
   which App sets before rendering so both stay in step. */
const dicts = { en, ar };
let currentLang = "en";
export const setUiLang = (lang) => { currentLang = lang === "ar" ? "ar" : "en"; };
export const uiLang = () => currentLang;
export const dateLocale = () => (currentLang === "ar" ? "ar-EG-u-nu-latn" : "en-US");

const lookup = (d, path) => path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), d);
const fill = (s, vars) => (vars ? String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`)) : s);

export function makeT(lang) {
  const d = dicts[lang] || en;
  return (path, vars) => {
    const hit = lookup(d, path) ?? lookup(en, path) ?? path;
    return fill(hit, vars);
  };
}
export const I18nContext = createContext(makeT("en"));
export const useT = () => useContext(I18nContext);

/* Category names are data keys ("Food & Dining"); show them in the UI language. */
export const catLabel = (name) => (currentLang === "ar" ? ar.cats[name] || name : name);
export const ownerLabel = (id) => lookup(dicts[currentLang], `owners.${id}`) || lookup(en, `owners.${id}`) || id;

export const applyDir = (lang) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }
};
