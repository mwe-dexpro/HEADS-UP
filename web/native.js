/* ============================================================
   The schedule, on Android
   ------------------------------------------------------------
   This is the half that actually arrives on time.

   Capacitor's LocalNotifications plugin hands each reminder to
   Android's AlarmManager, which is the OS's own scheduler: it
   fires at the minute asked for, with the app closed, with no
   network, and with no server anywhere. `allowWhileIdle` is what
   stops Doze deferring it to the next maintenance window.

   In a browser `Capacitor.isNativePlatform()` is false and this
   module returns null, so the same bundle serves both targets and
   the web build falls back to schedule.js.
   ============================================================ */

import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

/* ---------- the hardware back button ----------
   Capacitor's own bridge does nothing with it: with no listener registered the
   press falls through to the Activity, which finishes, which quits the app —
   even with a sheet open over the page.

   The app keeps its open layers in session history (see `useSystemBack` in
   src/HeadsUp.jsx), and the WebView counts those entries, so `canGoBack` is
   exactly "something is open". Hand the press to history and the app closes one
   layer; at the root there is nothing left to close and leaving is right, but it
   has to be said explicitly, because registering this listener is what turned
   the default off. */
export function installHardwareBack() {
  if (!Capacitor.isNativePlatform()) return;
  App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else App.exitApp();
  }).catch((err) => {
    console.warn("[headsup] could not claim the hardware back button", err);
  });
}

/* Android notification ids are 32-bit ints; ours are strings like
   "evt-3f2::birthday::buy::10:9". Hash them, and keep it positive — a negative
   id is accepted and then silently never cancellable. */
function intId(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++)
    h = (((h << 5) + h) ^ str.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

/* The app republishes on every data change, which during a bulk edit is a lot.
   Alarms are OS-level bookkeeping, so coalesce before touching them. */
function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function nativeScheduler() {
  if (!Capacitor.isNativePlatform()) return null;

  let granted = null;

  async function ensurePermission() {
    if (granted !== null) return granted;
    try {
      let s = await LocalNotifications.checkPermissions();
      if (s.display === "prompt" || s.display === "prompt-with-rationale") {
        s = await LocalNotifications.requestPermissions();
      }
      granted = s.display === "granted";
    } catch (err) {
      granted = false;
    }
    return granted;
  }

  async function rewrite(items) {
    if (!(await ensurePermission())) return;
    try {
      /* Cancel everything we previously set, then lay down the current queue.
         Rewriting wholesale rather than diffing: the queue is at most sixty
         entries, and a diff that is subtly wrong leaves a ghost alarm for a
         reminder the user has already dealt with. */
      const pending = await LocalNotifications.getPending();
      if (pending.notifications && pending.notifications.length) {
        await LocalNotifications.cancel({
          notifications: pending.notifications,
        });
      }

      const now = Date.now();
      const notifications = items
        .filter((i) => new Date(i.at).getTime() > now + 1000)
        .map((i) => ({
          id: intId(i.id),
          title: i.title,
          body: i.body,
          schedule: { at: new Date(i.at), allowWhileIdle: true },
          /* extra travels back to us on tap, so a future version can open
             straight to the reminder rather than to Home. */
          extra: { nudgeId: i.id },
        }));
      if (notifications.length)
        await LocalNotifications.schedule({ notifications });
    } catch (err) {
      console.warn("[headsup] could not reschedule local notifications", err);
    }
  }

  return {
    init: ensurePermission,
    publish: debounce(rewrite, 600),
  };
}
