/* One-time hints: shown the first N times, then never. Device-local. */
const KEY = "pl:hints";
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
export function hintSeen(name) { return read()[name] || 0; }
export function bumpHint(name) {
  try { const h = read(); h[name] = (h[name] || 0) + 1; localStorage.setItem(KEY, JSON.stringify(h)); } catch { /* private mode */ }
}
export function dismissHint(name) {
  try { const h = read(); h[name] = 999; localStorage.setItem(KEY, JSON.stringify(h)); } catch { /* noop */ }
}
