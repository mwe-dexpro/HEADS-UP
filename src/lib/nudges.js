/* ============================================================
   The engine — Event × Task × Lead = one nudge
   ------------------------------------------------------------
   Invariant 3: nudges are pure and derived. Nothing in here is
   ever persisted, and `buildNudges(data)` has no side effects.
   Which is what lets a rename, a re-date or an undo show up on
   the next render with nothing to migrate.
   ============================================================ */

import { ACCENTS } from "./data.js";
import {
  addDays,
  alertChip,
  daysApart,
  minsOfClock,
  sameDay,
  startOfDay,
} from "./time.js";
import { dedupeBy } from "./util.js";

/* ---------- nudge engine ----------
   Quiet hours are a pure function of the computed due time, applied at the
   end of the calculation. They never touch the keys: doneKey and the snooze
   key are built from (event, task) and (days, hour), so moving a due time out
   of the quiet window can never orphan a completion.                      */
function applyQuiet(due, settings) {
  if (!settings || !settings.quiet) return due;
  const from = minsOfClock(settings.quietFrom || "22:00");
  const to = minsOfClock(settings.quietTo || "07:00");
  if (from === to) return due;
  const at = due.getHours() * 60 + due.getMinutes();
  const inside = from < to ? at >= from && at < to : at >= from || at < to;
  if (!inside) return due;
  const out = new Date(due);
  /* A window that wraps midnight pushes to the *next* morning when the due
     time is in the late-evening half of it. */
  if (from > to && at >= from) out.setDate(out.getDate() + 1);
  out.setHours(Math.floor(to / 60), to % 60, 0, 0);
  return out;
}

export function matchRules(event, rules) {
  const t = event.title.toLowerCase();
  return rules.filter(
    (r) =>
      r.enabled && r.keywords.some((k) => k && t.includes(k.toLowerCase())),
  );
}

export function buildNudges(data) {
  const { events, rules, state, settings } = data;
  const out = [];
  events.forEach((ev) => {
    if (state.muted && state.muted[ev.id]) return;
    const start = new Date(ev.start);
    const matched = matchRules(ev, rules);
    const tasks = [];
    matched.forEach((rule) =>
      rule.tasks.forEach((task) =>
        tasks.push({ rule: rule.name, ruleId: rule.id, task }),
      ),
    );
    (ev.tasks || []).forEach((task) =>
      tasks.push({ rule: "You added this one", ruleId: "custom", task }),
    );
    /* Plain calendar alerts — minutes before the start, not rungs of a ladder.
       They are pushed before the fallback check so an event that carries only
       alerts does not also collect a catch-all nudge (invariant 6). */
    (ev.alerts || []).forEach((mins) =>
      tasks.push({
        rule: "Alert on the event",
        ruleId: "alert",
        task: {
          id: `alert-${mins}`,
          label: ev.title,
          leads: [{ minutes: mins }],
        },
      }),
    );
    if (!tasks.length && settings.fallback) {
      tasks.push({
        rule: "No rule matched",
        ruleId: "fallback",
        task: {
          id: "fallback",
          label: "Heads up — anything to prepare?",
          leads: [
            { days: settings.defaultLead ?? 1, hour: settings.fallbackHour },
          ],
        },
      });
    }
    tasks.forEach(({ rule, ruleId, task }) => {
      const doneKey = `${ev.id}::${ruleId}::${task.id}`;
      const doneAt = state.done[doneKey];
      task.leads.forEach((lead) => {
        const isAlert = lead.minutes != null;
        let due;
        let snoozeKey;
        if (isAlert) {
          due = new Date(new Date(start).getTime() - lead.minutes * 60000);
          snoozeKey = `${doneKey}::m${lead.minutes}`;
        } else {
          due = startOfDay(start);
          due.setDate(due.getDate() - lead.days);
          due.setHours(lead.hour || 0, lead.minute || 0, 0, 0);
          /* Quiet hours move day-based rungs only. An alert measured in minutes
             from the start would land after its own event if shifted. */
          due = applyQuiet(due, settings);
          snoozeKey = `${doneKey}::${lead.days}:${lead.hour}`;
        }
        const snoozedTo = state.snoozed[snoozeKey];
        out.push({
          id: snoozeKey,
          doneKey,
          eventId: ev.id,
          eventTitle: ev.title,
          eventStart: ev.start,
          eventEnd: ev.end || null,
          allDay: ev.allDay,
          location: ev.location,
          cat: ev.cat || "personal",
          event: ev,
          ruleName: rule,
          label: task.label,
          lead: isAlert ? null : lead.days,
          alertMinutes: isAlert ? lead.minutes : null,
          dueAt: (snoozedTo ? new Date(snoozedTo) : due).toISOString(),
          baseDueAt: due.toISOString(),
          done: !!doneAt,
          doneAt: doneAt || null,
          snoozed: !!snoozedTo,
        });
      });
    });
  });
  out.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  return out;
}

/* ---------- to-do nudge engine ----------
   A second, independent source. buildNudges (events) is untouched; the two
   streams are merged and sorted by due time in allNudges(). A to-do's
   completion lives on the item itself, not in state.done — it is intrinsic
   data, not reminder state.                                              */
function resolveReminder(rem, anchorISO) {
  if (!rem) return null;
  if (rem.kind === "at") {
    const d = new Date(rem.at);
    return isNaN(d) ? null : d;
  }
  if (!anchorISO) return null;
  const d = startOfDay(new Date(anchorISO));
  d.setDate(d.getDate() - (rem.days || 0));
  d.setHours(rem.hour || 0, 0, 0, 0);
  return d;
}

function buildTodoNudges(data) {
  const { lists = [], state, settings } = data;
  const out = [];
  lists.forEach((list) => {
    (list.items || []).forEach((item) => {
      const emit = (owner, subId) => {
        const anchor = owner.due || (subId ? item.due : null);
        let rems = owner.reminders || [];
        if (!rems.length && anchor && settings.todoAutoRemind) {
          rems = [
            {
              kind: "lead",
              days: 0,
              hour: settings.todoAutoHour ?? 9,
              implicit: true,
            },
          ];
        }
        const base = `todo::${list.id}::${item.id}::${subId || "-"}`;
        rems.forEach((rem, i) => {
          let due = resolveReminder(rem, anchor);
          if (!due) return;
          if (rem.kind !== "at") due = applyQuiet(due, settings);
          const nid = `${base}::${i}`;
          const snoozedTo = state.snoozed[nid];
          out.push({
            kind: "todo",
            id: nid,
            doneKey: base,
            listId: list.id,
            listName: list.name,
            accent: list.accent || ACCENTS[0],
            itemId: item.id,
            subId: subId || null,
            label: owner.title,
            parentTitle: subId ? item.title : null,
            notes: subId ? "" : item.notes || "",
            anchor,
            lead: rem.kind === "lead" ? rem.days : null,
            implicit: !!rem.implicit,
            dueAt: (snoozedTo ? new Date(snoozedTo) : due).toISOString(),
            baseDueAt: due.toISOString(),
            done: !!(item.done || owner.done),
            doneAt: owner.doneAt || item.doneAt || null,
            snoozed: !!snoozedTo,
          });
        });
      };
      emit(item, null);
      (item.subtasks || []).forEach((st) => emit(st, st.id));
    });
  });
  return out;
}

export function allNudges(data) {
  return [...buildNudges(data), ...buildTodoNudges(data)].sort(
    (a, b) => new Date(a.dueAt) - new Date(b.dueAt),
  );
}

/* Events that appeared in the calendar and haven't been reviewed yet. */
export function unreviewedEvents(data, now) {
  const { settings, state, events } = data;
  if (!settings.watchNew) return [];
  const me = (settings.myEmail || "").trim().toLowerCase();
  return events
    .filter((e) => !state.seen[e.id])
    .filter((e) => new Date(e.start) >= startOfDay(now))
    .filter((e) => {
      if (!settings.watchOnlyOthers || !me) return true;
      if (!e.organizer || !e.organizer.email) return true;
      return e.organizer.email.toLowerCase() !== me;
    })
    .sort((a, b) => new Date(a.start) - new Date(b.start));
}

/* ---------- buckets ----------
   Home sorts by when a reminder is due, never by when its event happens.
   Everything already due collapses into one live band; the rest is bucketed
   by distance so the page can be scanned in one pass.                     */
export const BUCKETS = [
  ["today", "TODAY"],
  ["tomorrow", "TOMORROW"],
  ["week", "THIS WEEK"],
  ["later", "LATER"],
];

/* The last moment of the calendar week `d` falls in, honouring the same
   weekStart the calendar uses — so "this week" means one thing in the app. */
export function endOfWeek(d, weekStart) {
  const dow =
    weekStart === "sun" ? new Date(d).getDay() : (new Date(d).getDay() + 6) % 7;
  const end = addDays(d, 6 - dow);
  end.setHours(23, 59, 59, 999);
  return end;
}

/* THIS WEEK is the calendar week, not the next seven days. On a Saturday,
   something due the following Wednesday is not "this week" however few days
   away it is — it is LATER, and saying otherwise is the kind of small lie that
   makes a queue untrustworthy.

   A consequence worth knowing: late in the week THIS WEEK empties out and LATER
   grows. That is the honest shape of a calendar week, and the four buckets the
   design specifies have no NEXT WEEK to put it in. */
export function bucketOf(nudge, now, weekStart) {
  const due = new Date(nudge.dueAt);
  if (due <= now) return "now";
  if (sameDay(due, now)) return "today";
  if (sameDay(due, addDays(now, 1))) return "tomorrow";
  if (due <= endOfWeek(now, weekStart)) return "week";
  return "later";
}

/* ---------- runway ----------
   One event's whole ladder on a single track: every rung from the first
   heads-up to the event itself, with the ones already handled marked. Pure —
   it reads the nudge list it is handed and nothing else.                   */
export function buildRunway(nudges, events, now) {
  const byEvent = new Map();
  nudges.forEach((n) => {
    if (n.kind === "todo" || !n.eventId) return;
    if (new Date(n.eventStart) < startOfDay(now)) return;
    if (!byEvent.has(n.eventId)) byEvent.set(n.eventId, []);
    byEvent.get(n.eventId).push(n);
  });
  const candidates = [...byEvent.entries()]
    .map(([eventId, list]) => ({
      eventId,
      event: (events || []).find((e) => e.id === eventId) || list[0].event,
      /* One row per task, not per rung: two lead times on the same task are one
         thing to do, and marking either done clears both. The row sits at the
         task's earliest rung. */
      steps: dedupeBy(
        list
          .slice()
          .sort((a, b) => new Date(a.baseDueAt) - new Date(b.baseDueAt)),
        (n) => n.doneKey,
      ),
    }))
    .filter((c) => c.event && c.steps.length > 1)
    .sort((a, b) => new Date(a.event.start) - new Date(b.event.start));
  const pick = candidates[0];
  if (!pick) return null;

  const eventAt = new Date(pick.event.start);
  const first = new Date(pick.steps[0].baseDueAt);
  const span = Math.max(eventAt - first, 60000);
  const pct = (t) =>
    Math.max(0, Math.min(100, ((new Date(t) - first) / span) * 100));
  const ahead = pick.steps.filter((s) => !s.done).length;
  const daysLeft = Math.max(0, daysApart(eventAt, now));

  return {
    event: pick.event,
    nowPct: pct(now),
    daysLeft,
    ahead,
    steps: pick.steps.map((s) => ({
      nudge: s,
      lead: s.alertMinutes != null ? alertChip(s.alertMinutes) : `${s.lead}D`,
      left: pct(s.baseDueAt),
      state: s.done
        ? "HANDLED"
        : new Date(s.dueAt) <= now
          ? "DUE NOW"
          : "AHEAD",
    })),
  };
}
