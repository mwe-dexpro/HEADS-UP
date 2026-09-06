import { beforeEach, describe, expect, it } from "vitest";
import { clearSecureCache, getCached, setCached } from "./secureCache.js";

// Mirrors the private constants in secureCache.ts — needed here only to
// reach into the same IndexedDB database/store for the corruption test
// below, which has no other way to simulate a tampered record.
const DB_NAME = "heads-up-cache";
const DATA_STORE = "data";

beforeEach(async () => {
  await clearSecureCache();
});

describe("setCached / getCached", () => {
  it("round-trips a value through encryption", async () => {
    await setCached("greeting", { hello: "world" });
    await expect(getCached("greeting")).resolves.toEqual({ hello: "world" });
  });

  it("returns null for a key that was never cached", async () => {
    await expect(getCached("nope")).resolves.toBeNull();
  });

  it("clearSecureCache wipes previously cached data", async () => {
    await setCached("k", { x: 1 });
    await clearSecureCache();
    await expect(getCached("k")).resolves.toBeNull();
  });

  it("returns null instead of throwing for a tampered (undecryptable) record", async () => {
    await setCached("k", { x: 1 });

    // Reach into the same IndexedDB store and corrupt the stored ciphertext
    // directly — simulates on-disk corruption or a key that no longer
    // matches, which secureCache.ts is documented to survive as a cache
    // miss rather than a crash.
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DATA_STORE, "readwrite");
      tx.objectStore(DATA_STORE).put({ iv: new Uint8Array(12), ciphertext: new Uint8Array([1, 2, 3, 4]) }, "k");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    await expect(getCached("k")).resolves.toBeNull();
  });

  // Regression test for docs/DECISIONS.md ADR-024: the first-use
  // get-or-create of the AES-GCM key has to be atomic. Two calls racing on
  // a virgin cache (e.g. two tabs of the same origin loading at once) must
  // not let one silently generate-and-store a second key that orphans data
  // already encrypted under the first — every concurrent writer's own data
  // must remain readable afterward.
  it("survives two concurrent first-use writes without corrupting either one", async () => {
    await Promise.all([setCached("a", { from: "first" }), setCached("b", { from: "second" })]);

    await expect(getCached("a")).resolves.toEqual({ from: "first" });
    await expect(getCached("b")).resolves.toEqual({ from: "second" });
  });

  it("survives many concurrent first-use writes on a virgin cache", async () => {
    const entries = Array.from({ length: 10 }, (_, i) => [`key-${i}`, { i }] as const);
    await Promise.all(entries.map(([key, value]) => setCached(key, value)));

    for (const [key, value] of entries) {
      await expect(getCached(key)).resolves.toEqual(value);
    }
  });
});
