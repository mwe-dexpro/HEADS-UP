/* ============================================================
   The schedule, on the web
   ------------------------------------------------------------
   The app hands us a flat list of what is due and when. We hand
   it to the service worker, which stores it and shows anything
   overdue whenever the browser lets it run.

   Read this before expecting too much of it:

   There is no way for a web app to wake itself at a chosen
   minute. Notification Triggers — the one API designed for
   exactly this — never shipped past an origin trial. A service
   worker is killed after about thirty seconds idle, so it cannot
   hold a timer either.

   Periodic Background Sync is what is left. It is Chromium-only,
   needs the app installed, and Chrome enforces a minimum of
   twelve hours between runs and decides for itself when they
   happen. So this is a *catch-up*, not a scheduler: a reminder
   due at 08:00 might be announced at 08:40 or at 15:00.

   It is still worth having. Without it, a reminder waits until
   you next open the app, which might be Thursday. For reminders
   that actually arrive on time, install the Android build — see
   README § On Android.
   ============================================================ */

/* Twelve hours is Chrome's floor; asking for less does not get you less. */
const MIN_INTERVAL = 12 * 60 * 60 * 1000;
const TAG = "headsup-catchup";

async function worker() {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.ready;
  return navigator.serviceWorker.controller || reg.active;
}

/* Passed to <HeadsUp onSchedule={…}>. Called whenever the queue changes, which
   is often — it is a postMessage, so that is cheap. */
export async function publishSchedule(items) {
  try {
    const w = await worker();
    if (w) w.postMessage({ type: "SCHEDULE", items });
  } catch (err) {
    /* No worker: the app still notifies while it is open. */
  }
}

export async function initBackgroundCatchup() {
  try {
    if (!("serviceWorker" in navigator)) return "unsupported";
    const reg = await navigator.serviceWorker.ready;
    if (!("periodicSync" in reg)) return "unsupported";

    /* Not a prompt — Chrome grants this on its own, from whether the app is
       installed and how much you use it. Asking tells us if it said yes. */
    const status = await navigator.permissions.query({
      name: "periodic-background-sync",
    });
    if (status.state !== "granted") return status.state;

    const tags = await reg.periodicSync.getTags();
    if (!tags.includes(TAG)) {
      await reg.periodicSync.register(TAG, { minInterval: MIN_INTERVAL });
    }
    return "granted";
  } catch (err) {
    return "unsupported";
  }
}
