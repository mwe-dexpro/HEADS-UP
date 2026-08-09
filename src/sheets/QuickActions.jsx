/* The long-press menu for a ledger row: done, the three snooze times, and open.
   Pinned to the bottom of the screen rather than floating in the middle of it,
   because that is where the thumb already is. The two swipes are shortcuts into
   its first two entries and are labelled as such. */

import { snoozeAtLabel, snoozeOptions } from "../lib/snooze.js";
import { originOf, rungOf } from "../ui/nudge.js";

/* ---------- quick actions ----------
   Everything a reminder can do, one thumb-length from the bottom of the screen.
   A long press on any ledger row opens it; the two swipes are shortcuts into
   the first two entries, and they say so.                                   */
export function QuickActions({
  n,
  now,
  settings,
  onClose,
  onDone,
  onSnooze,
  onOpen,
}) {
  return (
    <>
      <button
        className="lx-scrim"
        aria-label="Close quick actions"
        onClick={onClose}
      />
      <div className="lx-quick" role="dialog" aria-label="Quick actions">
        <div className="lx-quick-head">
          <div className="k">{`${originOf(n)} · ${rungOf(n)}`}</div>
          <div className="t">{n.label}</div>
        </div>
        <div className="lx-quick-acts">
          <button className="go" onClick={onDone}>
            <span>Mark done</span>
            <span className="at">SWIPE →</span>
          </button>
          {snoozeOptions(now, settings).map((o, i) => (
            <button key={o.label} onClick={() => onSnooze(o.at)}>
              <span>{o.label}</span>
              <span className="at">
                {i === 0
                  ? `← SWIPE · ${snoozeAtLabel(o.at, now)}`
                  : snoozeAtLabel(o.at, now)}
              </span>
            </button>
          ))}
          <button onClick={onOpen}>
            <span>
              {n.kind === "todo" ? "Open the to-do" : "Open the event"}
            </span>
            <span className="at">›</span>
          </button>
          <button className="kill" onClick={onClose}>
            <span>Cancel</span>
          </button>
        </div>
      </div>
    </>
  );
}
