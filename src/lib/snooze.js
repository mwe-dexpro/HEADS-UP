/* Snooze offers three durations and, after the working day, tomorrow morning.
   Both the home cards and the quick-action menu read this, so the options a
   swipe leads to and the options a long press shows can never drift apart. */

import { addDays, fmtTime, sameDay } from "./time.js";

export function snoozeOptions(now, settings) {
  const durations = {
    "15m": [0.25, "For 15 minutes"],
    "1h": [1, "For 1 hour"],
    "3h": [3, "For 3 hours"],
  };
  const pick = durations[settings.defaultSnooze] || durations["3h"];
  const evening = new Date(now);
  evening.setHours(18, 0, 0, 0);
  const morning = addDays(now, 1);
  morning.setHours(7, 0, 0, 0);
  return [
    { label: pick[1], at: new Date(now.getTime() + pick[0] * 3600000) },
    { label: "This evening", at: evening },
    { label: "Tomorrow morning", at: morning },
  ].filter((o) => o.at > now);
}

export function snoozeAtLabel(at, now) {
  if (sameDay(at, now)) return fmtTime(at);
  return `${at.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()} ${fmtTime(at)}`;
}
