/* ============================================================
   Settings — behind the header control, not a tab
   ------------------------------------------------------------
   Four tabs are the four things the app does; everything that is
   configured about them lives here, one sheet deep, including the
   .ics import and the erase.
   ============================================================ */

import { useState } from "react";
import { CAL_VIEWS } from "../lib/calendar.js";
import { APP_VERSION, HORIZON_DAYS } from "../lib/config.js";
import { defaultRules } from "../lib/data.js";
import { parseICS } from "../lib/ics.js";
import { leadChip } from "../lib/time.js";
import { Seg, Toggle } from "../ui/atoms.jsx";
import { useSheetDrag } from "../ui/gestures.js";

const SNOOZE_OPTS = [
  ["15m", "15 minutes"],
  ["1h", "1 hour"],
  ["3h", "3 hours"],
];

const SOUND_OPTS = [
  ["chime", "Chime"],
  ["ping", "Ping"],
  ["marimba", "Marimba"],
  ["none", "Silent"],
];

const LEAD_PRESETS = [0, 1, 2, 7];

function ImportPanel({ data, persist, onDone }) {
  const [raw, setRaw] = useState("");
  const [markRead, setMarkRead] = useState(true);
  const [result, setResult] = useState(null);

  const ingest = (text) => {
    const found = parseICS(text);
    if (!found.length) {
      setResult("No events found. Is this an .ics file?");
      return;
    }
    const existing = new Set(data.events.map((e) => e.id));
    const fresh = found.filter((e) => !existing.has(e.id));
    /* Invariant 4: every path that adds events decides seen-ness explicitly. */
    const seen = { ...data.state.seen };
    if (markRead) {
      const stamp = new Date().toISOString();
      fresh.forEach((e) => {
        seen[e.id] = stamp;
      });
    }
    persist({
      ...data,
      events: [...data.events.filter((e) => e.source !== "sample"), ...fresh],
      state: { ...data.state, seen },
    });
    setRaw("");
    setResult(
      `Added ${fresh.length} event${fresh.length === 1 ? "" : "s"}${
        found.length - fresh.length
          ? `, skipped ${found.length - fresh.length} already here`
          : ""
      }.${markRead ? " All marked as read." : ""}`,
    );
    if (onDone) onDone();
  };

  return (
    <div className="lx-set-block">
      <div className="t">Import an .ics file</div>
      <div className="lx-set-row" style={{ padding: "0 0 10px" }}>
        <span className="d" style={{ marginTop: 0 }}>
          Outlook: open the calendar on the web, choose Share, then Publish a
          calendar and download the ICS link. Repeating events are expanded for{" "}
          {HORIZON_DAYS} days.
        </span>
      </div>
      <input
        className="lx-file"
        type="file"
        accept=".ics,text/calendar"
        aria-label="Upload an .ics file"
        onChange={(e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const r = new FileReader();
          r.onload = () => ingest(String(r.result));
          r.onerror = () => setResult("Couldn't read that file.");
          r.readAsText(file);
        }}
      />
      <textarea
        className="lx-ta"
        style={{ marginTop: 10 }}
        rows={3}
        value={raw}
        placeholder="BEGIN:VCALENDAR…"
        onChange={(e) => setRaw(e.target.value)}
        aria-label="Paste .ics contents"
      />
      <div className="lx-set-row" style={{ padding: "10px 0 0" }}>
        <span className="d" style={{ marginTop: 0 }}>
          Mark everything in this import as read, so a year of events doesn't
          land in New at once.
        </span>
        <Toggle
          on={markRead}
          label="Mark as read"
          onClick={() => setMarkRead(!markRead)}
        />
      </div>
      <button
        className="lx-btn-out"
        style={{ width: "100%", height: 44, marginTop: 12 }}
        onClick={() => raw.trim() && ingest(raw)}
      >
        Read the calendar
      </button>
      {result && (
        <div className="lx-warnline" style={{ marginTop: 12, marginBottom: 0 }}>
          {result}
        </div>
      )}
    </div>
  );
}

export function Settings({
  data,
  persist,
  undoable,
  notifyState,
  onRequestNotify,
  onClose,
}) {
  const S = data.settings;
  const put = (patch) => persist({ ...data, settings: { ...S, ...patch } });
  const [importOpen, setImportOpen] = useState(false);
  const drag = useSheetDrag(onClose);

  const sources = ["ics", "manual", "sample"]
    .map((k) => ({
      k,
      n: data.events.filter((e) => (e.source || "manual") === k).length,
    }))
    .filter((s) => s.n > 0);
  const sourceName = {
    ics: "Imported calendar",
    manual: "Added by hand",
    sample: "Sample events",
  };

  return (
    <div
      className="lx-sheet"
      role="dialog"
      aria-label="Settings"
      style={drag.style}
    >
      <div className="lx-grab" aria-hidden="true" {...drag.bind}>
        <i />
      </div>
      <div className="lx-sheet-head" {...drag.bind}>
        <button className="lx-close" onClick={onClose}>
          ‹ Close
        </button>
        <span className="title">SETTINGS</span>
        <span className="pad" />
      </div>

      <div className="lx-sheet-body" style={{ padding: "18px 16px 30px" }}>
        <div className="lx-set-label">REMINDERS</div>
        <div className="lx-set-group">
          <div className="lx-set-row">
            <div style={{ minWidth: 0 }}>
              <div className="t">Quiet hours</div>
              <div className="d">
                {S.quiet
                  ? `Reminders inside these hours move to ${S.quietTo}.`
                  : "Reminders can fire at any hour."}
              </div>
            </div>
            <Toggle
              on={S.quiet}
              label="Quiet hours"
              onClick={() => put({ quiet: !S.quiet })}
            />
          </div>
          {S.quiet && (
            <div className="lx-set-block">
              <div className="lx-two">
                <div>
                  <div className="lx-minilabel">FROM</div>
                  <input
                    type="time"
                    className="lx-time"
                    value={S.quietFrom}
                    onChange={(e) => put({ quietFrom: e.target.value })}
                    aria-label="Quiet hours from"
                  />
                </div>
                <div>
                  <div className="lx-minilabel">UNTIL</div>
                  <input
                    type="time"
                    className="lx-time"
                    value={S.quietTo}
                    onChange={(e) => put({ quietTo: e.target.value })}
                    aria-label="Quiet hours until"
                  />
                </div>
              </div>
            </div>
          )}
          <div className="lx-set-block">
            <div className="t">Catch-all lead time</div>
            <div className="lx-chips" style={{ marginTop: 0 }}>
              {LEAD_PRESETS.map((n) => (
                <button
                  key={n}
                  className={`lx-chip sm${S.defaultLead === n ? " on" : ""}`}
                  onClick={() => put({ defaultLead: n })}
                >
                  {leadChip(n)}
                </button>
              ))}
            </div>
            <div className="d" style={{ marginTop: 8 }}>
              How far ahead the catch-all fires for events no rule recognises.
            </div>
          </div>
          <div className="lx-set-row">
            <span className="t">Default snooze</span>
            <select
              className="lx-select"
              value={S.defaultSnooze}
              onChange={(e) => put({ defaultSnooze: e.target.value })}
              aria-label="Default snooze"
            >
              {SNOOZE_OPTS.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="lx-set-label">CALENDAR</div>
        <div className="lx-set-group">
          <div className="lx-set-block">
            <div className="t">Opens on</div>
            <Seg
              options={CAL_VIEWS}
              value={S.calDefault}
              onPick={(v) => put({ calDefault: v })}
            />
          </div>
          <div className="lx-set-block">
            <div className="t">Week starts on</div>
            <Seg
              options={[
                ["mon", "MONDAY"],
                ["sun", "SUNDAY"],
              ]}
              value={S.weekStart}
              onPick={(v) => put({ weekStart: v })}
            />
          </div>
          <div className="lx-set-row">
            <span className="t">Show week numbers</span>
            <Toggle
              on={S.weekNums}
              label="Show week numbers"
              onClick={() => put({ weekNums: !S.weekNums })}
            />
          </div>
        </div>

        <div className="lx-set-label">LISTS</div>
        <div className="lx-set-group">
          <div className="lx-set-block">
            <div className="t">Undated items sit at</div>
            <Seg
              options={[
                ["top", "TOP"],
                ["bottom", "BOTTOM"],
              ]}
              value={S.undatedAt}
              onPick={(v) => put({ undatedAt: v })}
            />
          </div>
          <div className="lx-set-row">
            <div style={{ minWidth: 0 }}>
              <div className="t">Day-of nudge for dated to-dos</div>
              <div className="d">
                A dated to-do with no reminder of its own still speaks up on the
                day.
              </div>
            </div>
            <Toggle
              on={S.todoAutoRemind}
              label="Day-of nudge for dated to-dos"
              onClick={() => put({ todoAutoRemind: !S.todoAutoRemind })}
            />
          </div>
          <div className="lx-set-row">
            <div style={{ minWidth: 0 }}>
              <div className="t">Ask before deleting</div>
              <div className="d">
                Off by default: deleting is undoable, which is cheaper than a
                dialog.
              </div>
            </div>
            <Toggle
              on={S.confirmDelete}
              label="Ask before deleting"
              onClick={() => put({ confirmDelete: !S.confirmDelete })}
            />
          </div>
        </div>

        <div className="lx-set-label">NOTIFICATIONS</div>
        <div className="lx-set-group">
          <div className="lx-set-row">
            <div style={{ minWidth: 0 }}>
              <div className="t">System notifications</div>
              <div className="d">
                {notifyState === "granted"
                  ? "On — they fire while the app is open."
                  : notifyState === "denied"
                    ? "Blocked by the browser. Change it in site settings."
                    : notifyState === "unsupported"
                      ? "Not available in this context."
                      : "Not asked yet."}
              </div>
            </div>
            {notifyState !== "granted" && notifyState !== "unsupported" && (
              <button className="lx-btn-out" onClick={onRequestNotify}>
                Allow
              </button>
            )}
          </div>
          <div className="lx-set-row">
            <div style={{ minWidth: 0 }}>
              <div className="t">Sound</div>
              <div className="d">
                Silent suppresses the alert tone. The tone itself is the
                platform's.
              </div>
            </div>
            <select
              className="lx-select"
              value={S.sound}
              onChange={(e) => put({ sound: e.target.value })}
              aria-label="Sound"
            >
              {SOUND_OPTS.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="lx-set-row">
            <span className="t">Badge on the app icon</span>
            <Toggle
              on={S.badge}
              label="Badge on the app icon"
              onClick={() => put({ badge: !S.badge })}
            />
          </div>
          <div className="lx-set-row">
            <span className="t">Haptics</span>
            <Toggle
              on={S.haptics}
              label="Haptics"
              onClick={() => put({ haptics: !S.haptics })}
            />
          </div>
        </div>

        <div className="lx-set-label">NEW EVENTS</div>
        <div className="lx-set-group">
          <div className="lx-set-row">
            <div style={{ minWidth: 0 }}>
              <div className="t">Watch for events others add</div>
              <div className="d">
                Queues anything new on a shared calendar under NEW in Calendar,
                instead of letting it turn into reminders unseen.
              </div>
            </div>
            <Toggle
              on={S.watchNew}
              label="Watch for events others add"
              onClick={() => put({ watchNew: !S.watchNew })}
            />
          </div>
          {S.watchNew && (
            <>
              <div className="lx-set-row">
                <div style={{ minWidth: 0 }}>
                  <div className="t">Only events I didn't organise</div>
                  <div className="d">
                    Needs your address below to tell them apart.
                  </div>
                </div>
                <Toggle
                  on={S.watchOnlyOthers}
                  label="Only events I didn't organise"
                  onClick={() => put({ watchOnlyOthers: !S.watchOnlyOthers })}
                />
              </div>
              <div className="lx-set-block">
                <div className="t">Your address</div>
                <input
                  className="lx-in plain"
                  value={S.myEmail}
                  placeholder="you@example.com"
                  onChange={(e) => put({ myEmail: e.target.value })}
                  aria-label="Your address"
                />
              </div>
            </>
          )}
        </div>

        <div className="lx-set-label">CALENDAR SOURCES</div>
        <div className="lx-seam r12" style={{ marginBottom: 10 }}>
          {sources.map((s) => (
            <div
              style={{ background: "var(--card)", padding: "12px 13px" }}
              key={s.k}
            >
              <div className="t" style={{ font: "500 14.5px var(--body)" }}>
                {sourceName[s.k]}
              </div>
              <div
                style={{
                  font: "500 9.5px var(--mono)",
                  letterSpacing: ".08em",
                  color: "var(--mute-3)",
                  marginTop: 4,
                }}
              >
                {`${s.n} EVENT${s.n === 1 ? "" : "S"}`}
              </div>
            </div>
          ))}
        </div>
        <div className="lx-set-group">
          {importOpen ? (
            <ImportPanel
              data={data}
              persist={persist}
              onDone={() => setImportOpen(false)}
            />
          ) : (
            <button
              className="lx-dash sm"
              style={{ border: 0, borderRadius: 0, height: 48 }}
              onClick={() => setImportOpen(true)}
            >
              ＋ Import another calendar
            </button>
          )}
        </div>

        <div className="lx-set-label">DATA</div>
        <div className="lx-set-group">
          <div className="lx-set-block">
            <div className="t">Start the rules again</div>
            <div className="d">
              Puts the six starter rules back. Events and lists are untouched.
            </div>
            <button
              className="lx-btn-danger"
              style={{ marginTop: 11 }}
              onClick={() => {
                undoable(
                  { ...data, rules: defaultRules() },
                  "Rules reset to the six starters",
                  "RULES REPLACED",
                );
                onClose();
              }}
            >
              RESET ALL RULES
            </button>
          </div>
          <div className="lx-set-block">
            <div className="t">Erase events and lists</div>
            <div className="d">
              Removes every event, every list, and every completion and snooze
              along with them. Your rules and these settings stay. Undoable for
              nine seconds, and only that long.
            </div>
            <button
              className="lx-btn-danger"
              style={{ marginTop: 11 }}
              onClick={() => {
                /* Actually empty, rather than the sample data all over again: a
                   button that says erase and hands back fifteen events and eight
                   lists reads as broken, because you cannot tell it did anything. */
                undoable(
                  {
                    ...data,
                    events: [],
                    lists: [],
                    state: {
                      done: {},
                      snoozed: {},
                      notified: [],
                      seen: {},
                      muted: {},
                    },
                  },
                  "Events and lists erased",
                  `${data.events.length} EVENTS · ${data.lists.length} LISTS`,
                );
                onClose();
              }}
            >
              ERASE EVENTS AND LISTS
            </button>
          </div>
        </div>
        <div className="lx-version">LADDER {APP_VERSION} · HEADS UP</div>
      </div>
    </div>
  );
}
