import claude, { available as claudeOk } from "./claudeStorage.js";
import idb, { available as idbOk } from "./indexedDbStorage.js";
import local, { available as localOk } from "./localStorageFallback.js";

/* Storage adapter (handoff §4.1). Priority:
   1. window.storage inside Claude
   2. IndexedDB in a normal browser
   3. localStorage as final fallback
   Every successful save first preserves the previous value under `${key}:bak`
   (last-known-good), and failures surface through onError without crashing. */
export function pickBackend() {
  if (claudeOk()) return claude;
  if (idbOk()) return idb;
  if (localOk()) return local;
  return {
    name: "memory",
    _m: new Map(),
    async get(k) { return this._m.get(k) ?? null; },
    async set(k, v) { this._m.set(k, v); },
    async remove(k) { this._m.delete(k); },
  };
}

export function createStorage({ onError } = {}) {
  const backend = pickBackend();
  return {
    backendName: backend.name,
    async get(key) {
      try { return await backend.get(key); } catch (e) { onError?.("read", e); return null; }
    },
    async set(key, value) {
      try {
        const prev = await backend.get(key).catch(() => null);
        if (typeof prev === "string") await backend.set(`${key}:bak`, prev);
        await backend.set(key, value);
        return true;
      } catch (e) {
        onError?.("write", e);
        return false;
      }
    },
    async backup(key) {
      try { return await backend.get(`${key}:bak`); } catch { return null; }
    },
    async remove(key) {
      try { await backend.remove(key); await backend.remove(`${key}:bak`); } catch (e) { onError?.("remove", e); }
    },
    async dumpRaw(key) {
      try { return (await backend.get(key)) ?? (await backend.get(`${key}:bak`)); } catch { return null; }
    },
  };
}

export const STORAGE_KEY = "pfm:v3";
export const LEGACY_KEYS = ["pfm:v2", "pfm:data:v1"];
