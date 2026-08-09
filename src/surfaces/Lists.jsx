/* ============================================================
   Lists — to-dos, with or without a date
   ------------------------------------------------------------
   A to-do with no date never nudges. That is the deal, and the
   list says so out loud rather than letting you discover it.

   The sheets a list opens — naming a list, opening a to-do —
   belong to the shell, not to this surface. It asks by callback.
   ============================================================ */

import { useState } from "react";
import { ACCENTS } from "../lib/data.js";
import { startOfDay } from "../lib/time.js";
import { itemTags, listMeta } from "../lib/todos.js";
import { Empty, SectionHead } from "../ui/atoms.jsx";
import { SWIPE_T, usePager } from "../ui/gestures.js";

/* ---------- one row ---------- */
function TodoRow({
  item,
  now,
  plain,
  rail,
  swipe,
  selMode,
  picked,
  onOpen,
  onCircle,
  onDone,
  onDelete,
  onLongPress,
}) {
  const dx = swipe.dxFor(item.id);
  const tags = itemTags(item, now);
  const bind = swipe.bind(item.id, {
    disabled: selMode,
    onDone,
    onDelete,
    onLongPress,
  });
  return (
    <div className={`lx-sw${plain ? " flat" : ""}`}>
      <div className="lx-sw-under done" style={{ opacity: dx > 0 ? 1 : 0 }}>
        <span className="lab">{dx >= SWIPE_T ? "RELEASE · DONE" : "DONE"}</span>
      </div>
      <div className="lx-sw-under del" style={{ opacity: dx < 0 ? 1 : 0 }}>
        <span className="lab">
          {-dx >= SWIPE_T ? "RELEASE · DELETE" : "DELETE"}
        </span>
      </div>
      <div
        className={`lx-todo${plain ? " plain" : ""}${picked ? " picked" : ""}`}
        style={{
          borderLeftColor: plain ? undefined : rail,
          transform: `translateX(${dx}px)`,
          transition: swipe.anim
            ? "transform .24s cubic-bezier(.2,.8,.2,1)"
            : "none",
        }}
        onClick={() => {
          if (swipe.tapBlocked()) return;
          onOpen();
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onOpen();
          }
        }}
        {...bind}
      >
        <div className="lx-todo-grid">
          <button
            className={`lx-circle${picked ? " on" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              /* The circle sits inside the swipe target, so a gesture that began
                 on it must not also fire its click on release. */
              if (swipe.tapBlocked()) return;
              onCircle();
            }}
            aria-label={
              picked ? `Deselect ${item.title}` : `Mark ${item.title} done`
            }
          >
            <i>{picked ? "✓" : ""}</i>
          </button>
          {plain ? (
            <span className="lx-todo-t one">{item.title}</span>
          ) : (
            <div style={{ minWidth: 0 }}>
              <div className="lx-todo-t">{item.title}</div>
              <div className="lx-tags">
                {tags.map((t) => (
                  <span
                    key={t.key}
                    className={`lx-tag${t.solid ? " solid" : ""}`}
                    style={
                      t.solid
                        ? { color: t.fg, background: t.bg }
                        : t.mute
                          ? { color: "var(--mute-3)" }
                          : undefined
                    }
                  >
                    {t.label}
                  </span>
                ))}
              </div>
            </div>
          )}
          <span className="lx-todo-caret">›</span>
        </div>
      </div>
    </div>
  );
}

/* ---------- overview ---------- */
export function ListsOverview({
  data,
  now,
  swipe,
  onPick,
  onPickItem,
  onNewList,
  onEditList,
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const hits = [];
  if (q)
    data.lists.forEach((l) =>
      (l.items || [])
        .filter((i) => !i.done && i.title.toLowerCase().includes(q))
        .forEach((i) => hits.push({ item: i, list: l })),
    );

  return (
    <div className="lx-page">
      <div className="lx-head">
        <div>
          <div className="lx-h1">Lists</div>
          <div className="lx-h1-sub">
            {`${data.lists.length} LIST${data.lists.length === 1 ? "" : "S"}`}
          </div>
        </div>
      </div>

      <input
        className="lx-input"
        style={{ marginBottom: 16 }}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search every list"
        aria-label="Search every list"
      />

      {q ? (
        <>
          {hits.length > 0 && (
            <div className="lx-seam r11">
              {hits.map(({ item, list }) => (
                <button
                  className="lx-hit"
                  key={item.id}
                  onClick={() => {
                    setQuery("");
                    onPickItem(list.id, item.id);
                  }}
                >
                  <span className="t">{item.title}</span>
                  <span className="l">{list.name.toUpperCase()}</span>
                </button>
              ))}
            </div>
          )}
          {hits.length === 0 && (
            <div className="lx-quiet-note" style={{ padding: "6px 2px" }}>
              Nothing matches.
            </div>
          )}
        </>
      ) : (
        <>
          <div className="lx-seam r12">
            {data.lists.map((l) => {
              const m = listMeta(l, now);
              return (
                <button
                  className="lx-listrow"
                  key={l.id}
                  onClick={() => {
                    if (swipe.tapBlocked()) return;
                    onPick(l.id);
                  }}
                  {...swipe.bind(l.id, {
                    pressOnly: true,
                    onLongPress: () => onEditList(l.id),
                  })}
                >
                  <span className="bar" style={{ background: m.barFg }} />
                  <span className="mid">
                    <span className="name">{l.name}</span>
                    <span className="meta" style={{ color: m.metaFg }}>
                      {m.meta}
                    </span>
                  </span>
                  <span className="right">
                    <span className="count">{m.count}</span>
                    <span className="caret">›</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="lx-gesture-hint" style={{ margin: "12px 0 0" }}>
            <span>HOLD A LIST TO RENAME IT</span>
          </div>
          {/* Pinned to the bottom of the reach rather than the bottom of the
              page: with a screenful of lists the create action would otherwise
              be the one thing a thumb cannot get to. */}
          <div className="lx-sticky-act" style={{ marginTop: 10 }}>
            <button className="lx-dash" onClick={onNewList}>
              + New list
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- one list ---------- */
export function ListDetail({
  data,
  list,
  now,
  ops,
  swipe,
  sel,
  setSel,
  onOpenTodo,
  onEditList,
  onBack,
}) {
  const [draft, setDraft] = useState("");
  const [showDone, setShowDone] = useState(false);
  const items = list.items || [];
  const open = items.filter((i) => !i.done);
  const doneItems = items.filter((i) => i.done);
  const dated = open
    .filter((i) => i.due)
    .sort((a, b) => new Date(a.due) - new Date(b.due));
  const undated = open.filter((i) => !i.due);
  const selMode = sel.length > 0;
  /* Back is a swipe from the left edge as well as a button, because the button
     is in the one corner of a phone a thumb cannot reach. Rows swipe for
     themselves, so the gesture refuses to start on one. */
  const back = usePager(onBack, () => {}, swipe.buzz, {
    edge: 30,
    ignore: ".lx-sw,button",
  });
  const rail = (item) =>
    item.due && new Date(item.due) < startOfDay(now)
      ? "var(--amber-ink)"
      : item.due
        ? list.accent || ACCENTS[0]
        : "var(--line)";

  const rowProps = (item, plain) => ({
    item,
    now,
    plain,
    rail: rail(item),
    swipe,
    selMode,
    picked: sel.includes(item.id),
    onOpen: () => {
      if (selMode) {
        setSel(
          sel.includes(item.id)
            ? sel.filter((x) => x !== item.id)
            : [...sel, item.id],
        );
        return;
      }
      onOpenTodo(item.id);
    },
    onCircle: () => {
      if (selMode) {
        setSel(
          sel.includes(item.id)
            ? sel.filter((x) => x !== item.id)
            : [...sel, item.id],
        );
        return;
      }
      ops.setDone(list.id, item, true);
    },
    onDone: () => ops.setDone(list.id, item, true),
    onDelete: () => ops.deleteItem(list.id, item),
    onLongPress: () => setSel([item.id]),
  });

  const datedBlock = dated.length > 0 && (
    <>
      <SectionHead label="WITH A DATE" />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginBottom: 20,
        }}
      >
        {dated.map((item) => (
          <TodoRow key={item.id} {...rowProps(item, false)} />
        ))}
      </div>
    </>
  );

  const undatedBlock = undated.length > 0 && (
    <>
      <div className="lx-sec-head">
        <span className="lx-sec-label">NO DATE</span>
        <span className="lx-rule-line" />
        <span className="lx-sec-count" style={{ fontWeight: 400 }}>
          NEVER NUDGES
        </span>
      </div>
      <div className="lx-seam r12" style={{ marginBottom: 20 }}>
        {undated.map((item) => (
          <TodoRow key={item.id} {...rowProps(item, true)} />
        ))}
      </div>
    </>
  );

  return (
    <div className="lx-page" style={back.style} {...back.bind}>
      <div style={{ padding: "6px 0 12px" }}>
        <button className="lx-back" onClick={onBack}>
          ‹ All lists
        </button>
        {/* The name is the control. Tapping it — or the ⋯ — opens the same
            sheet the list was created in, so renaming is where the name is. */}
        <div className="lx-listhead" style={{ marginTop: 4 }}>
          <button
            className="lx-namebtn"
            onClick={onEditList}
            aria-label={`Rename ${list.name}`}
          >
            <span
              className="lx-h1"
              style={{ display: "block", lineHeight: 1.15 }}
            >
              {list.name}
              <span className="pen">RENAME</span>
            </span>
            <span
              className="lx-h1-sub"
              style={{
                display: "block",
                marginTop: 5,
                letterSpacing: ".09em",
                fontSize: 10,
              }}
            >
              {`${open.length} OPEN · ${dated.length} DATED · ${doneItems.length} DONE`}
            </span>
          </button>
          <button
            className="lx-dots"
            onClick={onEditList}
            aria-label="List settings"
          >
            ⋯
          </button>
        </div>
      </div>

      {/* Adding is the reason this screen exists, so the field follows the
          scroll instead of disappearing off the top of it. */}
      <div className="lx-sticky-top">
        <input
          className="lx-input tall"
          value={draft}
          enterKeyHint="done"
          placeholder={`Add to ${list.name}`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              ops.addItem(list.id, draft.trim());
              setDraft("");
            }
          }}
          aria-label={`Add to ${list.name}`}
        />
      </div>

      {data.settings.undatedAt === "top" ? (
        <>
          {undatedBlock}
          {datedBlock}
        </>
      ) : (
        <>
          {datedBlock}
          {undatedBlock}
        </>
      )}

      {open.length === 0 && (
        <Empty
          title="Nothing in this list"
          detail="Type above to add the first thing."
        />
      )}

      {selMode && <div style={{ height: 150 }} />}

      {doneItems.length > 0 && (
        <>
          <button
            className="lx-donetoggle"
            onClick={() => setShowDone(!showDone)}
          >
            {`${showDone ? "HIDE" : "SHOW"} ${doneItems.length} COMPLETED`}
          </button>
          {showDone && (
            <div className="lx-seam" style={{ marginTop: 8 }}>
              {doneItems.map((item) => (
                <div className="lx-handled" key={item.id}>
                  <div className="t">{item.title}</div>
                  <button
                    className="lx-putback"
                    onClick={() => ops.setDone(list.id, item, false)}
                  >
                    Put back
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- bulk bar ---------- */
export function BulkBar({
  data,
  list,
  now,
  sel,
  setSel,
  panel,
  setPanel,
  ops,
}) {
  const items = (list.items || []).filter((i) => !i.done);
  const picked = items.filter((i) => sel.includes(i.id));
  const allPicked = picked.length === items.length && items.length > 0;
  const weekendIn = (6 - now.getDay() + 7) % 7 || 6;
  const dates = [
    ["TODAY", 0],
    ["TOMORROW", 1],
    ["THIS WEEKEND", weekendIn],
    ["+1 WEEK", 7],
    ["NO DATE", null],
  ];
  return (
    <div className="lx-bulk" role="region" aria-label="Bulk actions">
      {panel === "date" && (
        <div className="lx-bulk-dates">
          {dates.map(([label, n]) => (
            <button
              key={label}
              className="lx-bulk-date"
              onClick={() => ops.bulkDate(list.id, picked, n)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {panel === "move" && (
        <div className="lx-bulk-lists">
          {data.lists
            .filter((l) => l.id !== list.id)
            .map((l) => (
              <button
                key={l.id}
                onClick={() => ops.bulkMove(list.id, picked, l.id)}
              >
                <span>{l.name}</span>
                <span className="n">
                  {(l.items || []).filter((i) => !i.done).length}
                </span>
              </button>
            ))}
        </div>
      )}
      <div className="lx-bulk-head">
        <div style={{ minWidth: 0 }}>
          <div className="lx-bulk-n">{`${sel.length} SELECTED`}</div>
          <div className="lx-bulk-hint">
            {sel.length === 1
              ? "Tap more items to add them"
              : "Tap items to add or remove"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 7, flex: "none" }}>
          <button
            className="lx-bulk-mini"
            onClick={() => setSel(allPicked ? [] : items.map((i) => i.id))}
          >
            {allPicked ? "NONE" : "ALL"}
          </button>
          <button
            className="lx-bulk-mini"
            onClick={() => {
              setSel([]);
              setPanel(null);
            }}
          >
            CANCEL
          </button>
        </div>
      </div>
      <div className="lx-bulk-acts">
        <button
          className="lx-bulk-act go"
          onClick={() => ops.bulkDone(list.id, picked)}
        >
          DONE
        </button>
        <button
          className={`lx-bulk-act ghost${panel === "date" ? " on" : ""}`}
          onClick={() => setPanel(panel === "date" ? null : "date")}
        >
          DATE
        </button>
        <button
          className={`lx-bulk-act ghost${panel === "move" ? " on" : ""}`}
          onClick={() => setPanel(panel === "move" ? null : "move")}
        >
          MOVE
        </button>
        <button
          className="lx-bulk-act kill"
          onClick={() => ops.bulkDelete(list.id, picked)}
        >
          DELETE
        </button>
      </div>
    </div>
  );
}
