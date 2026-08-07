/* ============================================================
   Service worker
   ------------------------------------------------------------
   Three jobs, and deliberately no fourth:

   1. Make the app installable and work offline.
   2. Show notifications. On Android `new Notification()` is not
      constructible, so the page asks this worker to do it —
      see NOTIFY below.
   3. Catch up on overdue reminders when the browser lets us run
      in the background — see CATCH-UP.
   4. Get out of the way when there is a new build.

   It still cannot fire a reminder *at* 08:00 while the app is
   closed. Nothing on the web can: Notification Triggers never
   shipped, and a worker is killed after ~30s idle so it cannot
   hold a timer. Periodic Background Sync is a coarse catch-up,
   not a scheduler. The Android build in android/ is the one that
   arrives on time. See docs/LIMITATIONS.md.

   __BUILD__ is replaced at build time with a hash of the bundle,
   so a new deploy gets a new cache and the old one is deleted.
   ============================================================ */

const VERSION = "__BUILD__";
const CACHE = `headsup-${VERSION}`;
const FONT_CACHE = "headsup-fonts";
/* Survives a new build on purpose: the queue and what we have already said are
   the user's, not the deploy's. */
const STATE_CACHE = "headsup-state";
const SCHEDULE_URL = "./__schedule";
const SHOWN_URL = "./__shown";
/* How many overdue reminders get their own notification before the rest are
   collapsed into one line. Nine separate buzzes is not a heads-up, it is a
   telling-off. */
const CATCHUP_SHOWN = 3;

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
            (n) =>
              n.startsWith("headsup-") &&
              n !== CACHE &&
              n !== FONT_CACHE &&
              n !== STATE_CACHE,
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

function show(title, options) {
  return self.registration.showNotification(title, {
    badge: "./icons/icon-192.png",
    icon: "./icons/icon-192.png",
    data: { url: "./" },
    ...options,
  });
}

async function readState(url) {
  try {
    const cache = await caches.open(STATE_CACHE);
    const hit = await cache.match(url);
    return hit ? await hit.json() : null;
  } catch (err) {
    return null;
  }
}
async function writeState(url, value) {
  const cache = await caches.open(STATE_CACHE);
  await cache.put(
    url,
    new Response(JSON.stringify(value), {
      headers: { "content-type": "application/json" },
    }),
  );
}

/* NOTIFY / SCHEDULE — the page hands notifications and the upcoming queue over
   rather than doing either itself. showNotification via the registration is the
   only path that works on Android, and the queue has to live somewhere the
   worker can read it when no page exists. */
self.addEventListener("message", (e) => {
  const msg = e.data;
  if (!msg) return;
  if (msg.type === "NOTIFY") {
    e.waitUntil(show(msg.title, msg.options));
    return;
  }
  if (msg.type === "SCHEDULE") {
    e.waitUntil(writeState(SCHEDULE_URL, msg.items || []));
    return;
  }
  /* Only used by the test harness and by a dev poking at it in the console;
     the real trigger is the periodicsync event below. */
  if (msg.type === "CATCHUP") {
    e.waitUntil(
      catchUp().then((n) => {
        if (e.ports && e.ports[0]) e.ports[0].postMessage({ shown: n });
      }),
    );
  }
});

/* CATCH-UP — show whatever fell due while nobody was looking.

   `shown` is this worker's own record, not the app's `state.notified`: writing
   into the app's blob from here would race its debounced save and could lose a
   completion. The two can therefore both decide to announce the same reminder —
   which is why every notification carries `tag: id`. Same tag replaces rather
   than stacks, so the user sees one line either way. */
async function catchUp() {
  const now = Date.now();
  const schedule = (await readState(SCHEDULE_URL)) || [];
  const shown = new Set((await readState(SHOWN_URL)) || []);
  const due = schedule.filter(
    (i) => !shown.has(i.id) && new Date(i.at).getTime() <= now,
  );
  if (!due.length) return 0;

  for (const item of due.slice(0, CATCHUP_SHOWN)) {
    await show(item.title, {
      body: item.body,
      tag: item.id,
      silent: !!item.silent,
    });
  }
  const rest = due.length - CATCHUP_SHOWN;
  if (rest > 0) {
    await show(`${rest} more reminder${rest === 1 ? "" : "s"} due`, {
      body: "Open Heads Up to see them.",
      tag: "headsup-overflow",
    });
  }
  await writeState(SHOWN_URL, [...shown, ...due.map((i) => i.id)].slice(-400));
  try {
    if (self.navigator.setAppBadge)
      await self.navigator.setAppBadge(due.length);
  } catch (err) {
    /* no badge here */
  }
  return due.length;
}

/* Chromium only, needs the app installed, and Chrome picks the moment with a
   twelve-hour floor. Late is the design; silent until Thursday is not. */
self.addEventListener("periodicsync", (e) => {
  if (e.tag !== "headsup-catchup") return;
  e.waitUntil(catchUp());
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
