// Minimal offline shell — hand-written rather than a generated precache
// manifest (no build-time hash list yet; see docs/ROADMAP.md — Phase 2 is
// the natural point to revisit this once the real app shell exists).
// Network-first for same-origin GETs: a deploy is live on next load, and a
// successful response still updates the cache on its way past, so offline
// keeps working — same trade-off the prior "Ladder" build made (its own
// ADR-024) and for the same reason: staring at a stale build with no way to
// force a reload is the worse failure mode for a one-developer app.
const CACHE_NAME = "heads-up-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req)),
  );
});
