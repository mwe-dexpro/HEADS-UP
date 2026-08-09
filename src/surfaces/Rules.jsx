/* ============================================================
   Rules — keywords in, a ladder of reminders out
   ------------------------------------------------------------
   Decision 003: keyword rules, not AI inference. The test box is
   the whole argument — type a title, see the ladder it would
   produce, before it is real.
   ============================================================ */

import { useState, useMemo } from "react";
import { buildNudges, matchRules } from "../lib/nudges.js";
import { ruleMatchCounts, ruleWarnings } from "../lib/rules.js";
import {
  addDays,
  alertChip,
  capDate,
  clockOfMins,
  fmtDate,
  leadChip,
  leadLabel,
} from "../lib/time.js";
import { uid } from "../lib/util.js";
import { Toggle } from "../ui/atoms.jsx";

const ALL_LEADS = [14, 10, 7, 5, 2, 1, 0];

const PROBE_SAMPLES = [
  "Mara's birthday",
  "Flight LH1042 to Lisbon",
  "Dentist 14:30",
];

/* The test box runs the real engine on a synthetic event rather than describing
   what the engine would do. Invariant 10: buildNudges must stay free of to-do
   logic, which is what lets this single-event dataset tell the truth. */
function probe(text, data, now) {
  const at = addDays(now, 10);
  at.setHours(9, 0, 0, 0);
  const event = {
    id: "probe",
    title: text,
    start: at.toISOString(),
    end: null,
    allDay: true,
    location: "",
    description: "",
    recurring: false,
    repeats: "",
    organizer: null,
    tasks: [],
    alerts: [],
    cat: "personal",
    source: "manual",
  };
  const nudges = buildNudges({
    events: [event],
    rules: data.rules,
    state: { done: {}, snoozed: {}, seen: {}, muted: {}, notified: [] },
    settings: data.settings,
  });
  return {
    at,
    matched: matchRules(event, data.rules),
    nudges: nudges
      .slice()
      .sort((a, b) => new Date(a.baseDueAt) - new Date(b.baseDueAt)),
  };
}

function TestBox({ data, now, text, onText }) {
  const { at, matched, nudges } = useMemo(
    () => probe(text, data, now),
    [text, data, now],
  );
  const trimmed = text.trim();
  let verdict = "NOTHING TYPED";
  if (trimmed) {
    if (matched.length)
      verdict = `MATCHES “${matched.map((r) => r.name.toUpperCase()).join(", ")}” → ${
        nudges.length
      } REMINDER${nudges.length === 1 ? "" : "S"}`;
    else if (data.settings.fallback) verdict = "NO RULE MATCHES → CATCH-ALL";
    else verdict = "NO RULE MATCHES";
  }
  return (
    <div className="lx-testbox">
      <div className="lx-test-head">
        <span className="lx-test-k">TEST AN EVENT TITLE</span>
        <span className="lx-test-d">AGAINST {capDate(at)}</span>
      </div>
      <input
        className="lx-input-dark"
        value={text}
        onChange={(e) => onText(e.target.value)}
        placeholder="Type an event title"
        aria-label="Event title to test"
      />
      <div className="lx-chips">
        {PROBE_SAMPLES.map((s) => (
          <button key={s} className="lx-chip-dark" onClick={() => onText(s)}>
            {s}
          </button>
        ))}
      </div>
      <div className="lx-test-out">
        <div className="lx-verdict">{verdict}</div>
        {trimmed && nudges.length > 0 && (
          <div className="lx-test-rows">
            {nudges.map((n) => (
              <div className="lx-test-row" key={n.id}>
                <span className="t">{n.label}</span>
                <span className="l">
                  {n.alertMinutes != null
                    ? alertChip(n.alertMinutes)
                    : leadChip(n.lead)}
                </span>
                <span className="d">{fmtDate(n.baseDueAt)}</span>
              </div>
            ))}
          </div>
        )}
        {trimmed && nudges.length === 0 && (
          <div className="lx-test-none">
            This title produces nothing.{" "}
            {data.settings.fallback
              ? "Even the catch-all stayed quiet."
              : "The catch-all is off, so nothing would fire."}
          </div>
        )}
      </div>
    </div>
  );
}

function KeywordEditor({ rule, onPatch }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const commit = () => {
    const v = draft.trim().toLowerCase();
    if (v && !rule.keywords.includes(v))
      onPatch({ keywords: [...rule.keywords, v] });
    setDraft("");
    setAdding(false);
  };
  return (
    <div className="lx-kwedit">
      {rule.keywords.map((k) => (
        <span className="k" key={k}>
          {k}
          <button
            onClick={() =>
              onPatch({ keywords: rule.keywords.filter((x) => x !== k) })
            }
            aria-label={`Remove ${k}`}
          >
            ×
          </button>
        </span>
      ))}
      {adding ? (
        <input
          className="lx-kwinput"
          autoFocus
          value={draft}
          placeholder="keyword"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
        />
      ) : (
        <button className="lx-add" onClick={() => setAdding(true)}>
          + add
        </button>
      )}
    </div>
  );
}

function TaskEditor({ task, onPatch, onRemove }) {
  const leads = task.leads || [];
  const days = leads.map((l) => l.days);
  const hour = leads.length ? (leads[0].hour ?? 9) : 9;
  /* Presets, plus any lead the user already has that is not one of them. */
  const shown = [...new Set([...ALL_LEADS, ...days])].sort((a, b) => b - a);
  const toggle = (d) =>
    onPatch({
      leads: days.includes(d)
        ? leads.filter((l) => l.days !== d)
        : [...leads, { days: d, hour }].sort((a, b) => b.days - a.days),
    });
  const dead = leads.length === 0;
  return (
    <div className="lx-task">
      <div className="lx-task-top">
        <input
          className="lx-task-name"
          value={task.label}
          onChange={(e) => onPatch({ label: e.target.value })}
          aria-label="Task name"
        />
        <span className={`lx-task-count${dead ? " dead" : ""}`}>
          {dead ? "NEVER FIRES" : `${leads.length} REM`}
        </span>
        <button
          className="lx-task-x"
          onClick={onRemove}
          aria-label={`Remove ${task.label}`}
        >
          ×
        </button>
      </div>
      <div className="lx-leadchips">
        {shown.map((d) => (
          <button
            key={d}
            className={`lx-leadchip${days.includes(d) ? " on" : ""}`}
            onClick={() => toggle(d)}
            aria-pressed={days.includes(d)}
          >
            {leadChip(d)}
          </button>
        ))}
      </div>
      {dead && (
        <div className="lx-task-dead">
          No lead times — this task never produces a reminder.
        </div>
      )}
    </div>
  );
}

function RuleCard({ rule, matches, open, onToggle, onPatch, onDelete }) {
  const leads = (rule.tasks || []).flatMap((t) =>
    (t.leads || []).map((l) => l.days),
  );
  const max = Math.max(14, ...(leads.length ? leads : [14]));
  const noKeywords = rule.keywords.length === 0;
  const dead =
    noKeywords || leads.length === 0 || matches === 0 || !rule.enabled;
  return (
    <article className={`lx-rule${dead ? " dead" : ""}`}>
      <button className="lx-rule-btn" onClick={onToggle} aria-expanded={open}>
        <div className="lx-rule-top">
          <span className="lx-rule-name">{rule.name}</span>
          <span className="lx-rule-caret">{open ? "CLOSE" : "EDIT"}</span>
        </div>
        <div className="lx-kw">
          {rule.keywords.map((k) => (
            <span className="k" key={k}>
              {k}
            </span>
          ))}
          {noKeywords && <span className="k none">no keywords</span>}
          {!rule.enabled && <span className="k none">muted</span>}
        </div>
        <div className="lx-ladder-wrap">
          <div className="lx-ladder">
            <div className="base" />
            <div className="end" />
            {leads.map((d, i) => (
              <i
                key={i}
                style={{ left: `${(100 - (d / max) * 100).toFixed(1)}%` }}
              />
            ))}
          </div>
          <span className="lx-ladder-sum">
            {`${leads.length} REM · ${matches} EVENT${matches === 1 ? "" : "S"}`}
          </span>
        </div>
      </button>

      {open && (
        <div className="lx-rule-open">
          <div className="lx-fieldlabel">NAME</div>
          <input
            className="lx-in plain"
            value={rule.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            aria-label="Rule name"
          />

          <div className="lx-fieldlabel">KEYWORDS</div>
          <KeywordEditor rule={rule} onPatch={onPatch} />

          <div className="lx-fieldlabel">TASKS AND LEAD TIMES</div>
          <div className="lx-tasks">
            {(rule.tasks || []).map((t, i) => (
              <TaskEditor
                key={t.id}
                task={t}
                onPatch={(patch) =>
                  onPatch({
                    tasks: rule.tasks.map((x, j) =>
                      j === i ? { ...x, ...patch } : x,
                    ),
                  })
                }
                onRemove={() =>
                  onPatch({ tasks: rule.tasks.filter((_, j) => j !== i) })
                }
              />
            ))}
            <button
              className="lx-dash sm"
              onClick={() =>
                onPatch({
                  tasks: [
                    ...(rule.tasks || []),
                    {
                      id: uid(),
                      label: "New task",
                      leads: [{ days: 1, hour: 9 }],
                    },
                  ],
                })
              }
            >
              + add a task
            </button>
          </div>

          <div className="lx-rowcard" style={{ marginTop: 14 }}>
            <span className="t">Rule is on</span>
            <Toggle
              on={rule.enabled}
              label="Rule is on"
              onClick={() => onPatch({ enabled: !rule.enabled })}
            />
          </div>

          <div className="lx-rule-act">
            <button className="lx-btn-quiet" onClick={onToggle}>
              Close
            </button>
            <button className="lx-btn-warn" onClick={onDelete}>
              Delete
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export function Rules({
  data,
  now,
  onPatchRules,
  onDeleteRule,
  onPatchSettings,
}) {
  const [openRule, setOpenRule] = useState(null);
  const [test, setTest] = useState(PROBE_SAMPLES[0]);

  const matchCounts = useMemo(
    () => ruleMatchCounts(data),
    [data.rules, data.events],
  );
  const warnings = useMemo(
    () => ruleWarnings(data, matchCounts),
    [data, matchCounts],
  );

  const patchRule = (id, patch) =>
    onPatchRules(data.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const newRule = () => {
    const rule = {
      id: uid(),
      name: "New rule",
      keywords: [],
      enabled: true,
      tasks: [
        { id: uid(), label: "Do the thing", leads: [{ days: 1, hour: 9 }] },
      ],
    };
    onPatchRules([...data.rules, rule]);
    setOpenRule(rule.id);
  };

  return (
    <div className="lx-page">
      <div className="lx-head">
        <div>
          <div className="lx-h1">Rules</div>
          <div className="lx-h1-sub">
            {`${data.rules.length} RULES · ${warnings.length} NEED ATTENTION`}
          </div>
        </div>
        <button className="lx-btn-out" onClick={newRule}>
          New rule
        </button>
      </div>

      <TestBox data={data} now={now} text={test} onText={setTest} />

      {warnings.length > 0 && (
        <div className="lx-warns">
          <h4>
            {warnings.length === 1
              ? "1 RULE DOES NOTHING"
              : `${warnings.length} THINGS SILENTLY DO NOTHING`}
          </h4>
          <div className="lx-warnlist">
            {warnings.map((w, i) => (
              <div className="lx-warn" key={i}>
                <i />
                <span>
                  <strong>{w.rule}</strong> {w.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.rules.map((r) => (
          <RuleCard
            key={r.id}
            rule={r}
            matches={matchCounts[r.id] || 0}
            open={openRule === r.id}
            onToggle={() => setOpenRule(openRule === r.id ? null : r.id)}
            onPatch={(patch) => patchRule(r.id, patch)}
            onDelete={() => {
              setOpenRule(null);
              onDeleteRule(r);
            }}
          />
        ))}
      </div>

      <div className="lx-catchall">
        <div className="top">
          <div style={{ minWidth: 0 }}>
            <div className="t">Catch-all reminder</div>
            <div className="d">
              {`For events no rule recognises. One reminder, ${leadLabel(
                data.settings.defaultLead ?? 1,
              )} at ${clockOfMins(data.settings.fallbackHour * 60)}.`}
            </div>
          </div>
          <Toggle
            large
            on={data.settings.fallback}
            label="Catch-all reminder"
            onClick={() =>
              onPatchSettings({ fallback: !data.settings.fallback })
            }
          />
        </div>
      </div>
    </div>
  );
}
