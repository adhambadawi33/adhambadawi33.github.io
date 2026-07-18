/* Claude artifact storage (window.storage) — normalizes its {key,value} envelope. */
export const available = () =>
  typeof window !== "undefined" && !!window.storage && typeof window.storage.get === "function";

export default {
  name: "claude",
  async get(key) {
    try {
      const res = await window.storage.get(key);
      return res && typeof res.value === "string" ? res.value : null;
    } catch {
      return null; // missing keys throw in Claude storage
    }
  },
  async set(key, value) {
    const res = await window.storage.set(key, value);
    if (!res) throw new Error("claude-storage-set-failed");
  },
  async remove(key) {
    try { await window.storage.delete(key); } catch { /* already gone */ }
  },
};
