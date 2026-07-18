/* localStorage — final fallback only (handoff §4.1). */
export const available = () => {
  try {
    const k = "__pl_probe__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch { return false; }
};

export default {
  name: "localstorage",
  async get(key) { return localStorage.getItem(key); },
  async set(key, value) { localStorage.setItem(key, value); },
  async remove(key) { localStorage.removeItem(key); },
};
