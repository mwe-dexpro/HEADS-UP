/* ============================================================
   Shared atoms
   ------------------------------------------------------------
   The controls every surface uses, and nothing that knows what a
   nudge is. Sized from --tap and --field-type: 44px for anything
   tapped, 16px for anything typed into, which is not taste — below
   16px iOS Safari zooms on focus and does not zoom back.
   ============================================================ */

import { useState, useEffect } from "react";

export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/* The strip is the app's nameplate and nothing else. The clock sits with the
   date in the page header, where a date and a time belong together, and the
   battery is the operating system's job — its own status bar is directly above
   this one. */
export function StatusBar() {
  return (
    <div className="lx-status">
      <span />
      <span className="mark">LADDER</span>
      <span />
    </div>
  );
}

/* One key/value line. Every card body is made of these, in the same order,
   so the eye lands in the same place on every card. */
export function Row({ k, children }) {
  return (
    <div className="lx-kv-row">
      <span className="lx-kv-k">{k}</span>
      <span className="lx-kv-v">{children}</span>
    </div>
  );
}

export function Toggle({ on, onClick, large, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      aria-label={label}
      className={`lx-toggle${large ? " lg" : ""}${on ? " on" : ""}`}
      onClick={onClick}
    >
      <i />
    </button>
  );
}

export function Seg({ options, value, onPick, cols }) {
  return (
    <div
      className="lx-seg"
      style={{ gridTemplateColumns: `repeat(${cols || options.length},1fr)` }}
      role="tablist"
    >
      {options.map(([val, label]) => (
        <button
          key={val}
          role="tab"
          aria-selected={value === val}
          className={value === val ? "on" : ""}
          onClick={() => onPick(val)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function SectionHead({ label, count, children }) {
  return (
    <div className="lx-sec-head">
      <span className="lx-sec-label">{label}</span>
      <span className="lx-rule-line" />
      {count != null && <span className="lx-sec-count">{count}</span>}
      {children}
    </div>
  );
}

export function Empty({ title, detail }) {
  return (
    <div className="lx-empty">
      <div className="t">{title}</div>
      {detail && <div className="d">{detail}</div>}
    </div>
  );
}

/* ---------- tab-bar icons ----------
   Drawn from positioned blocks rather than an icon font: the runtime has no
   asset pipeline, and at 20px these read more clearly than a webfont glyph. */
export function TabIcon({ name }) {
  const parts = {
    upcoming: [
      { left: 3, top: 9, width: 15, height: 2 },
      { left: 2, top: 6, width: 8, height: 8, borderRadius: "50%" },
      {
        left: 11,
        top: 7,
        width: 6,
        height: 6,
        borderRadius: "50%",
        border: "2px solid currentColor",
        background: "var(--panel)",
      },
      { left: 5, top: 1, width: 2, height: 4 },
      { left: 5, top: 15, width: 2, height: 4 },
    ],
    lists: [
      { left: 2, top: 3, width: 4, height: 4 },
      { left: 9, top: 4, width: 9, height: 2 },
      { left: 2, top: 9, width: 4, height: 4 },
      { left: 9, top: 10, width: 9, height: 2 },
      { left: 2, top: 15, width: 4, height: 4 },
      { left: 9, top: 16, width: 9, height: 2 },
    ],
    calendar: [
      {
        left: 2,
        top: 3,
        width: 16,
        height: 15,
        border: "2px solid currentColor",
        borderRadius: 3,
        background: "transparent",
      },
      { left: 2, top: 3, width: 16, height: 5, borderRadius: "2px 2px 0 0" },
      { left: 5, top: 11, width: 3, height: 3 },
      { left: 11, top: 11, width: 3, height: 3 },
    ],
    rules: [
      {
        left: 1,
        top: 6,
        width: 7,
        height: 7,
        border: "2px solid currentColor",
        background: "transparent",
        transform: "rotate(45deg)",
      },
      { left: 9, top: 4, width: 2, height: 13 },
      { left: 11, top: 4, width: 7, height: 2 },
      { left: 11, top: 15, width: 7, height: 2 },
    ],
  };
  return (
    <>
      {(parts[name] || []).map((s, i) => (
        <i key={i} style={s} />
      ))}
    </>
  );
}
