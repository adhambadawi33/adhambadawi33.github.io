import { describe, it, expect, beforeEach } from "vitest";
import { createStorage, STORAGE_KEY } from "../lib/storage/adapter.js";

/* jsdom provides localStorage; indexedDB is absent, window.storage is absent —
   so the adapter must fall back to localStorage (priority chain §4.1). */
describe("storage adapter", () => {
  beforeEach(() => localStorage.clear());

  it("falls back to localStorage in a plain environment", async () => {
    const s = createStorage();
    expect(s.backendName).toBe("localstorage");
    await s.set("k", "v1");
    expect(await s.get("k")).toBe("v1");
  });

  it("keeps a last-known-good backup on every overwrite", async () => {
    const s = createStorage();
    await s.set(STORAGE_KEY, JSON.stringify({ a: 1 }));
    await s.set(STORAGE_KEY, JSON.stringify({ a: 2 }));
    expect(JSON.parse(await s.get(STORAGE_KEY)).a).toBe(2);
    expect(JSON.parse(await s.backup(STORAGE_KEY)).a).toBe(1);
  });

  it("surfaces write failures through onError instead of crashing", async () => {
    const errors = [];
    const s = createStorage({ onError: (op) => errors.push(op) });
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("QuotaExceeded"); };
    const ok = await s.set("k", "v");
    Storage.prototype.setItem = orig;
    expect(ok).toBe(false);
    expect(errors).toContain("write");
  });

  it("dumpRaw recovers from the backup when the main key is gone", async () => {
    const s = createStorage();
    await s.set(STORAGE_KEY, "GOOD");
    await s.set(STORAGE_KEY, "NEWER");
    localStorage.removeItem(STORAGE_KEY); // simulate main-key corruption/loss
    expect(await s.dumpRaw(STORAGE_KEY)).toBe("GOOD");
  });
});
