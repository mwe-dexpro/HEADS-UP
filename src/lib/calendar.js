/* The calendar's fixed geometry and the labels its grids repeat. The day
   starts at 06:00 and ends at 23:00 because a 24-hour column on a phone is
   mostly empty hours nobody scrolls to. */

import { addDays, fmtTime } from "./time.js";

export const CAL_START_H = 6;

export const CAL_END_H = 23;

export const CAL_PX = 44;

export const CAL_H = (CAL_END_H - CAL_START_H) * CAL_PX;

export const CAL_VIEWS = [
  ["list", "LIST"],
  ["month", "MONTH"],
  ["week", "WEEK"],
  ["work", "WORK"],
  ["day3", "3 DAY"],
];

export const minsOfDate = (d) =>
  new Date(d).getHours() * 60 + new Date(d).getMinutes();

export const timeLabel = (e) =>
  e.allDay
    ? "ALL DAY"
    : `${fmtTime(e.start)}${e.end ? `–${fmtTime(e.end)}` : ""}`;

export function weekStartOf(d, weekStart) {
  const dow =
    weekStart === "sun" ? new Date(d).getDay() : (new Date(d).getDay() + 6) % 7;
  return addDays(d, -dow);
}
