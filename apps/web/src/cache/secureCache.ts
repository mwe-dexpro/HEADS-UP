// Offline read cache for task/event/list data — a cache, not the source of
// truth (the API is). Encrypted with AES-GCM using a non-extractable
// CryptoKey stored alongside the data in IndexedDB: in-origin code can still
// ask it to encrypt/decrypt (so offline reload works normally), but the raw
// key bytes can never be extracted — not via devtools, not by a malicious
// browser extension with storage access, not by copying the IndexedDB files
// off a stolen, unencrypted disk. It does NOT defend against an XSS payload
// running inside this same origin, which could call the same decrypt
// function the app does — the CSP (see vite.config.ts) is what's actually
// for that. See docs/THREAT-MODEL.md "Information disclosure".

const DB_NAME = "heads-up-cache";
const DB_VERSION = 1;
const KEY_STORE = "keys";
const DATA_STORE = "data";
const KEY_RECORD_ID = "cache-key";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE);
      if (!db.objectStoreNames.contains(DATA_STORE)) db.createObjectStore(DATA_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getOrCreateKey(db: IDBDatabase): Promise<CryptoKey> {
  const tx = db.transaction(KEY_STORE, "readonly");
  const existing = await reqToPromise<CryptoKey | undefined>(tx.objectStore(KEY_STORE).get(KEY_RECORD_ID));
  if (existing) return existing;

  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const writeTx = db.transaction(KEY_STORE, "readwrite");
  writeTx.objectStore(KEY_STORE).put(key, KEY_RECORD_ID);
  await new Promise<void>((resolve, reject) => {
    writeTx.oncomplete = () => resolve();
    writeTx.onerror = () => reject(writeTx.error);
  });
  return key;
}

export async function setCached(cacheKey: string, value: unknown): Promise<void> {
  const db = await openDb();
  const key = await getOrCreateKey(db);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  const tx = db.transaction(DATA_STORE, "readwrite");
  tx.objectStore(DATA_STORE).put({ iv, ciphertext }, cacheKey);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getCached<T>(cacheKey: string): Promise<T | null> {
  const db = await openDb();
  try {
    const key = await getOrCreateKey(db);
    const tx = db.transaction(DATA_STORE, "readonly");
    const record = await reqToPromise<{ iv: Uint8Array; ciphertext: ArrayBuffer } | undefined>(tx.objectStore(DATA_STORE).get(cacheKey));
    if (!record) return null;
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(record.iv) }, key, record.ciphertext);
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    // A corrupt record or a key that no longer decrypts it shouldn't crash
    // the app — it's a cache; the API is still the source of truth.
    return null;
  } finally {
    db.close();
  }
}

/** Wipes the cache (data and key) entirely — called on sign-out. */
export async function clearSecureCache(): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
