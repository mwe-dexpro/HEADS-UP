/* ============================================================
   Home — the queue, sorted by when a reminder is due
   ------------------------------------------------------------
   Decision 001: the reminder is the primary object, not the
   event. Live is said with an amber rail and band, never a fill,
   and two overdue rungs of one ladder are one thing to do.
   ============================================================ */

import { useState } from "react";
import { BUCKETS } from "../lib/nudges.js";
import { snoozeAtLabel, snoozeOptions } from "../lib/snooze.js";
import { fmtDate, fmtTime, relative } from "../lib/time.js";
import { Empty, SectionHead } from "../ui/atoms.jsx";
import { SWIPE_T } from "../ui/gestures.js";
import {
  dueLabelOf,
  notesOf,
  originOf,
  originValue,
  railOf,
  rowsOf,
  rungLine,
  rungOf,
  tintOf,
  tminusOf,
} from "../ui/nudge.js";

/* The live row. A filled amber band across the full width, carrying the origin;
   the rail beneath it in the same amber. With no card edge to fill, the band is
   the strongest state change the ledger has. */
function LiveCard({
  n,
  now,
  settings,
  weekStart,
  open,
  snoozing,
  onToggle,
  onSnoozeOpen,
  onDone,
  onSnooze,
}) {
  return (
    <article
      className="lx-led"
      style={{ borderLeftColor: "var(--amber)" }}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="lx-led-head" style={{ background: "var(--amber)" }}>
        <span className="from">{`${originOf(n)} · ${originValue(n)}`}</span>
        <span className="now">NOW</span>
      </div>
      <div className="lx-led-meta">
        <span className="t">{tminusOf(n)}</span>
        <span className="due">{dueLabelOf(n, now, weekStart)}</span>
      </div>
      <h3>{n.label}</h3>
      <div className="lx-led-rows">
        {rowsOf(n, now).map(([k, v]) => (
          <div className="lx-led-row" key={k}>
            <span className="k">{k}</span>
            <span className="v">{v}</span>
          </div>
        ))}
        {/* The band above already names the origin, so expanding only adds the
            notes. The card treatment repeated it because it had nowhere else to
            put it. */}
        {open && (
          <div className="lx-led-row">
            <span className="k">NOTES</span>
            <span className="v">{notesOf(n)}</span>
          </div>
        )}
      </div>
      {snoozing && (
        <div className="lx-led-snooze">
          {snoozeOptions(now, settings).map((o) => (
            <button
              key={o.label}
              onClick={(e) => {
                e.stopPropagation();
                onSnooze(o.at);
              }}
            >
              <span>{o.label}</span>
              <span className="at">{snoozeAtLabel(o.at, now)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="lx-led-act">
        <button
          className="lx-btn-ink"
          onClick={(e) => {
            e.stopPropagation();
            onDone();
          }}
        >
          Done
        </button>
        <button
          className="lx-btn-line"
          onClick={(e) => {
            e.stopPropagation();
            onSnoozeOpen();
          }}
        >
          Snooze
        </button>
      </div>
    </article>
  );
}

/* Everything not in front of you: the same row, quieter, with the origin as a
   tinted chip instead of a band. A live item shown here keeps the amber. */
function QueuedCard({ n, now, weekStart, open, live, onToggle, onDone }) {
  return (
    <div
      className="lx-led q"
      style={{ borderLeftColor: railOf(n, live) }}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <div className="lx-led-tags">
        <span className="left">
          <span className="origin" style={{ background: tintOf(n, live) }}>
            {originOf(n)}
          </span>
          <span className="rung">{rungLine(n)}</span>
        </span>
        <span
          className="due"
          style={live ? { color: "var(--amber-ink)" } : undefined}
        >
          {live ? "DUE NOW" : dueLabelOf(n, now, weekStart)}
        </span>
      </div>
      <h3>{n.label}</h3>
      <div className="lx-led-rows">
        {rowsOf(n, now).map(([k, v]) => (
          <div className="lx-led-row" key={k}>
            <span className="k">{k}</span>
            <span className="v">{v}</span>
          </div>
        ))}
        {open && (
          <>
            <div className="lx-led-row">
              <span className="k">{originOf(n)}</span>
              <span className="v">{originValue(n)}</span>
            </div>
            <div className="lx-led-row">
              <span className="k">NOTES</span>
              <span className="v">{notesOf(n)}</span>
            </div>
          </>
        )}
      </div>
      <button
        className="lx-btn-led"
        onClick={(e) => {
          e.stopPropagation();
          onDone();
        }}
      >
        Done
      </button>
    </div>
  );
}

function Runway({ runway, now, onOpenEvent }) {
  const ev = runway.event;
  const start = new Date(ev.start);
  const stateColour = (s) =>
    s === "HANDLED"
      ? "var(--mute-4)"
      : s === "DUE NOW"
        ? "var(--amber-ink)"
        : "var(--ink-2)";
  return (
    <div className="lx-block">
      <div className="lx-block-head">
        <span className="lx-sec-label">RUNWAY</span>
        <span className="lx-block-note">next event</span>
      </div>
      <div className="lx-panel">
        <button className="lx-runway-t" onClick={onOpenEvent}>
          {ev.title}
        </button>
        <div className="lx-runway-m">
          {`${fmtDate(start).toUpperCase()}${ev.allDay ? " · ALL DAY" : ` · ${fmtTime(start)}`} · ${relative(
            start,
            now,
          ).toUpperCase()}`}
        </div>

        <div className="lx-track" aria-hidden="true">
          <div className="lx-track-base" />
          <div
            className="lx-track-fill"
            style={{ width: `${runway.nowPct}%` }}
          />
          <div className="lx-track-now" style={{ left: `${runway.nowPct}%` }} />
          {runway.steps.map((s, i) => (
            <div
              key={i}
              className={`lx-dot${s.state === "DUE NOW" ? " now" : s.state === "AHEAD" ? " ahead" : ""}`}
              style={{ left: `${s.left}%` }}
            />
          ))}
          <div className="lx-track-end" />
          {runway.steps.map((s, i) => (
            <div
              key={i}
              className={`lx-track-lab${s.state === "DUE NOW" ? " hot" : ""}`}
              style={{ left: `${s.left}%` }}
            >
              {s.lead}
            </div>
          ))}
          <div className="lx-track-lab tail">EVENT</div>
        </div>

        <div className="lx-rows">
          {runway.steps.map((s, i) => (
            <div key={i} className="lx-row3" style={{ cursor: "default" }}>
              <span className="k">{s.lead}</span>
              <span className="t" style={{ color: stateColour(s.state) }}>
                {s.nudge.label}
              </span>
              <span className="s" style={{ color: stateColour(s.state) }}>
                {s.state}
              </span>
            </div>
          ))}
        </div>
        <div className="lx-runway-sum">
          {runway.ahead === 0
            ? "Everything on this event is handled."
            : `${runway.ahead} of ${runway.steps.length} still ahead of you · ${
                runway.daysLeft === 0
                  ? "it happens today"
                  : `${runway.daysLeft} day${runway.daysLeft === 1 ? "" : "s"} of runway left`
              }.`}
        </div>
      </div>
    </div>
  );
}

/* The ledger row, wrapped in its gesture. Right is done, left is a snooze by
   the default duration; anything else is one long press away. The wrapper owns
   the full-bleed margins so the underlay never shows in the gap between rows. */
function LedgerSwipe({ id, live, swipe, onDone, onSnooze, onQuick, children }) {
  const dx = swipe.dxFor(id);
  const bind = swipe.bind(id, {
    onRight: onDone,
    onLeft: onSnooze,
    onLongPress: onQuick,
  });
  return (
    <div className={`lx-swb${live ? " live" : ""}`}>
      <div className="lx-swb-under done" style={{ opacity: dx > 0 ? 1 : 0 }}>
        <span className="lab">{dx >= SWIPE_T ? "RELEASE · DONE" : "DONE"}</span>
      </div>
      <div className="lx-swb-under snooze" style={{ opacity: dx < 0 ? 1 : 0 }}>
        <span className="lab">
          {-dx >= SWIPE_T ? "RELEASE · SNOOZE" : "SNOOZE"}
        </span>
      </div>
      <div
        style={{
          transform: `translateX(${dx}px)`,
          transition: swipe.anim
            ? "transform .24s cubic-bezier(.2,.8,.2,1)"
            : "none",
        }}
        {...bind}
      >
        {children}
      </div>
    </div>
  );
}

export function Home({
  live,
  queued,
  handled,
  runway,
  counts,
  now,
  settings,
  swipe,
  onDone,
  onRestore,
  onSnooze,
  onQuick,
  onOpenSettings,
  onOpenEvent,
  newCount,
  onOpenNew,
}) {
  const [open, setOpen] = useState(null);
  const [snoozeFor, setSnoozeFor] = useState(null);

  /* One place decides what a swipe means, so the live row and the queued rows
     cannot drift apart. The left swipe takes the default snooze; the whole
     list of times stays behind the long press and the Snooze button. */
  const quickSnooze = (n) => {
    const first = snoozeOptions(now, settings)[0];
    if (!first) return;
    onSnooze(n, first.at, true);
  };
  const swipeDone = (n) => {
    setOpen(null);
    setSnoozeFor(null);
    onDone(n, true);
  };
  /* A gesture that has just ended must not also count as a tap on the row. */
  const guarded = (fn) => () => {
    if (swipe.tapBlocked()) return;
    fn();
  };

  const buckets = BUCKETS.map(([key, label]) => ({
    key,
    label,
    items: queued.filter((n) => n.bucket === key),
  })).filter((b) => b.items.length);

  const nextUp = buckets.length ? buckets[0] : null;

  return (
    <div className="lx-page">
      <div className="lx-head">
        <div>
          <div className="lx-h1">
            {now.toLocaleDateString(undefined, { weekday: "long" })}
          </div>
          {/* Date and time on one mono line, comma stripped like every other
              small-caps label in the app. */}
          <div className="lx-h1-sub">
            {`${now
              .toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
              .replace(/,/g, "")
              .toUpperCase()} · ${fmtTime(now)}`}
          </div>
        </div>
        <button
          className="lx-dots"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
        >
          ⋯
        </button>
      </div>

      <div className="lx-counters">
        <div className="lx-counter live">
          <div className="k">NOW</div>
          <div className="v">{counts.now}</div>
        </div>
        <div className="lx-counter">
          <div className="k">TODAY</div>
          <div className="v">{counts.today}</div>
        </div>
        <div className="lx-counter">
          <div className="k">WEEK</div>
          <div className="v">{counts.week}</div>
        </div>
      </div>

      {newCount > 0 && (
        <button
          className="lx-dash sm"
          style={{ marginBottom: 22 }}
          onClick={onOpenNew}
        >
          {`${newCount} new event${newCount === 1 ? "" : "s"} in your calendar — review`}
        </button>
      )}

      {/* One expanded block at a time: the first live reminder gets the amber
          band and the full body. Anything else already due sits directly under
          it as an amber-railed row — nothing hidden, nothing collapsed. */}
      {live[0] && (
        <LedgerSwipe
          id={live[0].id}
          live
          swipe={swipe}
          onDone={() => swipeDone(live[0])}
          onSnooze={() => quickSnooze(live[0])}
          onQuick={() => onQuick(live[0].id)}
        >
          <LiveCard
            n={live[0]}
            now={now}
            settings={settings}
            weekStart={settings.weekStart}
            open={open === live[0].id}
            snoozing={snoozeFor === live[0].id}
            onToggle={guarded(() => {
              setOpen(open === live[0].id ? null : live[0].id);
              setSnoozeFor(null);
            })}
            onSnoozeOpen={guarded(() => {
              setSnoozeFor(snoozeFor === live[0].id ? null : live[0].id);
              setOpen(null);
            })}
            onDone={guarded(() => {
              setSnoozeFor(null);
              setOpen(null);
              onDone(live[0]);
            })}
            onSnooze={(at) => {
              if (swipe.tapBlocked()) return;
              setSnoozeFor(null);
              onSnooze(live[0], at);
            }}
          />
        </LedgerSwipe>
      )}

      {/* A gesture nobody has been told about is not a control. The line goes
          away for good the first time a row is swiped. */}
      {!settings.swipeSeen && (live.length > 0 || queued.length > 0) && (
        <div className="lx-gesture-hint">
          <span>
            SWIPE <b>→ DONE</b> · <b>← SNOOZE</b> · HOLD FOR MORE
          </span>
        </div>
      )}

      {live.length > 1 && (
        <div className="lx-sec led">
          <SectionHead label="ALSO DUE NOW" count={String(live.length - 1)} />
          <div className="lx-led-list">
            {live.slice(1).map((n) => (
              <LedgerSwipe
                key={n.id}
                id={n.id}
                swipe={swipe}
                onDone={() => swipeDone(n)}
                onSnooze={() => quickSnooze(n)}
                onQuick={() => onQuick(n.id)}
              >
                <QueuedCard
                  n={n}
                  now={now}
                  weekStart={settings.weekStart}
                  live
                  open={open === n.id}
                  onToggle={guarded(() => setOpen(open === n.id ? null : n.id))}
                  onDone={guarded(() => {
                    setOpen(null);
                    onDone(n);
                  })}
                />
              </LedgerSwipe>
            ))}
          </div>
        </div>
      )}

      {live.length === 0 && (
        <Empty
          title="Nothing due now"
          detail={
            nextUp
              ? `Next is ${nextUp.items[0].label.toLowerCase()} — ${nextUp.label.toLowerCase()}.`
              : "Nothing this week."
          }
        />
      )}

      {buckets.map((b) => (
        <div className="lx-sec led" key={b.key}>
          <SectionHead label={b.label} count={String(b.items.length)} />
          <div className="lx-led-list">
            {b.items.map((n) => (
              <LedgerSwipe
                key={n.id}
                id={n.id}
                swipe={swipe}
                onDone={() => swipeDone(n)}
                onSnooze={() => quickSnooze(n)}
                onQuick={() => onQuick(n.id)}
              >
                <QueuedCard
                  n={n}
                  now={now}
                  weekStart={settings.weekStart}
                  open={open === n.id}
                  onToggle={guarded(() => setOpen(open === n.id ? null : n.id))}
                  onDone={guarded(() => {
                    setOpen(null);
                    onDone(n);
                  })}
                />
              </LedgerSwipe>
            ))}
          </div>
        </div>
      ))}

      {runway && (
        <Runway
          runway={runway}
          now={now}
          onOpenEvent={() => onOpenEvent(runway.event.id)}
        />
      )}

      <div className="lx-block" style={{ marginTop: 24 }}>
        <div className="lx-block-head">
          <span className="lx-sec-label">HANDLED</span>
          <span className="lx-sec-count">{handled.length}</span>
        </div>
        {handled.length === 0 ? (
          <div className="lx-quiet-note">Nothing completed yet today.</div>
        ) : (
          <div className="lx-seam">
            {handled.map((n) => (
              <div className="lx-handled" key={n.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="t">{n.label}</div>
                  <div className="m">
                    {`${(n.kind === "todo" ? n.listName : n.eventTitle).toUpperCase()} · ${rungOf(n)}`}
                  </div>
                </div>
                <button className="lx-putback" onClick={() => onRestore(n)}>
                  Put back
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
