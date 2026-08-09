/* ============================================================
   HEADS UP — lead-time reminders for calendar events
   Model: Event × Task × Lead = one nudge.
   "Done" is recorded per (event, task) and cancels every lead.

   Presentation follows the "Ladder" direction: clinical paper —
   warm off-white ground, ink type, one amber reserved exclusively
   for live. Reminders are ledger rows — full-bleed, hairline-
   separated — and live is said with an amber rail and band, never
   with a fill. Labels are mono small-caps in fixed positions;
   every card scans in one order.
   ------------------------------------------------------------
   This file is the shell: it owns the state, the storage, the
   schedule it publishes, the back stack, and the frame the
   surfaces render into. It holds no layout of its own beyond that
   frame — a surface goes in `.lx-scroll`, a sheet goes above it,
   and both are told what to do by callback.

   The tree it sits on assumes only React 18 and an async
   `window.storage`; see docs/ARCHITECTURE.md "The host contract".
   ============================================================ */

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { SCHEDULE_DAYS, SCHEDULE_MAX, STORE_KEY } from "./lib/config.js";
import { defaultData, loadData, nextAccent } from "./lib/data.js";
import { notify, notifyBody } from "./lib/notify.js";
import {
  allNudges,
  bucketOf,
  buildRunway,
  unreviewedEvents,
} from "./lib/nudges.js";
import { ruleWarnings } from "./lib/rules.js";
import { snoozeAtLabel } from "./lib/snooze.js";
import {
  addDays,
  capDate,
  clockOfMins,
  dateInputValue,
  hhmm,
  minsOfClock,
  sameDay,
  startOfDay,
} from "./lib/time.js";
import { uid } from "./lib/util.js";
import { EventSheet } from "./sheets/EventSheet.jsx";
import { ListSheet } from "./sheets/ListSheet.jsx";
import { QuickActions } from "./sheets/QuickActions.jsx";
import { Settings } from "./sheets/Settings.jsx";
import { TodoSheet } from "./sheets/TodoSheet.jsx";
import { CalendarTab } from "./surfaces/Calendar.jsx";
import { Home } from "./surfaces/Home.jsx";
import { BulkBar, ListDetail, ListsOverview } from "./surfaces/Lists.jsx";
import { Rules } from "./surfaces/Rules.jsx";
import { StatusBar, TabIcon, useNow } from "./ui/atoms.jsx";
import { CSS } from "./ui/css.js";
import { useSwipe, useSystemBack } from "./ui/gestures.js";

const TABS = [
  ["home", "Home", "upcoming"],
  ["lists", "Lists", "lists"],
  ["calendar", "Calendar", "calendar"],
  ["rules", "Rules", "rules"],
];

/* `onSchedule` is the seam between the app and whatever can wake a device.
   It is optional: the artifact runtime passes nothing and the app behaves
   exactly as before. In the browser the service worker consumes it; in the
   Capacitor build the OS alarm scheduler does. Neither is named here — see
   docs/ARCHITECTURE.md "The host contract". */
export default function HeadsUp({ onSchedule }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("home");
  const [warn, setWarn] = useState("");
  const [notifyState, setNotifyState] = useState("unknown");
  const now = useNow();
  const saveTimer = useRef(null);

  /* overlays and sub-routes, held here so they can sit above the tab bar */
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [listId, setListId] = useState(null);
  const [openTodo, setOpenTodo] = useState(null);
  const [sel, setSel] = useState([]);
  const [bulkPanel, setBulkPanel] = useState(null);
  const [evOpen, setEvOpen] = useState(null);
  const [evEdit, setEvEdit] = useState(false);
  const [draft, setDraft] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [calSeed, setCalSeed] = useState(null);
  /* The long-press menu for a ledger row, and the list naming sheet. Both are
     held by id rather than by object: everything they describe is derived on
     every render, so a stored copy would go stale the moment it is edited. */
  const [quickId, setQuickId] = useState(null);
  const [listEdit, setListEdit] = useState(null);

  useEffect(() => {
    let alive = true;
    loadData().then((d) => {
      if (alive) setData(d || defaultData());
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    try {
      if (typeof Notification !== "undefined")
        setNotifyState(Notification.permission);
      else setNotifyState("unsupported");
    } catch (e) {
      setNotifyState("unsupported");
    }
  }, []);

  const persist = useCallback((next) => {
    setData(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await window.storage.set(STORE_KEY, JSON.stringify(next), false);
      } catch (e) {
        setWarn("Couldn't save — changes stay for this session only.");
      }
    }, 400);
  }, []);

  /* Destructive actions snapshot the whole state object, so undo is a single
     restore rather than an inverse operation per action type. The consequence
     is that undo reverts everything since the snapshot, not just the deletion. */
  const [undoTip, setUndoTip] = useState(null);
  const undoTimer = useRef(null);
  const undoable = useCallback(
    (next, label, meta) => {
      setUndoTip({ label, meta: meta || "", snapshot: data, at: Date.now() });
      persist(next);
    },
    [data, persist],
  );
  useEffect(() => {
    if (!undoTip) return undefined;
    undoTimer.current = setTimeout(() => setUndoTip(null), 9000);
    return () => clearTimeout(undoTimer.current);
  }, [undoTip]);
  const runUndo = () => {
    if (!undoTip) return;
    persist(undoTip.snapshot);
    setUndoTip(null);
  };

  /* "Ask before deleting" is off by default — undo is cheaper than a dialog —
     but when it is on every destructive path funnels through here. */
  const guard = (label, run) => {
    if (data && data.settings.confirmDelete) setConfirm({ label, run });
    else run();
  };

  const nudges = useMemo(() => (data ? allNudges(data) : []), [data]);
  const unreviewed = useMemo(
    () => (data ? unreviewedEvents(data, now) : []),
    [data, now],
  );

  const { live, queued, handled, counts, runway } = useMemo(() => {
    if (!data)
      return {
        live: [],
        queued: [],
        handled: [],
        counts: { now: 0, today: 0, week: 0 },
        runway: null,
      };
    const active = nudges
      .filter((n) => !n.done)
      .map((n) => ({
        ...n,
        bucket: bucketOf(n, now, data.settings.weekStart),
      }));
    /* Two overdue rungs of one ladder are one thing to do, not two. Marking
       either done clears both, so the live band shows the earliest only. */
    const seen = new Set();
    const liveList = [];
    active
      .filter((n) => n.bucket === "now")
      .forEach((n) => {
        if (seen.has(n.doneKey)) return;
        seen.add(n.doneKey);
        liveList.push(n);
      });
    const doneSeen = new Set();
    const handledList = nudges
      .filter((n) => n.done)
      .filter((n) => !n.doneAt || sameDay(n.doneAt, now))
      .filter((n) => {
        if (doneSeen.has(n.doneKey)) return false;
        doneSeen.add(n.doneKey);
        return true;
      });
    return {
      live: liveList,
      queued: active.filter((n) => n.bucket !== "now"),
      handled: handledList,
      counts: {
        now: liveList.length,
        today: active.filter((n) => n.bucket === "now" || n.bucket === "today")
          .length,
        /* Counts what the page below actually shows: everything that is not
           filed under LATER. On a Sunday that is today plus tomorrow, because
           tomorrow always gets its own section. */
        week: active.filter((n) => n.bucket !== "later").length,
      },
      runway: buildRunway(nudges, data.events, now),
    };
  }, [data, nudges, now]);

  /* fire system notifications for newly due nudges while open */
  useEffect(() => {
    if (!data || notifyState !== "granted" || !live.length) return;
    const seen = new Set(data.state.notified || []);
    const fresh = live.filter((n) => !seen.has(n.id));
    if (!fresh.length) return;
    fresh.forEach((n) => {
      notify(n.label, {
        body: notifyBody(n, now),
        tag: n.id,
        silent: data.settings.sound === "none",
      });
    });
    persist({
      ...data,
      state: {
        ...data.state,
        notified: [...seen, ...fresh.map((n) => n.id)].slice(-400),
      },
    });
  }, [live, notifyState, data, now, persist]);

  /* Publish the upcoming queue for the host to schedule.

     Deliberately not deduped by doneKey: every rung is its own notification,
     because a ladder that only ever speaks once is not a ladder. The live band
     collapses rungs for *display*; this is delivery.

     Keyed on the nudge set rather than on `now`, so it republishes when the
     data changes and not every thirty seconds. */
  const scheduleKey = useMemo(
    () =>
      nudges
        .filter((n) => !n.done)
        .map((n) => `${n.id}@${n.dueAt}`)
        .join("|"),
    [nudges],
  );
  useEffect(() => {
    if (!onSchedule || !data) return;
    const from = new Date();
    const horizon = addDays(from, SCHEDULE_DAYS).getTime();
    const items = nudges
      .filter((n) => !n.done)
      .filter((n) => new Date(n.dueAt).getTime() <= horizon)
      .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
      .slice(0, SCHEDULE_MAX)
      .map((n) => ({
        id: n.id,
        at: n.dueAt,
        title: n.label,
        body: notifyBody(n, new Date(n.dueAt)),
        silent: data.settings.sound === "none",
      }));
    onSchedule(items);
  }, [scheduleKey, onSchedule, data && data.settings.sound]);

  /* app-icon badge, where the platform has one */
  useEffect(() => {
    if (!data) return;
    try {
      if (!navigator.setAppBadge) return;
      if (data.settings.badge && counts.now > 0)
        navigator.setAppBadge(counts.now);
      else navigator.clearAppBadge();
    } catch (e) {
      /* no badge here */
    }
  }, [counts.now, data]);

  const swipe = useSwipe(data ? data.settings.haptics : false);

  /* The back stack, outermost first — the last entry is what a back press
     closes. It has to be built before the loading return below, because a hook
     may not be called conditionally; every condition here therefore survives
     `data` being null, at which point nothing is open and the stack is empty.

     Each condition mirrors the render guard of the thing it closes, so a layer
     that is not on screen is not on the stack. The order is the order they can
     appear in: a to-do sheet only opens over a list detail, a bulk panel only
     over a selection, and a confirm is always on top of everything. */
  const openList =
    data && listId ? data.lists.find((l) => l.id === listId) : null;
  const openItem =
    openList && openTodo
      ? (openList.items || []).find((i) => i.id === openTodo)
      : null;
  const backStack = [];
  const inList = !!openList && tab === "lists";
  const selecting = inList && sel.length > 0 && !openTodo;
  if (tab !== "home") backStack.push(() => setTab("home"));
  if (inList)
    backStack.push(() => {
      setListId(null);
      setOpenTodo(null);
      setSel([]);
      setBulkPanel(null);
    });
  if (selecting)
    backStack.push(() => {
      setSel([]);
      setBulkPanel(null);
    });
  if (selecting && bulkPanel) backStack.push(() => setBulkPanel(null));
  if (openItem) backStack.push(() => setOpenTodo(null));
  if (listEdit) backStack.push(() => setListEdit(null));
  if (evOpen)
    backStack.push(() => {
      setEvOpen(null);
      setEvEdit(false);
      setDraft(null);
    });
  /* Editing an existing event is a layer of its own: back leaves the edit and
     keeps the event open, which is what its own Cancel does. */
  if (evOpen && evEdit && draft && draft.id)
    backStack.push(() => {
      setEvEdit(false);
      setDraft(null);
    });
  if (settingsOpen) backStack.push(() => setSettingsOpen(false));
  if (quickId) backStack.push(() => setQuickId(null));
  if (confirm) backStack.push(() => setConfirm(null));
  useSystemBack(backStack);

  if (!data) {
    return (
      <div className="lx">
        <style>{CSS}</style>
        <div className="lx-phone">
          <div className="lx-status">
            <span />
            <span className="mark">LADDER</span>
            <span />
          </div>
          <div className="lx-scroll">
            <div className="lx-page">
              <div className="lx-counters">
                <div className="lx-counter live">
                  <div className="k">NOW</div>
                  <div className="v">–</div>
                </div>
                <div className="lx-counter">
                  <div className="k">TODAY</div>
                  <div className="v">–</div>
                </div>
                <div className="lx-counter">
                  <div className="k">WEEK</div>
                  <div className="v">–</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- reminder actions ---------- */
  const withItem = (next, lid, itemId, fn) => ({
    ...next,
    lists: next.lists.map((l) =>
      l.id !== lid
        ? l
        : {
            ...l,
            items: l.items.map((it) => (it.id !== itemId ? it : fn(it))),
          },
    ),
  });

  /* Invariant 7: a to-do's completion is intrinsic data on the item, never in
     state.done — so a to-do nudge marked done in Home writes through. */
  const setTodoNudgeDone = (n, value) =>
    withItem(data, n.listId, n.itemId, (it) =>
      n.subId
        ? {
            ...it,
            subtasks: it.subtasks.map((st) =>
              st.id === n.subId
                ? {
                    ...st,
                    done: value,
                    doneAt: value ? new Date().toISOString() : null,
                  }
                : st,
            ),
          }
        : {
            ...it,
            done: value,
            doneAt: value ? new Date().toISOString() : null,
          },
    );

  /* The swipe hint retires on the first swipe — folded into the same object the
     action was already writing. Two persists built from the same `data` inside
     one handler would clobber each other, and the flag is the one that loses. */
  const withSwipeSeen = (next, viaSwipe) =>
    viaSwipe && !data.settings.swipeSeen
      ? { ...next, settings: { ...next.settings, swipeSeen: true } }
      : next;

  const markNudgeDone = (n, viaSwipe) => {
    const cleared = nudges.filter((x) => x.doneKey === n.doneKey).length;
    const meta = cleared > 1 ? `DONE · CLEARED ${cleared} LEAD TIMES` : "DONE";
    if (n.kind === "todo")
      return undoable(
        withSwipeSeen(setTodoNudgeDone(n, true), viaSwipe),
        n.label,
        meta,
      );
    undoable(
      withSwipeSeen(
        {
          ...data,
          state: {
            ...data.state,
            done: { ...data.state.done, [n.doneKey]: new Date().toISOString() },
          },
        },
        viaSwipe,
      ),
      n.label,
      meta,
    );
  };
  const restoreNudge = (n) => {
    if (n.kind === "todo") return persist(setTodoNudgeDone(n, false));
    const done = { ...data.state.done };
    delete done[n.doneKey];
    persist({ ...data, state: { ...data.state, done } });
  };
  const snoozeNudge = (n, at, viaSwipe) =>
    undoable(
      withSwipeSeen(
        {
          ...data,
          state: {
            ...data.state,
            snoozed: { ...data.state.snoozed, [n.id]: at.toISOString() },
          },
        },
        viaSwipe,
      ),
      n.label,
      `SNOOZED TO ${snoozeAtLabel(at, now)}`,
    );

  /* ---------- list actions ---------- */
  const patchList = (lid, fn) => ({
    ...data,
    lists: data.lists.map((l) => (l.id !== lid ? l : fn(l))),
  });
  const ops = {
    patchItem: (lid, itemId, patch) =>
      persist(withItem(data, lid, itemId, (it) => ({ ...it, ...patch }))),
    patchSub: (lid, itemId, subId, patch) =>
      persist(
        withItem(data, lid, itemId, (it) => ({
          ...it,
          subtasks: it.subtasks.map((s) =>
            s.id === subId ? { ...s, ...patch } : s,
          ),
        })),
      ),
    addSub: (lid, itemId, title) =>
      persist(
        withItem(data, lid, itemId, (it) => ({
          ...it,
          subtasks: [
            ...(it.subtasks || []),
            { id: uid(), title, due: null, reminders: [], done: false },
          ],
        })),
      ),
    removeSub: (lid, itemId, subId) =>
      persist(
        withItem(data, lid, itemId, (it) => ({
          ...it,
          subtasks: it.subtasks.filter((s) => s.id !== subId),
        })),
      ),
    addItem: (lid, title) =>
      persist(
        patchList(lid, (l) => ({
          ...l,
          items: [
            {
              id: uid(),
              title,
              notes: "",
              due: null,
              reminders: [],
              done: false,
              subtasks: [],
            },
            ...l.items,
          ],
        })),
      ),
    deleteItem: (lid, item) =>
      guard(`Delete “${item.title}”?`, () => {
        setOpenTodo(null);
        undoable(
          patchList(lid, (l) => ({
            ...l,
            items: l.items.filter((i) => i.id !== item.id),
          })),
          item.title,
          "DELETED",
        );
      }),
    setDone: (lid, item, value) => {
      if (value) setOpenTodo(null);
      const rems = (item.reminders || []).length;
      undoable(
        withItem(data, lid, item.id, (it) => ({
          ...it,
          done: value,
          doneAt: value ? new Date().toISOString() : null,
        })),
        item.title,
        value
          ? `DONE · ${rems ? `CLEARED ${rems} REMINDER${rems === 1 ? "" : "S"}` : "NO REMINDERS"}`
          : "PUT BACK",
      );
    },
    moveItem: (fromId, item, toId) => {
      if (fromId === toId) return;
      const target = data.lists.find((l) => l.id === toId);
      setOpenTodo(null);
      undoable(
        {
          ...data,
          lists: data.lists.map((l) => {
            if (l.id === fromId)
              return { ...l, items: l.items.filter((i) => i.id !== item.id) };
            if (l.id === toId) return { ...l, items: [item, ...l.items] };
            return l;
          }),
        },
        item.title,
        `MOVED TO ${target ? target.name.toUpperCase() : "ANOTHER LIST"}`,
      );
    },
    bulkDone: (lid, items) => {
      if (!items.length) return;
      const ids = new Set(items.map((i) => i.id));
      const stamp = new Date().toISOString();
      setSel([]);
      setBulkPanel(null);
      undoable(
        patchList(lid, (l) => ({
          ...l,
          items: l.items.map((i) =>
            ids.has(i.id) ? { ...i, done: true, doneAt: stamp } : i,
          ),
        })),
        `${items.length} item${items.length === 1 ? "" : "s"} marked done`,
        "DONE",
      );
    },
    bulkDelete: (lid, items) =>
      guard(
        `Delete ${items.length} item${items.length === 1 ? "" : "s"}?`,
        () => {
          if (!items.length) return;
          const ids = new Set(items.map((i) => i.id));
          setSel([]);
          setBulkPanel(null);
          undoable(
            patchList(lid, (l) => ({
              ...l,
              items: l.items.filter((i) => !ids.has(i.id)),
            })),
            `${items.length} item${items.length === 1 ? "" : "s"} deleted`,
            "DELETED",
          );
        },
      ),
    bulkDate: (lid, items, n) => {
      if (!items.length) return;
      const ids = new Set(items.map((i) => i.id));
      const hour = data.settings.todoAutoHour ?? 9;
      let iso = null;
      if (n != null) {
        const d = addDays(now, n);
        d.setHours(hour, 0, 0, 0);
        iso = d.toISOString();
      }
      setSel([]);
      setBulkPanel(null);
      undoable(
        patchList(lid, (l) => ({
          ...l,
          items: l.items.map((i) =>
            ids.has(i.id)
              ? { ...i, due: iso, reminders: iso ? i.reminders : [] }
              : i,
          ),
        })),
        `${items.length} item${items.length === 1 ? "" : "s"} rescheduled`,
        iso ? capDate(iso) : "DATE CLEARED",
      );
    },
    bulkMove: (fromId, items, toId) => {
      if (!items.length || fromId === toId) return;
      const ids = new Set(items.map((i) => i.id));
      const target = data.lists.find((l) => l.id === toId);
      setSel([]);
      setBulkPanel(null);
      undoable(
        {
          ...data,
          lists: data.lists.map((l) => {
            if (l.id === fromId)
              return { ...l, items: l.items.filter((i) => !ids.has(i.id)) };
            if (l.id === toId) return { ...l, items: [...items, ...l.items] };
            return l;
          }),
        },
        `${items.length} item${items.length === 1 ? "" : "s"} moved`,
        `TO ${target ? target.name.toUpperCase() : "ANOTHER LIST"}`,
      );
    },
    /* A list is named by the person making it, not by a counter. The name and
       the accent both arrive from the sheet; both stay editable afterwards. */
    addList: (name, accent) => {
      const list = {
        id: `list-${uid()}`,
        name: (name || "").trim() || `List ${data.lists.length + 1}`,
        accent: accent || nextAccent(data.lists),
        items: [],
      };
      persist({ ...data, lists: [...data.lists, list] });
      setListEdit(null);
      setListId(list.id);
    },
    /* Renaming is a plain patch: nothing keys off a list's name. The to-do
       nudges carry listName, but they are derived on every render, so the
       origin line on the home ledger follows the rename immediately. */
    patchListMeta: (lid, patch) => {
      const name = patch.name != null ? patch.name.trim() : null;
      persist(
        patchList(lid, (l) => ({
          ...l,
          ...patch,
          ...(patch.name != null ? { name: name || l.name } : {}),
        })),
      );
    },
    deleteList: (l) =>
      guard(`Delete “${l.name}” and everything in it?`, () => {
        const count = (l.items || []).filter((i) => !i.done).length;
        setListEdit(null);
        setOpenTodo(null);
        setListId(null);
        setSel([]);
        undoable(
          { ...data, lists: data.lists.filter((x) => x.id !== l.id) },
          l.name,
          `LIST DELETED · ${count} OPEN ITEM${count === 1 ? "" : "S"}`,
        );
      }),
  };

  /* ---------- event actions ---------- */
  const rawEvent =
    evOpen && evOpen !== "new"
      ? data.events.find((e) => e.id === evOpen)
      : null;
  const draftFrom = (e) => ({
    id: e.id,
    title: e.title,
    date: dateInputValue(e.start),
    start: e.allDay ? "09:00" : hhmm(e.start),
    end: e.allDay || !e.end ? "10:00" : hhmm(e.end),
    allDay: !!e.allDay,
    location: e.location || "",
    description: e.description || "",
    cat: e.cat || "personal",
    alerts: [...(e.alerts || [])],
  });
  const openEvent = (id) => {
    setEvOpen(id);
    setEvEdit(false);
    setDraft(null);
  };
  const newEvent = (day, hour) => {
    setEvOpen("new");
    setEvEdit(true);
    setDraft({
      id: null,
      title: "",
      date: dateInputValue(day),
      start: clockOfMins(hour * 60),
      end: clockOfMins(hour * 60 + 60),
      allDay: false,
      location: "",
      description: "",
      cat: "personal",
      alerts: [60],
    });
  };
  const closeEvent = () => {
    setEvOpen(null);
    setEvEdit(false);
    setDraft(null);
  };
  const saveEvent = () => {
    if (!draft || !draft.date) return;
    const [y, m, d] = draft.date.split("-").map(Number);
    const start = new Date(y, m - 1, d);
    if (!draft.allDay) {
      start.setHours(
        Math.floor(minsOfClock(draft.start) / 60),
        minsOfClock(draft.start) % 60,
        0,
        0,
      );
    }
    let end = null;
    if (!draft.allDay) {
      end = new Date(y, m - 1, d);
      const em = minsOfClock(draft.end);
      end.setHours(Math.floor(em / 60), em % 60, 0, 0);
      if (end <= start) end = new Date(start.getTime() + 3600000);
    }
    const clean = {
      title: draft.title.trim() || "Untitled event",
      start: start.toISOString(),
      end: end ? end.toISOString() : null,
      allDay: draft.allDay,
      location: draft.location,
      description: draft.description,
      cat: draft.cat,
      alerts: [...draft.alerts],
    };
    if (draft.id) {
      persist({
        ...data,
        events: data.events.map((e) =>
          e.id === draft.id ? { ...e, ...clean } : e,
        ),
      });
      setEvEdit(false);
      setDraft(null);
      setEvOpen(draft.id);
    } else {
      /* Invariant 4: a hand-made event is seen by definition. */
      const e = {
        id: `manual-${uid()}`,
        recurring: false,
        repeats: "",
        organizer: null,
        tasks: [],
        source: "manual",
        ...clean,
      };
      persist({
        ...data,
        events: [...data.events, e],
        state: {
          ...data.state,
          seen: { ...data.state.seen, [e.id]: new Date().toISOString() },
        },
      });
      setEvOpen(e.id);
      setEvEdit(false);
      setDraft(null);
    }
  };
  const deleteEvent = () => {
    const e =
      rawEvent ||
      (draft && draft.id ? data.events.find((x) => x.id === draft.id) : null);
    if (!e) return;
    guard(`Delete “${e.title}”?`, () => {
      closeEvent();
      undoable(
        { ...data, events: data.events.filter((x) => x.id !== e.id) },
        e.title,
        "EVENT DELETED",
      );
    });
  };

  const markSeen = (ids) => {
    const stamp = new Date().toISOString();
    const seen = { ...data.state.seen };
    ids.forEach((id) => {
      seen[id] = stamp;
    });
    persist({ ...data, state: { ...data.state, seen } });
  };
  /* Invariant 5: a muted event produces zero nudges. Muting also marks it seen
     so it does not sit in the review queue for ever. */
  const toggleMute = (id) => {
    const muted = { ...data.state.muted };
    if (muted[id]) delete muted[id];
    else muted[id] = true;
    persist({
      ...data,
      state: {
        ...data.state,
        muted,
        seen: { ...data.state.seen, [id]: new Date().toISOString() },
      },
    });
  };

  const requestNotify = async () => {
    try {
      setNotifyState(await Notification.requestPermission());
    } catch (e) {
      setNotifyState("unsupported");
    }
  };

  const warnings = ruleWarnings(data);
  const overdueTodos = data.lists.reduce(
    (n, l) =>
      n +
      (l.items || []).filter(
        (i) => !i.done && i.due && new Date(i.due) < startOfDay(now),
      ).length,
    0,
  );
  const badges = {
    home: counts.now,
    lists: overdueTodos,
    calendar: unreviewed.length,
    rules: warnings.length,
  };

  /* Resolved above the loading return, because the back stack needs them too. */
  const list = openList;
  const todo = openItem;
  /* Both overlays are addressed by id and resolved here, against this render's
     data. A quick-action menu holding a stale nudge would act on a due time
     that no longer exists. */
  const quickNudge = quickId
    ? [...live, ...queued].find((n) => n.id === quickId) || null
    : null;
  const editedList =
    listEdit && listEdit !== "new"
      ? data.lists.find((l) => l.id === listEdit) || null
      : null;

  return (
    <div className="lx">
      <style>{CSS}</style>
      <div className="lx-phone">
        <StatusBar />

        <div className="lx-scroll">
          {warn && (
            <div className="lx-warnline" style={{ margin: "12px 16px 0" }}>
              {warn}
            </div>
          )}

          {tab === "home" && (
            <Home
              live={live}
              queued={queued}
              handled={handled}
              runway={runway}
              counts={counts}
              now={now}
              settings={data.settings}
              swipe={swipe}
              onDone={markNudgeDone}
              onRestore={restoreNudge}
              onSnooze={snoozeNudge}
              onQuick={setQuickId}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenEvent={openEvent}
              newCount={unreviewed.length}
              onOpenNew={() => {
                setCalSeed("new");
                setTab("calendar");
              }}
            />
          )}

          {tab === "lists" &&
            (list ? (
              <ListDetail
                data={data}
                list={list}
                now={now}
                ops={ops}
                swipe={swipe}
                sel={sel}
                setSel={setSel}
                onOpenTodo={setOpenTodo}
                onEditList={() => setListEdit(list.id)}
                onBack={() => {
                  setListId(null);
                  setOpenTodo(null);
                  setSel([]);
                  setBulkPanel(null);
                }}
              />
            ) : (
              <ListsOverview
                data={data}
                now={now}
                swipe={swipe}
                onPick={(id) => {
                  setListId(id);
                  setSel([]);
                  setBulkPanel(null);
                }}
                onPickItem={(lid, itemId) => {
                  setListId(lid);
                  setOpenTodo(itemId);
                }}
                onNewList={() => setListEdit("new")}
                onEditList={(id) => setListEdit(id)}
              />
            ))}

          {tab === "calendar" && (
            <CalendarTab
              data={data}
              now={now}
              unreviewed={unreviewed}
              swipe={swipe}
              seedView={calSeed}
              onSeedUsed={() => setCalSeed(null)}
              onOpenEvent={openEvent}
              onNewEvent={newEvent}
              onSeen={markSeen}
              onMute={toggleMute}
            />
          )}

          {tab === "rules" && (
            <Rules
              data={data}
              now={now}
              onPatchRules={(rules) => persist({ ...data, rules })}
              onDeleteRule={(rule) =>
                guard(`Delete “${rule.name}”?`, () =>
                  undoable(
                    {
                      ...data,
                      rules: data.rules.filter((r) => r.id !== rule.id),
                    },
                    rule.name,
                    "RULE DELETED",
                  ),
                )
              }
              onPatchSettings={(patch) =>
                persist({ ...data, settings: { ...data.settings, ...patch } })
              }
            />
          )}
        </div>

        {sel.length > 0 && list && tab === "lists" && !openTodo && (
          <BulkBar
            data={data}
            list={list}
            now={now}
            sel={sel}
            setSel={setSel}
            panel={bulkPanel}
            setPanel={setBulkPanel}
            ops={ops}
          />
        )}

        {confirm && (
          <div className="lx-undo" role="alertdialog" aria-label="Confirm">
            <div className="lx-undo-in">
              <div style={{ minWidth: 0 }}>
                <div className="t">{confirm.label}</div>
                <div className="m">THIS CAN STILL BE UNDONE</div>
              </div>
              <div style={{ display: "flex", gap: 7, flex: "none" }}>
                <button
                  className="lx-bulk-mini"
                  onClick={() => setConfirm(null)}
                >
                  CANCEL
                </button>
                <button
                  className="lx-undo-btn"
                  onClick={() => {
                    const run = confirm.run;
                    setConfirm(null);
                    run();
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
            <div className="lx-undo-bar" />
          </div>
        )}

        {!confirm && undoTip && (
          <div className="lx-undo" role="status" aria-live="polite">
            <div className="lx-undo-in">
              <div style={{ minWidth: 0 }}>
                <div className="t">{undoTip.label}</div>
                <div className="m">{undoTip.meta}</div>
              </div>
              <button className="lx-undo-btn" onClick={runUndo}>
                Undo
              </button>
            </div>
            <div className="lx-undo-bar">
              <i />
            </div>
          </div>
        )}

        {quickNudge && (
          <QuickActions
            n={quickNudge}
            now={now}
            settings={data.settings}
            onClose={() => setQuickId(null)}
            onDone={() => {
              setQuickId(null);
              markNudgeDone(quickNudge);
            }}
            onSnooze={(at) => {
              setQuickId(null);
              snoozeNudge(quickNudge, at);
            }}
            onOpen={() => {
              setQuickId(null);
              if (quickNudge.kind === "todo") {
                setTab("lists");
                setListId(quickNudge.listId);
                /* A subtask's nudge carries its parent item — that is the
                   sheet the step lives in. */
                setOpenTodo(quickNudge.itemId);
              } else openEvent(quickNudge.eventId);
            }}
          />
        )}

        {listEdit && (listEdit === "new" || editedList) && (
          <ListSheet
            list={editedList}
            onClose={() => setListEdit(null)}
            onSave={(name, accent) => {
              if (listEdit === "new") ops.addList(name, accent);
              else {
                ops.patchListMeta(editedList.id, {
                  name,
                  accent: accent || editedList.accent,
                });
                setListEdit(null);
              }
            }}
            onDelete={() => ops.deleteList(editedList)}
          />
        )}

        {todo && list && (
          <TodoSheet
            data={data}
            list={list}
            item={todo}
            now={now}
            ops={ops}
            onClose={() => setOpenTodo(null)}
          />
        )}

        {evOpen && (rawEvent || (evEdit && draft)) && (
          <EventSheet
            data={data}
            event={rawEvent}
            draft={draft}
            editing={evEdit && !!draft}
            setDraft={setDraft}
            onClose={closeEvent}
            onEdit={() => {
              setDraft(draftFrom(rawEvent));
              setEvEdit(true);
            }}
            onCancel={() => {
              if (draft && draft.id) {
                setEvEdit(false);
                setDraft(null);
              } else closeEvent();
            }}
            onSave={saveEvent}
            onDelete={deleteEvent}
          />
        )}

        {settingsOpen && (
          <Settings
            data={data}
            persist={persist}
            undoable={undoable}
            notifyState={notifyState}
            onRequestNotify={requestNotify}
            onClose={() => setSettingsOpen(false)}
          />
        )}

        <nav className="lx-nav">
          {TABS.map(([key, label, icon]) => {
            const on = tab === key;
            const badge = badges[key];
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-current={on ? "page" : undefined}
                aria-label={label}
              >
                <span
                  className="lx-ico"
                  style={{ color: on ? "var(--ink)" : "var(--mute-3)" }}
                >
                  <TabIcon name={icon} />
                  {badge > 0 && (
                    <span
                      className="lx-navbadge"
                      style={{
                        background:
                          key === "home" ? "var(--amber-ink)" : "var(--mute-2)",
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </span>
                <span
                  className="lab"
                  style={{ color: on ? "var(--ink)" : "var(--mute-3)" }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
