/* ============================================================
   window.storage — an IndexedDB shim
   ------------------------------------------------------------
   src/HeadsUp.jsx is written for a host that provides an async
   key/value API on window.storage. This is that host, for a
   plain browser.

   The contract, as the app uses it:

     await storage.get(key)          -> { value: String } | null
     await storage.set(key, value)    -> undefined
     await storage.delete(key)        -> undefined
     await storage.list()             -> [String]

   `set` takes a third argument in the artifact runtime, which
   this shim accepts and ignores.

   Never localStorage: the app's whole state is one JSON blob and
   it will outgrow the 5 MB quota once a real calendar is
   imported. IndexedDB has no such ceiling and is async, which
   the contract already assumes.
   ============================================================ */

const DB_NAME = "headsup";
const DB_VERSION = 1;
const STORE = "kv";

let openPromise = null;

function open() {
  if (openPromise) return openPromise;
  openPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available in this context"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    /* Another tab holding an older version open blocks the upgrade. */
    req.onblocked = () =>
      reject(
        new Error("IndexedDB upgrade blocked — close other tabs of this app"),
      );
  });
  return openPromise;
}

function tx(mode, run) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        t.onabort = () => reject(t.error);
        t.onerror = () => reject(t.error);
        t.oncomplete = () => resolve(req ? req.result : undefined);
      }),
  );
}

/* Sessions where IndexedDB is unavailable — Safari private browsing, some
   embedded webviews — fall back to memory. The app then warns on its own that
   changes stay for this session only, because `set` still resolves but nothing
   survives a reload. That is a deliberate downgrade, not a silent one: the
   console line below is the record. */
const memory = new Map();
let degraded = false;
function degrade(err) {
  if (!degraded) {
    degraded = true;
    console.warn(
      "[headsup] IndexedDB unavailable, falling back to in-memory storage — " +
        "nothing will persist across a reload.",
      err,
    );
  }
}

export const storage = {
  async get(key) {
    try {
      const value = await tx("readonly", (s) => s.get(key));
      return value === undefined ? null : { value };
    } catch (err) {
      degrade(err);
      return memory.has(key) ? { value: memory.get(key) } : null;
    }
  },
  async set(key, value) {
    try {
      await tx("readwrite", (s) => s.put(value, key));
    } catch (err) {
      degrade(err);
      memory.set(key, value);
    }
  },
  async delete(key) {
    try {
      await tx("readwrite", (s) => s.delete(key));
    } catch (err) {
      degrade(err);
      memory.delete(key);
    }
  },
  async list() {
    try {
      const keys = await tx("readonly", (s) => s.getAllKeys());
      return keys || [];
    } catch (err) {
      degrade(err);
      return [...memory.keys()];
    }
  },
};

export function installStorage() {
  if (!window.storage) window.storage = storage;
  return window.storage;
}
