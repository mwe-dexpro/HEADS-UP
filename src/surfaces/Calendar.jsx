/* ============================================================
   Calendar — one destination, five views
   ------------------------------------------------------------
   Agenda, month, week, work week and three-day, plus the review
   queue for events an import has not been looked at yet. A swipe
   sideways steps a period in every view but that queue.
   ============================================================ */

import { useState, useEffect, useCallback } from "react";
import {
  CAL_END_H,
  CAL_H,
  CAL_PX,
  CAL_START_H,
  CAL_VIEWS,
  minsOfDate,
  timeLabel,
  weekStartOf,
} from "../lib/calendar.js";
import { catOf } from "../lib/data.js";
import {
  addDays,
  capDate,
  fmtDate,
  fmtTime,
  gutterHour,
  isoWeek,
  pad,
  relative,
  sameDay,
  startOfDay,
} from "../lib/time.js";
import { Empty, Row, SectionHead, Seg } from "../ui/atoms.jsx";
import { usePager } from "../ui/gestures.js";

export function CalendarTab({
  data,
  now,
  unreviewed,
  swipe,
  seedView,
  onSeedUsed,
  onOpenEvent,
  onNewEvent,
  onSeen,
  onMute,
}) {
  const S = data.settings;
  /* seedView lets Home's banner land on the review queue rather than on
     whichever grid the user normally opens. It is consumed once. */
  const [view, setView] = useState(seedView || S.calDefault || "week");
  useEffect(() => {
    if (seedView) onSeedUsed();
  }, []);
  const [anchor, setAnchor] = useState(() => startOfDay(now));
  const [sel, setSel] = useState(() => startOfDay(now));

  const eventsOn = useCallback(
    (day) =>
      data.events
        .filter((e) => sameDay(new Date(e.start), day))
        .sort(
          (a, b) =>
            (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0) ||
            minsOfDate(a.start) - minsOfDate(b.start),
        ),
    [data.events],
  );

  const views = S.watchNew
    ? [
        ...CAL_VIEWS,
        ["new", `NEW${unreviewed.length ? ` ${unreviewed.length}` : ""}`],
      ]
    : CAL_VIEWS;

  let days = [];
  if (view === "week")
    days = [0, 1, 2, 3, 4, 5, 6].map((i) =>
      addDays(weekStartOf(anchor, S.weekStart), i),
    );
  else if (view === "work")
    days = [0, 1, 2, 3, 4].map((i) =>
      addDays(weekStartOf(anchor, S.weekStart), i),
    );
  else if (view === "day3") days = [0, 1, 2].map((i) => addDays(anchor, i));

  const isGrid = view === "week" || view === "work" || view === "day3";

  const rangeLabel = () => {
    if (view === "month" || view === "list" || view === "new")
      return anchor.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
    const a = days[0];
    const b = days[days.length - 1];
    const am = a.toLocaleDateString(undefined, { month: "short" });
    const bm = b.toLocaleDateString(undefined, { month: "short" });
    return `${a.getDate()}${am !== bm ? ` ${am}` : ""}–${b.getDate()} ${bm} ${b.getFullYear()}`;
  };
  const subLabel = {
    list: "AGENDA",
    month: "MONTH",
    week: "WEEK",
    work: "WORK WEEK",
    day3: "THREE DAYS",
    new: "NEW IN YOUR CALENDAR",
  }[view];

  const step = (dir) => () => {
    if (view === "month")
      setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
    else
      setAnchor(
        addDays(anchor, dir * (view === "day3" ? 3 : view === "list" ? 14 : 7)),
      );
  };

  /* Swiping the calendar sideways steps a period, whatever the view is showing
     — the ‹ › buttons stay for anyone who would rather aim. The review queue is
     the one view with no period to step, so it is left alone. */
  const pager = usePager(step(-1), step(1), swipe.buzz);
  const paged = view === "new" ? {} : pager.bind;

  /* ----- grid columns ----- */
  const columns = days.map((day) => {
    const all = eventsOn(day);
    const timed = all.filter((e) => !e.allDay);
    const lanes = [];
    const placed = timed.map((e) => {
      const a = minsOfDate(e.start);
      const b = Math.max(e.end ? minsOfDate(e.end) : a + 60, a + 30);
      let lane = 0;
      while (lanes[lane] != null && lanes[lane] > a) lane++;
      lanes[lane] = b;
      return { e, a, b, lane };
    });
    const width = Math.max(lanes.length, 1);
    return {
      day,
      today: sameDay(day, now),
      allDay: all.filter((e) => e.allDay),
      blocks: placed.map(({ e, a, b, lane }) => ({
        e,
        top: ((a - CAL_START_H * 60) / 60) * CAL_PX,
        height: Math.max(((b - a) / 60) * CAL_PX - 3, 26),
        left: (lane / width) * 100,
        width: (1 / width) * 100,
      })),
    };
  });

  /* ----- month grid ----- */
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = weekStartOf(monthStart, S.weekStart);
  const monthRows = [];
  for (let i = 0; i < 42; i++) {
    const day = addDays(gridStart, i);
    if (i % 7 === 0) monthRows.push({ week: `KW ${isoWeek(day)}`, cells: [] });
    const list = eventsOn(day);
    monthRows[monthRows.length - 1].cells.push({
      day,
      num: day.getDate(),
      inMonth: day.getMonth() === anchor.getMonth(),
      today: sameDay(day, now),
      picked: sameDay(day, sel),
      bars: list.slice(0, 3).map((e) => catOf(e.cat).fg),
      more: list.length > 3 ? `+${list.length - 3}` : "",
    });
  }
  const monthCols = S.weekNums ? "28px repeat(7,1fr)" : "repeat(7,1fr)";
  const dowRow =
    S.weekStart === "sun"
      ? ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]
      : ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

  /* ----- agenda ----- */
  const agenda = [];
  for (let i = -2; i < 60 && agenda.length < 24; i++) {
    const day = addDays(anchor, i);
    const list = eventsOn(day);
    if (!list.length) continue;
    agenda.push({
      day,
      label: capDate(day),
      tag: sameDay(day, now)
        ? "TODAY"
        : sameDay(day, addDays(now, 1))
          ? "TOMORROW"
          : "",
      items: list,
    });
  }

  const weekBadge =
    view === "month"
      ? `KW ${isoWeek(monthStart)}–${isoWeek(addDays(gridStart, 34))}`
      : `KW ${isoWeek(days[0] || anchor)}`;

  return (
    <div
      className="lx-page flush"
      style={view === "new" ? undefined : pager.style}
      {...paged}
    >
      <div className="lx-cal-head">
        <div className="lx-cal-top">
          <div>
            <div className="lx-cal-title">{rangeLabel()}</div>
            <div className="lx-cal-sub">
              <span className="s">{subLabel}</span>
              {S.weekNums && view !== "list" && view !== "new" && (
                <span className="lx-kwbadge">{weekBadge}</span>
              )}
            </div>
          </div>
          <div className="lx-cal-nav">
            <button onClick={step(-1)} aria-label="Previous">
              ‹
            </button>
            <button
              className="today"
              onClick={() => {
                setAnchor(startOfDay(now));
                setSel(startOfDay(now));
              }}
            >
              TODAY
            </button>
            <button onClick={step(1)} aria-label="Next">
              ›
            </button>
          </div>
        </div>
        <div className="lx-cal-seg">
          <Seg options={views} value={view} onPick={setView} />
        </div>
        {view !== "new" && (
          <div className="lx-gesture-hint" style={{ margin: "10px 0 0" }}>
            <span>
              SWIPE <b>←</b> OR <b>→</b> TO STEP
            </span>
          </div>
        )}
      </div>

      {isGrid && (
        <>
          <div className="lx-cal-gridhead">
            <div className="lx-gutter">
              {S.weekNums ? `KW ${isoWeek(days[0])}` : ""}
            </div>
            {columns.map((c) => (
              <div className="lx-col" key={c.day.toISOString()}>
                <div
                  className="dow"
                  style={{
                    color: c.today ? "var(--amber-ink)" : "var(--mute-2)",
                  }}
                >
                  {c.day
                    .toLocaleDateString(undefined, { weekday: "short" })
                    .toUpperCase()}
                </div>
                <div
                  className="num"
                  style={{ color: c.today ? "var(--amber-ink)" : "var(--ink)" }}
                >
                  {c.day.getDate()}
                </div>
                <div className="lx-allday">
                  {c.allDay.map((e) => (
                    <button
                      key={e.id}
                      style={{
                        background: catOf(e.cat).bg,
                        color: catOf(e.cat).fg,
                      }}
                      onClick={() => onOpenEvent(e.id)}
                    >
                      {e.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="lx-cal-body">
            <div className="lx-hours" style={{ height: CAL_H }}>
              {Array.from({ length: CAL_END_H - CAL_START_H }, (_, i) => (
                <div className="lx-hour" key={i}>
                  {gutterHour(CAL_START_H + i)}
                </div>
              ))}
            </div>
            {columns.map((c) => (
              <div
                className="lx-colbody"
                key={c.day.toISOString()}
                style={{ height: CAL_H }}
              >
                {Array.from({ length: CAL_END_H - CAL_START_H }, (_, i) => (
                  <button
                    key={i}
                    className="lx-slot"
                    style={{ top: i * CAL_PX }}
                    onClick={() => onNewEvent(c.day, CAL_START_H + i)}
                    aria-label={`New event at ${pad(CAL_START_H + i)}:00`}
                  />
                ))}
                {c.blocks.map((b) => (
                  <button
                    key={b.e.id}
                    className="lx-ev"
                    style={{
                      top: b.top,
                      height: b.height,
                      left: `${b.left}%`,
                      width: `${b.width}%`,
                      background: catOf(b.e.cat).bg,
                      borderLeftColor: catOf(b.e.cat).fg,
                    }}
                    onClick={() => onOpenEvent(b.e.id)}
                  >
                    <div className="t">{b.e.title}</div>
                    {/* A half-hour block has room for a title or a time, not
                        both. The title wins. */}
                    {b.height >= 42 && (
                      <div className="m">{fmtTime(b.e.start)}</div>
                    )}
                  </button>
                ))}
                {c.today && (
                  <div
                    className="lx-nowline"
                    style={{
                      top: ((minsOfDate(now) - CAL_START_H * 60) / 60) * CAL_PX,
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="lx-cal-foot">
            <button
              className="lx-dash sm"
              onClick={() => onNewEvent(days[0], 9)}
            >
              Tap any empty slot, or add an event here
            </button>
          </div>
        </>
      )}

      {view === "month" && (
        <>
          <div className="lx-month">
            <div
              className="lx-month-dow"
              style={{ gridTemplateColumns: monthCols }}
            >
              {S.weekNums && <div />}
              {dowRow.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
            <div className="lx-month-body">
              {monthRows.map((r, i) => (
                <div
                  className="lx-month-row"
                  key={i}
                  style={{ gridTemplateColumns: monthCols }}
                >
                  {S.weekNums && <div className="lx-weekno">{r.week}</div>}
                  {r.cells.map((c) => (
                    <button
                      className="lx-day"
                      key={c.day.toISOString()}
                      onClick={() => setSel(c.day)}
                    >
                      <span
                        className="n"
                        style={{
                          background: c.picked ? "var(--ink)" : "transparent",
                          color: c.picked
                            ? "var(--on-ink)"
                            : !c.inMonth
                              ? "var(--mute-5)"
                              : c.today
                                ? "var(--amber-ink)"
                                : "var(--ink)",
                          fontWeight: c.today || c.picked ? 600 : 400,
                        }}
                      >
                        {c.num}
                      </span>
                      <span className="bars">
                        {c.bars.map((bg, j) => (
                          <i key={j} style={{ background: bg }} />
                        ))}
                      </span>
                      <span className="more">{c.more}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: "16px 16px 0" }}>
            <SectionHead label={capDate(sel)} />
            {eventsOn(sel).length > 0 ? (
              <div className="lx-seam r11">
                {eventsOn(sel).map((e) => (
                  <button
                    className="lx-selrow"
                    key={e.id}
                    onClick={() => onOpenEvent(e.id)}
                  >
                    <span
                      className="rail"
                      style={{ background: catOf(e.cat).fg }}
                    />
                    <span style={{ minWidth: 0, display: "block" }}>
                      <span className="t">{e.title}</span>
                      <span className="m">{timeLabel(e)}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="lx-quiet-note">Nothing on this day.</div>
            )}
            <button
              className="lx-dash sm"
              style={{ marginTop: 10 }}
              onClick={() => onNewEvent(sel, 9)}
            >
              ＋ New event on this day
            </button>
          </div>
        </>
      )}

      {view === "list" && (
        <div style={{ padding: "0 16px" }}>
          {agenda.map((g) => (
            <div style={{ marginBottom: 18 }} key={g.day.toISOString()}>
              <div className="lx-agenda-head">
                <span className="day">{g.label}</span>
                {g.tag && (
                  <span
                    className="tag"
                    style={{
                      color:
                        g.tag === "TODAY"
                          ? "var(--amber-ink)"
                          : "var(--mute-3)",
                    }}
                  >
                    {g.tag}
                  </span>
                )}
                <span className="lx-rule-line" />
                <button
                  className="lx-agenda-add"
                  onClick={() => onNewEvent(g.day, 9)}
                  aria-label={`New event on ${g.label}`}
                >
                  ＋
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {g.items.map((e) => (
                  <button
                    className="lx-ag-item"
                    key={e.id}
                    style={{ borderLeftColor: catOf(e.cat).fg }}
                    onClick={() => onOpenEvent(e.id)}
                  >
                    <span className="head">
                      <span className="t">{e.title}</span>
                      <span className="time">{timeLabel(e)}</span>
                    </span>
                    {e.location && <span className="where">{e.location}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {agenda.length === 0 && (
            <Empty
              title="Nothing in this stretch"
              detail="Step forward, or add an event."
            />
          )}
          <button className="lx-dash sm" onClick={() => onNewEvent(anchor, 9)}>
            ＋ New event
          </button>
        </div>
      )}

      {view === "new" && (
        <div style={{ padding: "0 16px" }}>
          {unreviewed.length === 0 ? (
            <Empty
              title="Nothing new"
              detail="Events added to your shared calendars will queue up here."
            />
          ) : (
            <>
              <button
                className="lx-btn-out"
                style={{ width: "100%", height: 44, marginBottom: 14 }}
                onClick={() => onSeen(unreviewed.map((e) => e.id))}
              >
                Mark all as read
              </button>
              <div className="lx-newq">
                {unreviewed.map((e) => (
                  <article
                    className="lx-card"
                    key={e.id}
                    style={{
                      borderLeftColor: catOf(e.cat).fg,
                      cursor: "default",
                    }}
                  >
                    <div className="lx-card-top">
                      <span className="lx-card-k">
                        {e.organizer && e.organizer.name
                          ? `BY ${e.organizer.name.toUpperCase()}`
                          : "ADDED"}
                      </span>
                      <span className="lx-card-due">{timeLabel(e)}</span>
                    </div>
                    <h3>{e.title}</h3>
                    <div className="lx-kv paper">
                      <Row k="WHEN">{`${fmtDate(e.start)} · ${relative(e.start, now)}`}</Row>
                      {e.location && <Row k="WHERE">{e.location}</Row>}
                    </div>
                    <div className="lx-card-act">
                      <button
                        className="lx-btn-quiet"
                        onClick={() => onOpenEvent(e.id)}
                      >
                        Open
                      </button>
                      <button
                        className="lx-btn-quiet narrow"
                        onClick={() => onSeen([e.id])}
                      >
                        Read
                      </button>
                      <button
                        className="lx-btn-warn"
                        onClick={() => onMute(e.id)}
                      >
                        Mute
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
