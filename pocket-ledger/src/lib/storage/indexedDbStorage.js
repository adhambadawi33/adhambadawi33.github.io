/* IndexedDB key-value backend — primary persistence in a normal browser. */
const DB = "pocket-ledger", STORE = "kv";

export const available = () => typeof indexedDB !== "undefined";

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    t.oncomplete = () => resolve(req?.result ?? null);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export default {
  name: "indexeddb",
  async get(key) {
    const db = await open();
    try {
      const v = await tx(db, "readonly", (s) => s.get(key));
      return typeof v === "string" ? v : null;
    } finally { db.close(); }
  },
  async set(key, value) {
    const db = await open();
    try { await tx(db, "readwrite", (s) => s.put(value, key)); } finally { db.close(); }
  },
  async remove(key) {
    const db = await open();
    try { await tx(db, "readwrite", (s) => s.delete(key)); } finally { db.close(); }
  },
};
