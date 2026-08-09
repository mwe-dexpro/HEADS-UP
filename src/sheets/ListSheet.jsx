/* Naming a list, and the only place a list is deleted. Decision 035: a list you
   had to name is a list you meant to make. The counter name survives only if
   the field is saved empty. */

import { useState } from "react";
import { ACCENTS } from "../lib/data.js";
import { useSheetDrag } from "../ui/gestures.js";

/* ---------- naming a list ----------
   A list is named when it is made and renamed whenever it stops fitting. The
   same sheet does both, so there is one place to learn.                     */
export function ListSheet({ list, onSave, onDelete, onClose }) {
  const creating = !list;
  const [name, setName] = useState(creating ? "" : list.name);
  const [accent, setAccent] = useState(
    creating ? null : list.accent || ACCENTS[0],
  );
  const drag = useSheetDrag(onClose);
  const open = creating ? 0 : (list.items || []).filter((i) => !i.done).length;
  const commit = () => onSave(name, accent);

  return (
    <div
      className="lx-sheet"
      role="dialog"
      aria-label={creating ? "New list" : "List settings"}
      style={drag.style}
    >
      <div className="lx-grab" aria-hidden="true" {...drag.bind}>
        <i />
      </div>
      <div className="lx-sheet-head" {...drag.bind}>
        <button className="lx-close" onClick={onClose}>
          ‹ Close
        </button>
        <span className="title">{creating ? "NEW LIST" : "LIST"}</span>
        <span className="pad" />
      </div>

      <div className="lx-sheet-body">
        <div className="lx-form">
          <div>
            <div className="lx-lab">NAME</div>
            <input
              className="lx-namefield"
              value={name}
              autoFocus
              enterKeyHint="done"
              placeholder="What is this list for?"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.target.blur();
                  commit();
                }
              }}
              aria-label="List name"
            />
            <div className="lx-daynote">
              {creating
                ? "You can rename it later from the list's own screen."
                : "Renaming is safe — nothing inside the list is keyed to its name."}
            </div>
          </div>

          <div>
            <div className="lx-lab">COLOUR</div>
            <div className="lx-accents">
              {ACCENTS.map((a, i) => (
                <button
                  key={a}
                  className={`lx-accent${a === accent ? " on" : ""}`}
                  onClick={() => setAccent(a)}
                  aria-pressed={a === accent}
                  aria-label={`Colour ${i + 1}`}
                >
                  <i style={{ background: a }} />
                </button>
              ))}
            </div>
            <div className="lx-daynote">
              The colour is the rail on this list's reminders in the ledger.
            </div>
          </div>

          {!creating && (
            <div className="lx-quiet-note">
              {`${open} open item${open === 1 ? "" : "s"}. Deleting the list deletes them too — undo is offered for nine seconds.`}
            </div>
          )}
        </div>
      </div>

      <div className="lx-sheet-foot">
        <button className="lx-save" onClick={commit}>
          {creating ? "CREATE LIST" : "SAVE"}
        </button>
        {!creating && (
          <button className="lx-kill" onClick={onDelete}>
            DELETE
          </button>
        )}
      </div>
    </div>
  );
}
