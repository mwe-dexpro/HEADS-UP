/* Posting a notification while the app is open. What arrives when it is closed
   is the host's business, not this file's — see the schedule seam. */

import { fmtDate, relative } from "./time.js";

/* ---------- notifications ----------
   `new Notification()` is not constructible on Android — it throws — so the
   only path that works on the most common install target is the service
   worker's registration. Hand the worker the title and body and let it supply
   its own icon and badge; it owns those paths, not the app.

   The direct constructor stays as the fallback, because the artifact runtime
   this file also has to run in has no worker at all. */
export async function notify(title, options) {
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      const worker = navigator.serviceWorker.controller || (reg && reg.active);
      if (worker) {
        worker.postMessage({ type: "NOTIFY", title, options });
        return true;
      }
    }
  } catch (e) {
    /* fall through to the constructor */
  }
  try {
    new Notification(title, options);
    return true;
  } catch (e) {
    return false;
  }
}

/* The second line of a reminder, as the notification says it.
   `at` is the moment the words will be read: for one firing now that is now,
   but for a scheduled one it is its own due time, or a notification handed to
   the OS today would still claim the flight is "in 2 days" when it fires
   tomorrow. */
export function notifyBody(n, at) {
  return n.kind === "todo"
    ? `${n.listName}${n.anchor ? ` — needed ${fmtDate(n.anchor)}` : ""}`
    : `${n.eventTitle} — ${relative(n.eventStart, at)}`;
}
