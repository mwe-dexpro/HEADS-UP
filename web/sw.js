/* ============================================================
   Service worker
   ------------------------------------------------------------
   Three jobs, and deliberately no fourth:

   1. Make the app installable and work offline.
   2. Show notifications. On Android `new Notification()` is not
      constructible, so the page asks this worker to do it —
      see NOTIFY below.
   3. Get out of the way when there is a new build.

   What it does NOT do is fire a reminder while the app is
   closed. That needs either the unshipped Notification Triggers
   API or Web Push with a server to push from, and this app is
   deployed to a static host with neither. See
   docs/LIMITATIONS.md — the in-app queue is always right, the
   push is only as timely as your next visit.

   __BUILD__ is replaced at build time with a hash of the bundle,
   so a new deploy gets a new cache and the old one is deleted.
   ============================================================ */

const VERSION = "__BUILD__";
const CACHE = `headsup-${VERSION}`;
const FONT_CACHE = "headsup-fonts";

/* Relative to the worker's own scope, so this works unchanged whether the app
   is at the root of a domain or under /repo-name/ on GitHub Pages. */
const SHELL = [
  "./",
  "./index.html",
  "./main.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
];

const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      /* One miss must not fail the whole install. */
      await Promise.allSettled(
        SHELL.map((url) => cache.add(new Request(url, { cache: "reload" }))),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (n) => n.startsWith("headsup-") && n !== CACHE && n !== FONT_CACHE,
          )
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

/* Network-first for our own files, cache-first for the webfonts.

   Network-first costs a round trip on a warm start and buys something worth
   more: a deploy is live on the next load, with no "why am I looking at
   yesterday's build" to debug. Offline still works, because every successful
   response updates the cache on its way past. */
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok && fresh.type !== "opaque")
      cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    if (request.mode === "navigate") {
      const shell = await cache.match("./index.html");
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const fresh = await fetch(request);
  /* Opaque cross-origin responses are cacheable and unreadable; that is fine
     for a font file the browser only ever hands back to the CSS engine. */
  if (fresh && (fresh.ok || fresh.type === "opaque"))
    cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(cacheFirst(request, FONT_CACHE).catch(() => fetch(request)));
    return;
  }
  if (url.origin !== self.location.origin) return;
  e.respondWith(networkFirst(request));
});

/* NOTIFY — the page hands a notification over rather than constructing one,
   because ServiceWorkerRegistration.showNotification is the only path that
   works on Android and it is the only path that survives the tab closing
   mid-flight. `data.url` is where a tap should land. */
self.addEventListener("message", (e) => {
  const msg = e.data;
  if (!msg || msg.type !== "NOTIFY") return;
  const { title, options } = msg;
  e.waitUntil(
    self.registration.showNotification(title, {
      badge: "./icons/icon-192.png",
      icon: "./icons/icon-192.png",
      ...options,
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL(
    (e.notification.data && e.notification.data.url) || "./",
    self.location.href,
  ).href;
  e.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        if (client.url.startsWith(self.registration.scope)) {
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
