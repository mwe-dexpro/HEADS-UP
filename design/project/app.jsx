const { useState, useEffect, useRef } = React;
const DS = window.MastercardInspiredDesignSystem_e60af1;
const { Button, Switch, Dialog } = DS;

const INITIAL_EVENTS = [
{ id: 'e1', name: "Mia's 7th birthday party", dateLabel: 'Sat, Aug 22', time: '2:00 PM', location: 'Home — backyard', description: 'Bounce house and magician booked for 3pm. Cake and candles after presents.', dayOffset: 4, source: 'native', recurrence: null },
{ id: 'e2', name: 'Move out of the old apartment by month end', dateLabel: 'Sun, Aug 30', time: 'All day', location: '214 Birchwood Ave, Apt 4B', description: 'Final walkthrough and key handoff with the landlord by 6pm.', dayOffset: 12, source: 'native', recurrence: null },
{ id: 'e3', name: 'Dr. Chen — annual checkup', dateLabel: 'Tue, Aug 25', time: '10:30 AM', location: 'Chen Family Medicine, Suite 200', description: 'Annual physical. Fasting required from midnight the night before.', dayOffset: 7, source: 'device', recurrence: null },
{ id: 'e4', name: 'Quarterly estimated taxes', dateLabel: 'Tue, Sep 15', time: 'All day', location: null, description: 'Estimated federal tax payment due to the IRS.', dayOffset: 28, source: 'native', recurrence: 'quarterly' }];

const INITIAL_TASKS = [
{ id: 't1', eventId: 'e1', name: 'Book magician & balloon artist for the party', bucket: 'overdue', dueLabel: 'Overdue by 2 days', dayOffset: -2, done: false, recurrence: null, reminders: [{ id: 'r1', label: '1 day before', date: 'Aug 21' }, { id: 'r2', label: 'Morning of', date: 'Aug 22' }] },
{ id: 't2', eventId: 'e1', name: 'Order birthday cake', bucket: 'next3', dueLabel: 'Today', dayOffset: 0, done: false, recurrence: null, reminders: [{ id: 'r3', label: '1 day before', date: 'Aug 18' }] },
{ id: 't3', eventId: 'e1', name: 'Send party invites', bucket: 'done', dueLabel: 'Completed Aug 14', done: true, recurrence: null, reminders: [] },
{ id: 't4', eventId: 'e1', name: 'Print photo banner', bucket: 'next3', dueLabel: 'Fri, Aug 21', dayOffset: 3, done: false, recurrence: null, reminders: [{ id: 'r4', label: 'Morning of', date: 'Aug 21' }] },
{ id: 't5', eventId: 'e2', name: 'Book moving truck', bucket: 'overdue', dueLabel: 'Overdue by 5 days', dayOffset: -5, done: false, recurrence: null, reminders: [{ id: 'r5', label: '1 week before', date: 'Aug 7' }, { id: 'r6', label: '1 day before', date: 'Aug 13' }] },
{ id: 't6', eventId: 'e2', name: 'Cancel old internet plan', bucket: 'upcoming', dueLabel: 'Thu, Aug 27', dayOffset: 9, done: false, recurrence: null, reminders: [{ id: 'r7', label: '1 day before', date: 'Aug 26' }] },
{ id: 't7', eventId: 'e2', name: 'Pack kitchen boxes', bucket: 'next3', dueLabel: 'Today', time: '5:00 PM', dayOffset: 0, done: false, recurrence: null, reminders: [{ id: 'r8', label: '1 hour before', date: 'Today, 5:00 PM' }] },
{ id: 't8', eventId: 'e3', name: 'Fast for 12 hours before appointment', bucket: 'nextweek', dueLabel: 'Mon, Aug 24 · 8pm', dayOffset: 6, done: false, recurrence: null, reminders: [{ id: 'r9', label: 'Custom · 8:00 PM day before', date: 'Aug 23, 8:00 PM' }] },
{ id: 't9', eventId: 'e3', name: 'Bring insurance card', bucket: 'nextweek', dueLabel: 'Tue, Aug 25', dayOffset: 7, done: false, recurrence: null, reminders: [] },
{ id: 't10', eventId: 'e4', name: 'Gather receipts', bucket: 'upcoming', dueLabel: 'Sep 15 · repeats quarterly', dayOffset: 28, done: false, recurrence: 'quarterly', reminders: [{ id: 'r10', label: '1 week before', date: 'Sep 8' }] },
{ id: 't11', eventId: 'e4', name: 'Pay estimated tax', bucket: 'upcoming', dueLabel: 'Sep 15 · repeats quarterly', dayOffset: 28, done: false, recurrence: 'quarterly', reminders: [{ id: 'r11', label: '1 day before', date: 'Sep 14' }, { id: 'r12', label: 'Morning of', date: 'Sep 15' }] },
{ id: 't12', eventId: null, listId: 'l3', priority: 'high', order: 0, name: 'Renew passport', bucket: 'overdue', dueLabel: 'Overdue by 9 days', done: false, recurrence: null, reminders: [{ id: 'r13', label: '1 week before', date: 'Aug 3' }] },
{ id: 't13', eventId: null, listId: 'l3', priority: 'normal', order: 1, name: 'Call the dentist', bucket: 'next3', dueLabel: 'Today', done: false, recurrence: null, reminders: [] },
{ id: 't14', eventId: null, listId: 'l3', priority: 'low', order: 2, name: 'Return library books', bucket: 'nextweek', dueLabel: 'Wed, Aug 26', done: false, recurrence: null, reminders: [{ id: 'r14', label: 'Morning of', date: 'Aug 26' }] },
{ id: 't15', eventId: null, listId: 'l3', priority: 'normal', order: 3, name: 'Drop off dry cleaning', bucket: null, dueLabel: null, done: false, recurrence: null, reminders: [] },
{ id: 't16', eventId: null, listId: 'l1', priority: 'normal', order: 0, name: 'Buy milk & eggs', bucket: null, dueLabel: null, done: false, recurrence: null, reminders: [] },
{ id: 't17', eventId: null, listId: 'l1', priority: 'low', order: 1, name: 'Restock coffee beans', bucket: null, dueLabel: null, done: false, recurrence: null, reminders: [] },
{ id: 't18', eventId: null, listId: 'l1', priority: 'high', order: 2, name: 'Pick up napkins & plates', bucket: null, dueLabel: null, done: false, recurrence: null, reminders: [] },
{ id: 't19', eventId: null, listId: 'l2', priority: 'high', order: 0, name: 'Fix the leaky bathroom faucet', bucket: null, dueLabel: null, done: false, recurrence: null, reminders: [] },
{ id: 't20', eventId: null, listId: 'l2', priority: 'normal', order: 1, name: 'Paint the hallway', bucket: null, dueLabel: null, done: false, recurrence: null, reminders: [] },
{ id: 't21', eventId: null, listId: 'l2', priority: 'low', order: 2, name: 'Assemble new bookshelf', bucket: null, dueLabel: null, done: false, recurrence: null, reminders: [] }];

const INITIAL_LISTS = [
{ id: 'l1', name: 'Groceries', color: 'var(--clay-brown)' },
{ id: 'l2', name: 'Home projects', color: 'var(--link-blue)' },
{ id: 'l3', name: 'Errands', color: 'oklch(47% 0.09 145)' }];

const PRESETS = ['1 week before', '1 day before', 'Morning of', '1 hour before'];
const TODAY_LABEL = 'Aug 18';

function Icon({ name, size = 18, style }) {return React.createElement('span', { style: { display: 'inline-flex', flex: 'none', width: size, height: size, ...style } }, React.createElement('i', { 'data-lucide': name, style: { width: size, height: size } }));}
let _iconsScheduled = false;
function useIcons(deps) {useEffect(() => {if (_iconsScheduled) return;_iconsScheduled = true;requestAnimationFrame(() => {_iconsScheduled = false;window.lucide && window.lucide.createIcons();});});}

function usePresence(active, duration = 260) {
  const [state, setState] = useState({ mounted: active, visible: active });
  useEffect(() => {
    let raf1, raf2, t;
    if (active) {
      setState({ mounted: true, visible: false });
      raf1 = requestAnimationFrame(() => {raf2 = requestAnimationFrame(() => setState({ mounted: true, visible: true }));});
    } else {
      setState((s) => s.mounted ? { mounted: true, visible: false } : s);
      t = setTimeout(() => setState({ mounted: false, visible: false }), duration);
    }
    return () => {cancelAnimationFrame(raf1);cancelAnimationFrame(raf2);clearTimeout(t);};
  }, [active]);
  return state;
}
function useLast(value) {
  const ref = useRef(value);
  if (value != null) ref.current = value;
  return value != null ? value : ref.current;
}

function StatusBar() {return <div className="status-bar"><span>9:30</span><div style={{ display: 'flex', gap: 6 }}><div className="dot" /><div className="dot" /><div className="dot" /></div></div>;}

function TaskRow({ task, event, list, eventProgress, onToggle, onOpen, selectMode, selected, onLongPress, onToggleSelect, onSwipeDone, onOpenMenu, celebrating, hideListBadge }) {
  const overdue = task.bucket === 'overdue' && !task.done;
  const highPriority = task.priority === 'high' && !task.done;
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef(null);
  const longPressTimer = useRef(null);
  const rowRef = useRef(null);
  const suppressClick = useRef(false);
  const listColor = list && list.color;

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    longPressTimer.current = setTimeout(() => {
      if (startRef.current) {onLongPress(task);suppressClick.current = true;navigator.vibrate && navigator.vibrate(8);}
    }, 500);
  }
  function onPointerMove(e) {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x,dy = e.clientY - startRef.current.y;
    if (!dragging && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {clearTimeout(longPressTimer.current);setDragging(true);}
    if (dragging) setDrag(Math.max(-120, Math.min(120, dx)));
  }
  function onPointerUp() {
    clearTimeout(longPressTimer.current);
    if (dragging) {
      if (drag > 70) onSwipeDone(task);else
      if (drag < -70 && rowRef.current) {
        const phoneEl = rowRef.current.closest('.phone');
        const prect = phoneEl.getBoundingClientRect(),rrect = rowRef.current.getBoundingClientRect();
        onOpenMenu(task, { x: rrect.left - prect.left, y: rrect.top - prect.top, w: rrect.width, h: rrect.height });
      }
      setDrag(0);setDragging(false);suppressClick.current = true;
    }
    startRef.current = null;
    setTimeout(() => {suppressClick.current = false;}, 0);
  }
  function handleClick() {
    if (suppressClick.current) return;
    if (selectMode) onToggleSelect(task);else onOpen(task);
  }

  return (
    <div className="task-row-wrap" ref={rowRef}>
{dragging && drag !== 0 && <div className={"swipe-hint " + (drag < 0 ? 'left' : 'right')} style={{ opacity: Math.min(1, Math.abs(drag) / 70) }}>
<Icon key={drag > 0 ? 'check' : 'more'} name={drag > 0 ? 'check' : 'more-horizontal'} size={18} />
</div>}
<div className={"task-row" + (overdue ? ' overdue' : '') + (highPriority ? ' high-priority' : '') + (selected ? ' selected' : '')} style={{ transform: `translateX(${drag}px)`, transition: dragging ? 'none' : 'transform .2s ease', boxShadow: listColor ? `inset 4px 0 0 0 ${listColor}, var(--shadow-1)` : undefined }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onClick={handleClick}>
{selectMode && <div className={"check select" + (selected ? ' done' : '')} onClick={(e) => {e.stopPropagation();onToggleSelect(task);}}>{selected && <Icon name="check" />}</div>}
{!selectMode && celebrating && <div className="check done cheer" style={{ pointerEvents: 'none' }}><Icon name="check" /><span className="cheer-burst">{[0, 60, 120, 180, 240, 300].map((a) => <span key={a} style={{ '--a': a + 'deg' }} />)}</span></div>}
{!selectMode && !celebrating && <div className={"check" + (task.done ? ' done' : '')} onClick={(e) => {e.stopPropagation();onToggle(task);}}>{task.done && <Icon name="check" />}</div>}
<div className="task-body">
<div className={"task-title" + (task.done ? ' done' : '')}>{task.name}</div>
<div className="task-meta">
{task.dueLabel && <span className={"due" + (overdue ? ' overdue' : '')}>{task.dueLabel}</span>}
{highPriority && <Icon name="flag" size={13} style={{ color: 'var(--clay-brown)' }} />}
{task.recurrence && <Icon name="repeat" size={13} style={{ color: 'var(--slate)' }} />}
{task.reminders.length > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Icon name="bell" size={13} style={{ color: 'var(--slate)' }} />{task.reminders.length}</span>}
</div>
{(event || list && !hideListBadge || eventProgress && eventProgress.total > 1) && <div className="task-meta-event">{event ? <span className="task-meta-event-name">{event.name}</span> : list && !hideListBadge ? <span className="pill-tag list-badge" style={{ background: `color-mix(in oklch, ${list.color} 16%, var(--white))`, color: list.color }}><span className="dot" style={{ background: list.color }} />{list.name}</span> : null}{eventProgress && eventProgress.total > 1 && <span className="task-progress-count"> · {eventProgress.done}/{eventProgress.total}</span>}</div>}
</div>
{eventProgress && eventProgress.total > 1 && <div className="task-progress-bottom"><div className="task-progress-bottom-fill" style={{ width: (eventProgress.done / eventProgress.total * 100) + '%' }} /></div>}
</div>
</div>);

}

function SectionLabel({ dot, children, count, collapsible, expanded, onToggle, onAction }) {
  return <div className={"section-label" + (onAction ? ' actionable' : '')} onClick={collapsible ? onToggle : onAction} style={collapsible || onAction ? { cursor: 'pointer' } : undefined}>
<span className="dot" style={{ background: dot }} />{children}{count != null && <span className="count">{count}</span>}
{collapsible && <Icon key={expanded ? 'up' : 'down'} name={expanded ? 'chevron-up' : 'chevron-down'} size={16} style={{ color: 'var(--slate)', marginLeft: 4 }} />}
{onAction && <span className="section-action"><Icon name="sparkles" size={13} />Focus<Icon name="chevron-right" size={14} /></span>}
</div>;
}

function rowPropsFor(rowProps, t) {
  return { selectMode: rowProps.selectMode, selected: rowProps.selectedIds.has(t.id), onLongPress: rowProps.onLongPress, onToggleSelect: rowProps.onToggleSelect, onSwipeDone: rowProps.onSwipeDone, onOpenMenu: rowProps.onOpenMenu, celebrating: rowProps.celebrateIds.has(t.id) };
}

function HomeScreen({ tasks, eventsById, listsById, onToggle, onOpenTask, onOpenAdd, onOpenZen, onOpenPlan, empty, rowProps }) {
  const [open, setOpen] = useState({ next3: true, nextweek: true, upcoming: true });
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  if (empty) return <EmptyHome onOpenAdd={onOpenAdd} onOpenPlan={onOpenPlan} />;
  const overdue = tasks.filter((t) => t.bucket === 'overdue' && !t.done);
  const todayItems = tasks.filter((t) => t.bucket === 'next3' && !t.done && t.dueLabel === 'Today');
  const next3 = tasks.filter((t) => t.bucket === 'next3' && !t.done && t.dueLabel !== 'Today');
  const nextweek = tasks.filter((t) => t.bucket === 'nextweek' && !t.done);
  const upcoming = tasks.filter((t) => t.bucket === 'upcoming' && !t.done);
  const doneCount = tasks.filter((t) => t.done).length;
  const eventStats = {};
  tasks.forEach((t) => {if (!t.eventId) return;const s = eventStats[t.eventId] || (eventStats[t.eventId] = { done: 0, total: 0 });s.total++;if (t.done) s.done++;});
  const group = (key, dot, label, items) => items.length > 0 && <React.Fragment key={key}>
<SectionLabel dot={dot} count={items.length} collapsible expanded={open[key]} onToggle={() => toggle(key)}>{label}</SectionLabel>
{open[key] && <div className="list">{items.map((t) => <TaskRow key={t.id} task={t} event={eventsById[t.eventId]} list={listsById[t.listId]} eventProgress={eventStats[t.eventId]} onToggle={onToggle} onOpen={onOpenTask} {...rowPropsFor(rowProps, t)} />)}</div>}
</React.Fragment>;
  return <div className="screen">
<div className="topbar"><div><h1>What's next</h1><div className="sub">Everything tied to your events and goals</div></div>
<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
<div className="plan-btn" onClick={onOpenPlan}><Icon name="wand-2" size={15} />Plan</div>
<div className="icon-btn"><Icon name="search" /></div>
</div></div>
{overdue.length > 0 && <>
<SectionLabel dot="var(--signal-orange)" count={overdue.length}>Overdue</SectionLabel>
<div className="list">{overdue.map((t) => <TaskRow key={t.id} task={t} event={eventsById[t.eventId]} list={listsById[t.listId]} eventProgress={eventStats[t.eventId]} onToggle={onToggle} onOpen={onOpenTask} {...rowPropsFor(rowProps, t)} />)}</div>
</>}
{todayItems.length > 0 && <>
<SectionLabel dot="var(--ink)" count={todayItems.length} onAction={todayItems.length > 0 ? onOpenZen : undefined}>Today<span className="section-date"> · {TODAY_LABEL}</span></SectionLabel>
<div className="list">{todayItems.map((t) => <TaskRow key={t.id} task={t} event={eventsById[t.eventId]} list={listsById[t.listId]} eventProgress={eventStats[t.eventId]} onToggle={onToggle} onOpen={onOpenTask} {...rowPropsFor(rowProps, t)} />)}</div>
</>}
{group('next3', 'var(--ink)', 'Next 3 days', next3)}
{group('nextweek', 'var(--slate)', 'Next week', nextweek)}
{group('upcoming', 'var(--dust-taupe)', 'Upcoming', upcoming)}
{doneCount > 0 && <div style={{ padding: '18px 24px 100px', fontSize: 13, color: 'var(--slate)', fontWeight: 450 }}>{doneCount} task{doneCount > 1 ? 's' : ''} completed this week</div>}
{doneCount === 0 && <div style={{ height: 100 }} />}
</div>;
}

function EmptyHome({ onOpenAdd, onOpenPlan }) {
  return <div className="screen"><div className="topbar"><h1>What's next</h1></div>
<div className="empty"><div className="ring"><Icon name="sparkles" size={34} /></div>
<h2>Nothing on your plate yet</h2>
<p>Add an event or a standalone task and Heads Up will keep track of what needs to happen, and when.</p>
<Button onClick={onOpenAdd}>Add your first task</Button>
<Button variant="secondary" onClick={onOpenPlan}>Plan the next few days</Button>
</div></div>;
}

function ProgressRing({ pct, size = 64, atRisk }) {
  const r = (size - 8) / 2,c = 2 * Math.PI * r;
  const color = atRisk ? 'var(--signal-orange)' : 'var(--ink)';
  return <svg width={size} height={size}><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--soft-bone)" strokeWidth="8" />
<circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8" strokeDasharray={c} strokeDashoffset={c - pct / 100 * c} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
<text x="50%" y="50%" textAnchor="middle" dy="5" fontSize="14" fontWeight="700" fontFamily="var(--font-primary)" fill={color}>{pct}%</text></svg>;
}

function SegmentedProgress({ total, done, atRisk }) {
  const color = atRisk ? 'var(--signal-orange)' : 'var(--ink)';
  return <div className="segmented-progress">{Array.from({ length: Math.max(total, 1) }).map((_, i) => <div key={i} className="segment" style={{ background: i < done ? color : 'var(--soft-bone)' }} />)}</div>;
}

function EventsScreen({ events, tasks, listsById, onOpenEvent, onOpenTask, onToggle, onOpenAddEvent }) {
  return <div className="screen"><div className="topbar"><h1>Events</h1></div>
<CalendarView events={events} tasks={tasks} listsById={listsById} onOpenEvent={onOpenEvent} onOpenTask={onOpenTask} onToggle={onToggle} /></div>;
}

function EventTimeline({ event, tasks }) {
  const offsets = tasks.filter((t) => !t.done).map((t) => t.dayOffset);
  const min = Math.min(0, event.dayOffset, ...offsets);
  const max = Math.max(0, event.dayOffset, ...offsets);
  const pct = (o) => max > min ? (o - min) / (max - min) * 100 : 50;
  return <div className="timeline" data-comment-anchor="9adea46199-div-121-10">
<div className="timeline-track">
<div className="timeline-line" />
{tasks.filter((t) => !t.done).map((t) => <div key={t.id} className={"timeline-dot" + (t.bucket === 'overdue' ? ' overdue' : '')} style={{ left: pct(t.dayOffset) + '%' }} title={t.name + ' · ' + t.dueLabel} />)}
<div className="timeline-pin today" style={{ left: pct(0) + '%' }} data-comment-anchor="401e1c751c-div-125-1" title="Today" />
<div className="timeline-pin event" style={{ left: pct(event.dayOffset) + '%' }} />
</div>
<div className="timeline-labels"><span>Today</span><span>{event.dateLabel}</span></div>
<div className="timeline-legend">
<span className="legend-item"><span className="legend-swatch pin" />Today</span>
<span className="legend-item"><span className="legend-swatch dot" />Task due</span>
<span className="legend-item"><span className="legend-swatch dot overdue" />Overdue</span>
<span className="legend-item"><span className="legend-swatch diamond" />Event day</span>
</div>
</div>;
}

function EventDetailScreen({ event, tasks, onBack, onToggle, onOpenTask, onDelete, rowProps }) {
  const [editing, setEditing] = useState(false);
  const evTasks = tasks.filter((t) => t.eventId === event.id);
  const done = evTasks.filter((t) => t.done).length;
  const overdueCount = evTasks.filter((t) => t.bucket === 'overdue' && !t.done).length;
  const atRisk = overdueCount > 0;
  return <div className="screen">
<div className="detail-header">
<div style={{ display: 'flex', justifyContent: 'space-between' }}>
<div className="icon-btn back" onClick={onBack}><Icon name="chevron-left" /></div>
<div style={{ display: 'flex', gap: 8 }}>
<div className="icon-btn" onClick={() => setEditing(!editing)}><Icon key={editing ? 'check' : 'pencil'} name={editing ? 'check' : 'pencil'} /></div>
<div className="icon-btn" style={{ color: 'var(--signal-orange)', borderColor: 'var(--signal-orange)' }} onClick={() => onDelete(event)}><Icon name="trash-2" /></div>
</div>
</div>
<span className="source-tag"><span className="dot" style={{ background: event.source === 'device' ? 'var(--link-blue)' : 'var(--signal-orange-light)' }} />{event.source === 'device' ? 'Synced from calendar' : 'App event'}{event.recurrence && ' · Repeats ' + event.recurrence}</span>
<div className="event-title">{event.name}</div>
<div className="detail-facts">
<div className="detail-fact"><Icon name="calendar" size={14} />{event.dateLabel}{event.time && ' · ' + event.time}</div>
{event.location && <div className="detail-fact"><Icon name="map-pin" size={14} />{event.location}</div>}
</div>
{event.description && <p style={{ fontSize: 14, color: 'var(--slate)', fontWeight: 450, lineHeight: 1.5, margin: '10px 0 0' }}>{event.description}</p>}
</div>
{editing && <div className="editing-banner"><Icon name="pencil" />Editing — changes save when you tap the check</div>}
{atRisk && <div className="risk-banner" data-comment-anchor="a90742e2e0-div-131-1"><Icon name="alert-triangle" size={16} />{overdueCount} task{overdueCount > 1 ? 's' : ''} overdue — this event is at risk</div>}
<EventTimeline event={event} tasks={evTasks} />
<div className="progress-wrap" data-comment-anchor="975012cb40-div-127-1"><SegmentedProgress total={evTasks.length} done={done} atRisk={atRisk} /><div className="stat"><b>{done} of {evTasks.length}</b> tasks done</div></div>
<SectionLabel dot="var(--ink)">Tasks</SectionLabel>
<div className="list" style={{ paddingBottom: 24 }}>{evTasks.map((t) => <TaskRow key={t.id} task={t} event={null} onToggle={onToggle} onOpen={onOpenTask} {...rowPropsFor(rowProps, t)} />)}
{evTasks.length === 0 && <div style={{ padding: '8px 8px 16px', color: 'var(--slate)', fontSize: 14 }}>No tasks yet for this event.</div>}</div>
<div style={{ height: 88 }} />
</div>;
}

function TaskDetailScreen({ task, event, list, onBack, onToggle, onDelete, onSnooze, onAddReminder, onRemoveReminder, onOpenEvent, onOpenList, onSetPriority }) {
  const [editing, setEditing] = useState(false);
  return <div className="screen" data-comment-anchor="5c55b84370-div-131-8" style={{ display: 'flex', flexDirection: 'column' }}>
<div className="detail-header">
<div style={{ display: 'flex', justifyContent: 'space-between' }}>
<div className="icon-btn back" onClick={onBack}><Icon name="chevron-left" /></div>
<div style={{ display: 'flex', gap: 8 }}>
<div className="icon-btn" onClick={() => setEditing(!editing)}><Icon key={editing ? 'check' : 'pencil'} name={editing ? 'check' : 'pencil'} /></div>
<div className="icon-btn" style={{ color: 'var(--signal-orange)', borderColor: 'var(--signal-orange)' }} onClick={() => onDelete(task)}><Icon name="trash-2" /></div>
</div>
</div>
<div className="event-title">{task.name}</div>
<div className="task-meta" style={{ fontSize: 14 }}>
<span className={task.bucket === 'overdue' && !task.done ? 'due overdue' : 'due'}>{task.dueLabel}</span>
{task.recurrence && <span>· Repeats {task.recurrence}</span>}
</div>
{event ?
<div className="event-link-chip" onClick={() => onOpenEvent(event)} data-comment-anchor="63ae178dd6-div-197-1"><Icon name="calendar-days" size={16} /><div className="event-link-chip-body"><span className="event-link-chip-name">{event.name}</span><span className="event-link-chip-meta">{event.dateLabel}{event.time && ' · ' + event.time}{event.location && ' · ' + event.location}</span></div><Icon name="chevron-right" size={16} style={{ marginLeft: 'auto', flex: 'none' }} /></div> :
list ?
<div className="event-link-chip" onClick={() => onOpenList(list)} data-comment-anchor="63ae178dd6-div-197-1" style={{ boxShadow: `inset 3px 0 0 0 ${list.color}, var(--shadow-1)` }}><span className="list-color-dot" style={{ background: list.color }} /><div className="event-link-chip-body"><span className="event-link-chip-name">{list.name}</span><span className="event-link-chip-meta">To-do list</span></div><Icon name="chevron-right" size={16} style={{ marginLeft: 'auto', flex: 'none' }} /></div> :
null}
</div>
{editing && <div className="editing-banner"><Icon name="pencil" />Editing — changes save when you tap the check</div>}
<div style={{ flex: 1, overflowY: 'auto' }}>
<div className="field"><label>Priority</label>
<div className="chips">{['high', 'normal', 'low'].map((p) => <span key={p} className={"chip" + ((task.priority || 'normal') === p ? ' selected' : '')} onClick={() => onSetPriority(task, p)}>{p === 'high' ? 'High' : p === 'low' ? 'Low' : 'Normal'}</span>)}</div>
</div>
<div className="field"><label>Reminders</label>
{task.reminders.map((r) => <div className="reminder-row" key={r.id}><span className="label"><span className="dot" />{r.label}{r.date && <span className="reminder-date">{r.date}</span>}</span>{editing && <div className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => onRemoveReminder(task, r)}><Icon name="x" size={14} /></div>}</div>)}
{task.reminders.length === 0 && <div style={{ color: 'var(--slate)', fontSize: 14 }}>No reminders set — add one below.</div>}
</div>
<div className="field"><label>Add a reminder</label>
<div className="chips">{PRESETS.filter((p) => !task.reminders.some((r) => r.label === p)).map((p) => <span key={p} className="chip" onClick={() => onAddReminder(task, p)}>{p}</span>)}<span className="chip" onClick={() => onAddReminder(task, 'Custom time')}>Custom…</span></div>
</div>
<div style={{ height: 90 }} />
</div>
</div>;
}

function AddTaskSheet({ events, lists, initialEventId, show, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [link, setLink] = useState(initialEventId ? 'event' : 'none');
  const [eventId, setEventId] = useState(initialEventId || (events[0] && events[0].id));
  const [listId, setListId] = useState(lists[0] && lists[0].id);
  const [priority, setPriority] = useState('normal');
  const [dueDate, setDueDate] = useState(null);
  const [dueLabel, setDueLabel] = useState('Tomorrow');
  const [calOpen, setCalOpen] = useState(false);
  const [reminders, setReminders] = useState([]);
  const toggle = (p) => setReminders((rs) => rs.includes(p) ? rs.filter((x) => x !== p) : [...rs, p]);
  return <div className={"sheet-backdrop" + (show ? ' show' : '')} onClick={onClose}>
<div className="sheet" onClick={(e) => e.stopPropagation()}>
<div className="sheet-handle" />
<h2>New task</h2>
<div className="field" style={{ marginTop: 12 }}><label>Task name</label>
<input className="input-plain" placeholder="e.g. Pick up dry cleaning" value={name} onChange={(e) => setName(e.target.value)} /></div>
<div className="field"><label>Link to</label>
<div className="link-choice">
<Button variant={link === 'none' ? 'primary' : 'secondary'} onClick={() => setLink('none')}>None</Button>
<Button variant={link === 'event' ? 'primary' : 'secondary'} onClick={() => setLink('event')}>Event</Button>
<Button variant={link === 'list' ? 'primary' : 'secondary'} onClick={() => setLink('list')}>List</Button>
</div>
{link === 'event' && <div style={{ padding: '12px 24px 0' }}><select className="input-plain" value={eventId} onChange={(e) => setEventId(e.target.value)}>{events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}</select></div>}
{link === 'list' && <div style={{ padding: '12px 24px 0' }}><select className="input-plain" value={listId} onChange={(e) => setListId(e.target.value)}>{lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>}
</div>
<div className="field" data-comment-anchor="fb18295905-input-242-42"><label>Due</label>
<div className="due-preview" style={{ cursor: 'pointer' }} onClick={() => setCalOpen((o) => !o)}><Icon name="calendar" size={14} />{dueLabel}<Icon key={calOpen ? 'up' : 'down'} name={calOpen ? 'chevron-up' : 'chevron-down'} size={14} style={{ marginLeft: 'auto' }} /></div>
{calOpen && <CalendarPicker value={dueDate} onChange={(d, label) => {setDueDate(d);setDueLabel(label);setCalOpen(false);}} />}
</div>
<div className="field"><label>Priority</label>
<div className="chips">{['high', 'normal', 'low'].map((p) => <span key={p} className={"chip" + (priority === p ? ' selected' : '')} onClick={() => setPriority(p)}>{p === 'high' ? 'High' : p === 'low' ? 'Low' : 'Normal'}</span>)}</div>
</div>
<div className="field"><label>Reminders</label>
<div className="chips">{PRESETS.map((p) => <span key={p} className={"chip" + (reminders.includes(p) ? ' selected' : '')} onClick={() => toggle(p)}>{p}</span>)}</div>
</div>
<div className="row-actions"><Button disabled={!name.trim()} onClick={() => onCreate({ name: name.trim(), eventId: link === 'event' ? eventId : null, listId: link === 'list' ? listId : null, priority, due: dueLabel, reminders })}>Save task</Button></div>
</div></div>;
}

function AddEventSheet({ show, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [dateObj, setDateObj] = useState(null);
  const [dateLabel, setDateLabel] = useState('Pick a date');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [calOpen, setCalOpen] = useState(false);
  return <div className={"sheet-backdrop" + (show ? ' show' : '')} onClick={onClose}>
<div className="sheet" onClick={(e) => e.stopPropagation()}>
<div className="sheet-handle" />
<h2>New event</h2>
<div className="field" style={{ marginTop: 12 }}><label>Event name</label>
<input className="input-plain" placeholder="e.g. Team offsite" value={name} onChange={(e) => setName(e.target.value)} /></div>
<div className="field"><label>Date</label>
<div className="due-preview" style={{ cursor: 'pointer' }} onClick={() => setCalOpen((o) => !o)}><Icon name="calendar" size={14} />{dateLabel}<Icon key={calOpen ? 'up' : 'down'} name={calOpen ? 'chevron-up' : 'chevron-down'} size={14} style={{ marginLeft: 'auto' }} /></div>
{!dateObj && <div style={{ fontSize: 12, color: 'var(--signal-orange)', marginTop: -4, marginBottom: 10 }}>Date is required to save this event</div>}
{calOpen && <CalendarPicker value={dateObj} onChange={(d, label) => {setDateObj(d);setDateLabel(label);setCalOpen(false);}} />}
</div>
<div className="field"><label>Time</label><input className="input-plain" placeholder="e.g. 2:00 PM or All day" value={time} onChange={(e) => setTime(e.target.value)} /></div>
<div className="field"><label>Location</label><input className="input-plain" placeholder="Optional" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
<div className="field"><label>Description</label><textarea className="input-plain" rows={3} placeholder="Optional details" value={description} onChange={(e) => setDescription(e.target.value)} style={{ resize: 'none', fontFamily: 'var(--font-primary)' }} /></div>
<div className="row-actions"><Button disabled={!name.trim() || !dateObj} onClick={() => onCreate({ name: name.trim(), dateLabel, time: time.trim() || null, location: location.trim() || null, description: description.trim() || null })}>Save event</Button></div>
</div></div>;
}

function RecurrenceDialog({ info, onPick, onCancel }) {
  return <Dialog open={true} onClose={onCancel} title="This occurrence, or the whole series?">
<div className="dialog-pop">
<p style={{ fontSize: 15, color: 'var(--slate)', fontWeight: 450, margin: '0 0 4px' }}>{info.name} repeats {info.recurrence}. Choose what this {info.action} applies to.</p>
<div className="dialog-actions">
<Button onClick={() => onPick('one')}>Just this occurrence</Button>
<Button variant="secondary" onClick={() => onPick('all')}>The whole series</Button>
</div></div></Dialog>;
}

function QuickActionMenu({ menu, show, onMarkDone, onSnooze, onClose, count }) {
  if (!menu) return null;
  const top = menu.y + menu.h + 6;
  return <>
<div className="menu-backdrop" onClick={onClose} />
<div className={"quick-menu" + (show ? ' show' : '')} style={{ top, left: Math.max(8, Math.min(menu.x, 390 - 208)) }}>
{count > 1 && <div className="quick-menu-label">{count} selected</div>}
<div className="quick-item" onClick={() => onMarkDone(menu.task)}><Icon name="check" size={15} />Mark done</div>
<div className="quick-item" onClick={() => onSnooze(menu.task, 'tomorrow')}><Icon name="clock" size={15} />Snooze +1 day</div>
<div className="quick-item" onClick={() => onSnooze(menu.task, 'week')}><Icon name="calendar" size={15} />Snooze +1 week</div>
</div>
</>;
}

function BulkWheel({ count, onMarkDone, onSnooze, onCancel }) {
  const actions = [
  { key: 'done', icon: 'check', label: 'Done', run: onMarkDone },
  { key: 'day', icon: 'clock', label: '+1 day', run: () => onSnooze('tomorrow') },
  { key: 'week', icon: 'calendar', label: '+1 wk', run: () => onSnooze('week') }];

  const spread = 160,n = actions.length,R = 112;
  return <>
<div className="wheel-backdrop" onClick={onCancel} />
<div className="wheel-wrap">
{actions.map((a, i) => {
        const angle = n > 1 ? -spread / 2 + i * (spread / (n - 1)) : 0;
        const rad = angle * Math.PI / 180;
        const x = Math.sin(rad) * R,y = -Math.cos(rad) * R;
        return <div key={a.key} className="wheel-petal" style={{ '--x': x + 'px', '--y': y + 'px', animationDelay: i * 35 + 'ms' }} onClick={a.run} title={a.label}>
<Icon name={a.icon} size={26} /><span>{a.label}</span>
</div>;
      })}
<div className="wheel-hub" onClick={onCancel} title="Cancel selection">{count}<span className="lbl">selected</span></div>
</div>
</>;
}

function SettingsScreen({ emptyDemo, setEmptyDemo }) {
  const [push, setPush] = useState(true);
  const [calSync, setCalSync] = useState(true);
  const [defaultReminder, setDefaultReminder] = useState('1 day before');
  return <div className="screen"><div className="topbar"><h1>Settings</h1></div>
<SectionLabel dot="var(--ink)">Reminders</SectionLabel>
<div className="settings-group">
<div className="settings-item"><div className="txt"><div className="t">Default reminder</div><div className="s">Applied to new tasks unless changed</div></div>
<select className="input-plain" style={{ width: 150, padding: '8px 12px', fontSize: 14 }} value={defaultReminder} onChange={(e) => setDefaultReminder(e.target.value)}>{PRESETS.map((p) => <option key={p}>{p}</option>)}</select></div>
<div className="settings-item"><div className="txt"><div className="t">Push notifications</div><div className="s">Real alerts for every reminder</div></div><Switch checked={push} onChange={setPush} /></div>
</div>
<SectionLabel dot="var(--ink)">Calendar</SectionLabel>
<div className="settings-group">
<div className="settings-item"><div className="txt"><div className="t">Sync device calendar</div><div className="s">Read-only — events stay editable there</div></div><Switch checked={calSync} onChange={setCalSync} /></div>
</div>
<SectionLabel dot="var(--ink)">Demo</SectionLabel>
<div className="settings-group">
<div className="settings-item"><div className="txt"><div className="t">Preview empty state</div><div className="s">See the new-user Home screen</div></div><Switch checked={emptyDemo} onChange={setEmptyDemo} /></div>
</div>
<div style={{ height: 24 }} />
</div>;
}

function Toast({ toast, show, onUndo }) {
  if (!toast) return null;
  return <div className={"toast-wrap" + (show ? ' show' : '')}><div className="toast-card">
<span style={{ flex: 1 }}>{toast.message}</span>
{toast.canUndo && <button onClick={onUndo} style={{ background: 'none', border: 'none', color: 'var(--signal-orange-light)', fontWeight: 700, fontSize: 15, cursor: 'pointer', padding: '10px 8px', margin: '-10px -8px', minHeight: 44 }}>Undo</button>}
</div></div>;
}

function zenTimeToMin(str) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(str || '');
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h * 60 + parseInt(m[2], 10);
}
const ZEN_HOUR_START = 8, ZEN_HOUR_END = 20, ZEN_HOUR_H = 52, ZEN_NOW_MIN = 9 * 60 + 30;
const yFor = (min) => (min - ZEN_HOUR_START * 60) / 60 * ZEN_HOUR_H;
const zenShowNow = ZEN_NOW_MIN >= ZEN_HOUR_START * 60 && ZEN_NOW_MIN <= ZEN_HOUR_END * 60;

function ZenScreen({ tasks, eventsById, listsById, onClose, onToggle, onOpenTask }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, yFor(ZEN_NOW_MIN) - 60);
  }, []);
  const todays = tasks.filter((t) => t.dueLabel === 'Today');
  const done = todays.filter((t) => t.done).length;
  const total = todays.length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  const fullDate = new Date(2026, 7, 18).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const timed = todays.filter((t) => zenTimeToMin(t.time) != null).sort((a, b) => zenTimeToMin(a.time) - zenTimeToMin(b.time));
  const untimed = todays.filter((t) => zenTimeToMin(t.time) == null);
  const hours = Array.from({ length: ZEN_HOUR_END - ZEN_HOUR_START + 1 }, (_, i) => ZEN_HOUR_START + i);
  const gridH = (ZEN_HOUR_END - ZEN_HOUR_START) * ZEN_HOUR_H;
  const renderCard = (t) => {
    const ev = eventsById[t.eventId];
    const lst = listsById[t.listId];
    return <div key={t.id} className={"zen-card" + (t.done ? ' done' : '')} onClick={() => onOpenTask(t)} style={lst ? { boxShadow: `inset 4px 0 0 0 ${lst.color}, var(--shadow-1)` } : undefined}>
<div className={"check" + (t.done ? ' done' : '')} onClick={(e) => {e.stopPropagation();onToggle(t);}}>{t.done && <Icon name="check" />}</div>
<div className="zen-card-body">
<div className={"zen-card-title" + (t.done ? ' done' : '')}>{t.name}</div>
{(ev || lst || t.reminders.length > 0) && <div className="zen-card-meta">{ev ? ev.name : lst ? lst.name : ''}{t.reminders.length > 0 && <span className="zen-card-reminder"><Icon name="bell" size={12} />{t.reminders.length}</span>}</div>}
</div>
<Icon name="chevron-right" size={16} style={{ color: 'var(--slate)' }} />
</div>;
  };
  return <div className="screen zen-screen">
<div className="zen-hero">
<div className="zen-top"><div className="icon-btn zen-close" onClick={onClose}><Icon name="x" style={{ color: 'var(--canvas-cream)' }} /></div><span className="zen-top-label">Zen mode</span><div style={{ width: 40 }} /></div>
<div className="zen-hero-row"><Icon name="sparkles" size={20} style={{ color: 'var(--signal-orange-light, #F37338)' }} /><h2>Today</h2></div>
<div className="zen-date">{fullDate}</div>
<div className="zen-progress-row"><span>Progress</span><span className="zen-progress-pct">{pct}%</span></div>
<div className="zen-progress-bar"><div className="zen-progress-fill" style={{ width: pct + '%' }} /></div>
</div>
{total === 0 && <div className="zen-empty">Nothing due today. Enjoy the quiet.</div>}
{timed.length > 0 && <>
<div className="zen-list-head"><h3>Timeline</h3></div>
<div className="zen-timeline-scroll" ref={scrollRef}>
<div className="zen-timeline">
<div className="zen-timeline-gutter">{hours.map((h) => <div key={h} className="zen-hour-label" style={{ height: ZEN_HOUR_H }}>{h % 12 === 0 ? 12 : h % 12}{h < 12 ? 'AM' : 'PM'}</div>)}</div>
<div className="zen-timeline-grid" style={{ height: gridH }}>
{hours.map((h, i) => <div key={h} className="zen-hour-line" style={{ top: i * ZEN_HOUR_H }} />)}
{zenShowNow && <div className="zen-now-line" style={{ top: yFor(ZEN_NOW_MIN) }}><span className="zen-now-dot" /></div>}
{timed.map((t) => {
  const ev = eventsById[t.eventId];
  const lst = listsById[t.listId];
  return <div key={t.id} className={"zen-timeline-card" + (t.done ? ' done' : '')} style={{ top: yFor(zenTimeToMin(t.time)), boxShadow: lst ? `inset 4px 0 0 0 ${lst.color}, var(--shadow-1)` : undefined }} onClick={() => onOpenTask(t)}>
<div className={"check" + (t.done ? ' done' : '')} onClick={(e) => {e.stopPropagation();onToggle(t);}}>{t.done && <Icon name="check" />}</div>
<div className="zen-card-body">
<div className={"zen-card-title" + (t.done ? ' done' : '')}>{t.name}</div>
<div className="zen-card-meta">{t.time}{ev ? ' · ' + ev.name : lst ? ' · ' + lst.name : ''}</div>
</div>
<Icon name="chevron-right" size={16} style={{ color: 'var(--slate)' }} />
</div>;
})}
</div>
</div>
</div>
</>}
{untimed.length > 0 && <>
<div className="zen-list-head"><h3>Anytime today</h3><span className="zen-list-count">{done} of {total} done</span></div>
<div className="zen-list">{untimed.map(renderCard)}</div>
</>}
<div style={{ height: 40 }} />
</div>;
}

function App() {
  const [tab, setTab] = useState('home');
  const [nav, setNav] = useState({ screen: 'home', eventId: null, taskId: null, listId: null });
  const [transition, setTransition] = useState(null);
  const navIdRef = useRef(0);
  const bodyRef = useRef(null);
  const screen = nav.screen, activeEventId = nav.eventId, activeTaskId = nav.taskId, activeListId = nav.listId;
  const [events, setEvents] = useState(INITIAL_EVENTS);
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [addSheet, setAddSheet] = useState(null);
  const [addEventSheet, setAddEventSheet] = useState(false);
  const [toast, setToast] = useState(null);
  const [recurDialog, setRecurDialog] = useState(null);
  const [emptyDemo, setEmptyDemo] = useState(false);
  const [celebrateIds, setCelebrateIds] = useState(() => new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [quickMenu, setQuickMenu] = useState(null);
  const [lists, setLists] = useState(INITIAL_LISTS);
  const [listSheetMode, setListSheetMode] = useState(null);
  const pendingRef = useRef(null);
  useIcons();

  function navigate(patch, direction = 'forward') {
    setTransition({ prevBody: bodyRef.current, direction, phase: 'enter', id: ++navIdRef.current });
    setNav((n) => ({ ...n, ...patch }));
  }
  useEffect(() => {
    if (!transition || transition.phase !== 'enter') return;
    const id = transition.id;
    let raf2;
    const raf1 = requestAnimationFrame(() => {raf2 = requestAnimationFrame(() => setTransition((s) => s && s.id === id ? { ...s, phase: 'active' } : s));});
    return () => {cancelAnimationFrame(raf1);cancelAnimationFrame(raf2);};
  }, [transition && transition.id, transition && transition.phase]);
  useEffect(() => {
    if (!transition || transition.phase !== 'active') return;
    const id = transition.id;
    const t = setTimeout(() => setTransition((s) => s && s.id === id ? null : s), 400);
    return () => clearTimeout(t);
  }, [transition && transition.id, transition && transition.phase]);

  const eventsById = Object.fromEntries(events.map((e) => [e.id, e]));
  const activeEvent = events.find((e) => e.id === activeEventId);
  const activeTask = tasks.find((t) => t.id === activeTaskId);
  const listsById = Object.fromEntries(lists.map((l) => [l.id, l]));
  const activeList = lists.find((l) => l.id === activeListId);

  function goTab(t) {exitSelect();setTab(t);navigate({ screen: t, eventId: null, taskId: null, listId: null }, 'fade');}
  function createBulkTasks(newTasks) {
    setTasks((ts) => [...newTasks, ...ts]);
    setTab('home');navigate({ screen: 'home', eventId: null, taskId: null, listId: null }, 'modalDown');
    showToast(`${newTasks.length} task${newTasks.length > 1 ? 's' : ''} planned`, true, () => setTasks((ts) => ts.filter((t) => !newTasks.some((n) => n.id === t.id))));
  }
  function openEvent(ev) {navigate({ screen: 'eventDetail', eventId: ev.id, taskId: null }, 'forward');}
  function openList(l) {navigate({ screen: 'listDetail', listId: l.id, taskId: null }, 'forward');}
  function backFromListDetail() {navigate({ screen: 'lists', listId: null }, 'back');}
  function openTask(t) {navigate({ screen: 'taskDetail', taskId: t.id }, 'forward');}
  function backFromDetail() {
    if (screen === 'taskDetail' && activeTask && activeTask.eventId) {navigate({ screen: 'eventDetail', eventId: activeTask.eventId, taskId: null }, 'back');return;}
    if (screen === 'taskDetail' && activeTask && activeTask.listId) {navigate({ screen: 'listDetail', listId: activeTask.listId, taskId: null }, 'back');return;}
    navigate({ screen: tab, eventId: null, taskId: null, listId: null }, 'back');
  }

  function toggleDone(t) {
    const willBeDone = !t.done;
    const prevBucket = t.bucket;
    setTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, done: willBeDone, bucket: willBeDone ? 'done' : 'today' } : x));
    if (willBeDone) {
      setCelebrateIds((s) => new Set(s).add(t.id));
      setTimeout(() => setCelebrateIds((s) => {const n = new Set(s);n.delete(t.id);return n;}), 600);
      showToast(`"${t.name}" marked done`, true, () => setTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, done: false, bucket: prevBucket } : x)));
    }
  }

  function enterSelect(task) {setSelectMode(true);setSelectedIds(new Set([task.id]));}
  function toggleSelect(task) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(task.id)) next.delete(task.id);else next.add(task.id);
      if (next.size === 0) setSelectMode(false);
      return next;
    });
  }
  function exitSelect() {setSelectMode(false);setSelectedIds(new Set());}
  function bulkMarkDone() {
    const n = selectedIds.size;
    const snapshot = tasks.filter((t) => selectedIds.has(t.id)).map((t) => ({ id: t.id, done: t.done, bucket: t.bucket }));
    setTasks((ts) => ts.map((t) => selectedIds.has(t.id) ? { ...t, done: true, bucket: 'done' } : t));
    showToast(`${n} task${n > 1 ? 's' : ''} marked done`, true, () => setTasks((ts) => ts.map((t) => {
      const s = snapshot.find((x) => x.id === t.id);
      return s ? { ...t, done: s.done, bucket: s.bucket } : t;
    })));
    exitSelect();
  }
  function bulkSnooze(kind) {
    const n = selectedIds.size;
    const labelMap = { tomorrow: 'Tomorrow', week: 'Next week' };
    const bucketMap = { tomorrow: 'next3', week: 'nextweek' };
    const snapshot = tasks.filter((t) => selectedIds.has(t.id)).map((t) => ({ id: t.id, dueLabel: t.dueLabel, bucket: t.bucket }));
    setTasks((ts) => ts.map((t) => selectedIds.has(t.id) ? { ...t, dueLabel: labelMap[kind], bucket: bucketMap[kind] } : t));
    showToast(`${n} task${n > 1 ? 's' : ''} snoozed to ${labelMap[kind].toLowerCase()}`, true, () => setTasks((ts) => ts.map((t) => {
      const s = snapshot.find((x) => x.id === t.id);
      return s ? { ...t, dueLabel: s.dueLabel, bucket: s.bucket } : t;
    })));
    exitSelect();
  }
  function swipeMarkDone(task) {
    if (selectMode && selectedIds.has(task.id) && selectedIds.size > 1) bulkMarkDone();else toggleDone(task);
  }
  function openQuickMenu(task, rect) {setQuickMenu({ task, x: rect.x, y: rect.y, w: rect.w, h: rect.h });}
  function closeQuickMenu() {setQuickMenu(null);}
  function quickMarkDone(task) {if (selectMode && selectedIds.has(task.id) && selectedIds.size > 1) bulkMarkDone();else toggleDone(task);closeQuickMenu();}
  function quickSnooze(task, kind) {if (selectMode && selectedIds.has(task.id) && selectedIds.size > 1) bulkSnooze(kind);else onSnooze(task, kind);closeQuickMenu();}

  function showToast(message, canUndo, undoFn) {
    clearTimeout(pendingRef.current);
    setToast({ message, canUndo, restore: undoFn });
    pendingRef.current = setTimeout(() => setToast(null), 7000);
  }
  function doUndo() {if (toast && toast.restore) toast.restore();clearTimeout(pendingRef.current);setToast(null);}

  function deleteTask(task, scope) {
    const snapshot = task;
    setTasks((ts) => ts.filter((x) => x.id !== task.id));
    const msg = task.recurrence && scope === 'all' ? `"${task.name}" and its whole series deleted` : task.recurrence && scope === 'one' ? `This occurrence of "${task.name}" deleted` : `"${task.name}" deleted`;
    clearTimeout(pendingRef.current);
    setToast({ message: msg, canUndo: true, restore: () => setTasks((ts) => [snapshot, ...ts]) });
    pendingRef.current = setTimeout(() => setToast(null), 7000);
    if (screen === 'taskDetail') backFromDetail();
  }
  function requestDeleteTask(task) {
    if (task.recurrence) {setRecurDialog({ action: 'delete', kind: 'task', target: task, name: task.name, recurrence: task.recurrence });return;}
    deleteTask(task, null);
  }
  function deleteEvent(ev) {
    const evTasks = tasks.filter((t) => t.eventId === ev.id);
    setTasks((ts) => ts.filter((t) => t.eventId !== ev.id));
    setEvents((es) => es.filter((e) => e.id !== ev.id));
    clearTimeout(pendingRef.current);
    setToast({ message: `Event and ${evTasks.length} task${evTasks.length === 1 ? '' : 's'} deleted`, canUndo: true, restore: () => {setTasks((ts) => [...evTasks, ...ts]);setEvents((es) => [...es, ev]);} });
    pendingRef.current = setTimeout(() => setToast(null), 7000);
    navigate({ screen: 'events', eventId: null }, 'back');
  }
  function requestDeleteEvent(ev) {
    if (ev.recurrence) {setRecurDialog({ action: 'delete', kind: 'event', target: ev, name: ev.name, recurrence: ev.recurrence });return;}
    deleteEvent(ev);
  }
  function createList({ name, color }) {
    const id = 'l' + Math.random();
    setLists((ls) => [...ls, { id, name, color }]);
    setListSheetMode(null);
    showToast(`"${name}" list created`, true, () => setLists((ls) => ls.filter((l) => l.id !== id)));
  }
  function updateList(list, patch) {
    setLists((ls) => ls.map((l) => l.id === list.id ? { ...l, ...patch } : l));
    setListSheetMode(null);
  }
  function deleteList(list) {
    const listTasks = tasks.filter((t) => t.listId === list.id);
    setTasks((ts) => ts.filter((t) => t.listId !== list.id));
    setLists((ls) => ls.filter((l) => l.id !== list.id));
    clearTimeout(pendingRef.current);
    setToast({ message: `"${list.name}" and ${listTasks.length} to-do${listTasks.length === 1 ? '' : 's'} deleted`, canUndo: true, restore: () => {setTasks((ts) => [...listTasks, ...ts]);setLists((ls) => [...ls, list]);} });
    pendingRef.current = setTimeout(() => setToast(null), 7000);
    setListSheetMode(null);
    navigate({ screen: 'lists', listId: null }, 'back');
  }
  function addTodoToList(list, name) {
    const listTasks = tasks.filter((t) => t.listId === list.id);
    const nextOrder = listTasks.length ? Math.max(...listTasks.map((t) => t.order || 0)) + 1 : 0;
    const id = 't' + Math.random();
    setTasks((ts) => [...ts, { id, eventId: null, listId: list.id, priority: 'normal', order: nextOrder, name, bucket: null, dueLabel: null, done: false, recurrence: null, reminders: [] }]);
  }
  function reorderListTasks(orderedIds) {
    setTasks((ts) => ts.map((t) => {const i = orderedIds.indexOf(t.id);return i === -1 ? t : { ...t, order: i };}));
  }
  function setPriority(task, p) {setTasks((ts) => ts.map((t) => t.id === task.id ? { ...t, priority: p } : t));}
  function onRecurPick(scope) {
    const d = recurDialog;setRecurDialog(null);
    if (d.kind === 'task') deleteTask(d.target, scope);else deleteEvent(d.target);
  }
  function onSnooze(task, kind) {
    const labelMap = { tomorrow: 'Tomorrow', week: 'Next week', custom: 'Rescheduled' };
    const bucketMap = { tomorrow: 'next3', week: 'nextweek', custom: 'nextweek' };
    const prev = { dueLabel: task.dueLabel, bucket: task.bucket };
    setTasks((ts) => ts.map((t) => t.id === task.id ? { ...t, dueLabel: labelMap[kind], bucket: bucketMap[kind] } : t));
    showToast(`"${task.name}" snoozed to ${labelMap[kind].toLowerCase()}`, true, () => setTasks((ts) => ts.map((t) => t.id === task.id ? { ...t, ...prev } : t)));
  }
  function addReminder(task, label) {setTasks((ts) => ts.map((t) => t.id === task.id ? { ...t, reminders: [...t.reminders, { id: 'r' + Math.random(), label, date: t.dueLabel }] } : t));}
  function removeReminder(task, r) {setTasks((ts) => ts.map((t) => t.id === task.id ? { ...t, reminders: t.reminders.filter((x) => x.id !== r.id) } : t));}
  function createTask({ name, eventId, listId, priority, due, reminders }) {
    const id = 't' + Math.random();
    const listTasks = listId ? tasks.filter((t) => t.listId === listId) : [];
    const order = listId ? (listTasks.length ? Math.max(...listTasks.map((t) => t.order || 0)) + 1 : 0) : 0;
    setTasks((ts) => [{ id, eventId, listId, priority: priority || 'normal', order, name, bucket: 'upcoming', dueLabel: due, done: false, recurrence: null, reminders: reminders.map((l) => ({ id: 'r' + Math.random(), label: l })) }, ...ts]);
    setAddSheet(null);
    if (reminders.length === 0) {
      navigate({ screen: 'taskDetail', taskId: id }, 'forward');
    } else {
      showToast(`"${name}" added`, true, () => setTasks((ts) => ts.filter((t) => t.id !== id)));
    }
  }
  function createEvent({ name, dateLabel, time, location, description }) {
    const id = 'e' + Math.random();
    setEvents((es) => [...es, { id, name, dateLabel, time, location, description, dayOffset: 999, source: 'native', recurrence: null }]);
    setAddEventSheet(false);
    showToast(`"${name}" added`, true, () => setEvents((es) => es.filter((e) => e.id !== id)));
  }

  const rowProps = { selectMode, selectedIds, celebrateIds, onLongPress: enterSelect, onToggleSelect: toggleSelect, onSwipeDone: swipeMarkDone, onOpenMenu: openQuickMenu };

  let body;
  if (screen === 'home') body = <HomeScreen tasks={tasks} eventsById={eventsById} listsById={listsById} onToggle={toggleDone} onOpenTask={openTask} onOpenAdd={() => setAddSheet({ eventId: null })} onOpenZen={() => navigate({ screen: 'zen' }, 'modalUp')} onOpenPlan={() => navigate({ screen: 'planWizard' }, 'modalUp')} empty={emptyDemo} rowProps={rowProps} />;else
  if (screen === 'planWizard') body = <PlanWizard onClose={() => navigate({ screen: 'home' }, 'modalDown')} onCreate={createBulkTasks} />;else
  if (screen === 'events') body = <EventsScreen events={events} tasks={tasks} listsById={listsById} onOpenEvent={openEvent} onOpenTask={openTask} onToggle={toggleDone} onOpenAddEvent={() => setAddEventSheet(true)} />;else
  if (screen === 'lists') body = <ListsScreen lists={lists} tasks={tasks} onOpenList={openList} />;else
  if (screen === 'listDetail') body = <ListDetailScreen list={activeList} tasks={tasks} onBack={backFromListDetail} onEdit={() => setListSheetMode('edit')} onToggle={toggleDone} onOpenTask={openTask} onAddTodo={(name) => addTodoToList(activeList, name)} onReorder={reorderListTasks} rowProps={rowProps} />;else
  if (screen === 'settings') body = <SettingsScreen emptyDemo={emptyDemo} setEmptyDemo={setEmptyDemo} />;else
  if (screen === 'eventDetail') body = <EventDetailScreen event={activeEvent} tasks={tasks} onBack={backFromDetail} onToggle={toggleDone} onOpenTask={openTask} onDelete={requestDeleteEvent} rowProps={rowProps} />;else
  if (screen === 'zen') body = <ZenScreen tasks={tasks} eventsById={eventsById} listsById={listsById} onClose={() => navigate({ screen: 'home' }, 'modalDown')} onToggle={toggleDone} onOpenTask={openTask} />;else
  if (screen === 'taskDetail') body = <TaskDetailScreen task={activeTask} event={eventsById[activeTask.eventId]} list={listsById[activeTask.listId]} onBack={backFromDetail} onToggle={toggleDone} onDelete={requestDeleteTask} onSnooze={onSnooze} onAddReminder={addReminder} onRemoveReminder={removeReminder} onOpenEvent={openEvent} onOpenList={openList} onSetPriority={setPriority} />;
  bodyRef.current = body;

  const navDir = transition && transition.direction;
  const topRole = navDir === 'back' || navDir === 'modalDown' ? 'outgoing' : 'incoming';
  const addSheetData = useLast(addSheet);
  const listSheetModeData = useLast(listSheetMode);
  const toastData = useLast(toast);
  const quickMenuData = useLast(quickMenu);
  const addSheetP = usePresence(!!addSheet, 340);
  const addEventSheetP = usePresence(addEventSheet, 340);
  const listSheetP = usePresence(!!listSheetMode, 340);
  const toastP = usePresence(!!toast, 300);
  const quickMenuP = usePresence(!!quickMenu, 220);

  return <div className="phone">
<StatusBar />
<div className="screen-viewport">
{transition && <div className="screen-layer" data-role="outgoing" data-dir={transition.direction} data-phase={transition.phase} data-stack={topRole === 'outgoing' ? 'top' : 'bottom'}>{transition.prevBody}</div>}
<div className="screen-layer" key={navIdRef.current} data-role="incoming" data-dir={navDir} data-phase={transition && transition.phase} data-stack={transition ? (topRole === 'incoming' ? 'top' : 'bottom') : undefined}>{body}</div>
</div>
{!selectMode && (screen === 'home' || screen === 'events' || screen === 'eventDetail' || screen === 'lists') && <div className="fab" onClick={() => {if (screen === 'events') setAddEventSheet(true);else if (screen === 'lists') setListSheetMode('add');else setAddSheet({ eventId: screen === 'eventDetail' ? activeEventId : null });}}><Icon name="plus" /></div>}
{screen === 'taskDetail' && <div className="fab" onClick={() => {const wasDone = activeTask.done;toggleDone(activeTask);if (!wasDone) backFromDetail();}}><Icon name="check" /></div>}
{selectMode && <BulkWheel count={selectedIds.size} onMarkDone={bulkMarkDone} onSnooze={bulkSnooze} onCancel={exitSelect} />}
{screen !== 'zen' && screen !== 'planWizard' && <div className="tabbar">
<div className={"tab" + (tab === 'home' ? ' active' : '')} onClick={() => goTab('home')}><Icon name="list-checks" />Home</div>
<div className={"tab" + (tab === 'events' ? ' active' : '')} onClick={() => goTab('events')}><Icon name="calendar-days" />Events</div>
<div className={"tab" + (tab === 'lists' ? ' active' : '')} onClick={() => goTab('lists')}><Icon name="layers" />Lists</div>
<div className={"tab" + (tab === 'settings' ? ' active' : '')} onClick={() => goTab('settings')}><Icon name="settings" />Settings</div>
</div>}
{addSheetP.mounted && <AddTaskSheet show={addSheetP.visible} events={events} lists={lists} initialEventId={addSheetData && addSheetData.eventId} onClose={() => setAddSheet(null)} onCreate={createTask} />}
{addEventSheetP.mounted && <AddEventSheet show={addEventSheetP.visible} onClose={() => setAddEventSheet(false)} onCreate={createEvent} />}
{listSheetP.mounted && <AddListSheet show={listSheetP.visible} list={listSheetModeData === 'edit' ? activeList : null} onClose={() => setListSheetMode(null)} onSave={(payload) => listSheetMode === 'edit' ? updateList(activeList, payload) : createList(payload)} onDelete={listSheetMode === 'edit' ? () => deleteList(activeList) : undefined} />}
{recurDialog && <RecurrenceDialog info={recurDialog} onPick={onRecurPick} onCancel={() => setRecurDialog(null)} />}
<QuickActionMenu menu={quickMenuData} show={quickMenuP.visible} onMarkDone={quickMarkDone} onSnooze={quickSnooze} onClose={closeQuickMenu} count={quickMenuData && selectMode && selectedIds.has(quickMenuData.task.id) ? selectedIds.size : 1} />
<Toast toast={toastData} show={toastP.visible} onUndo={doUndo} />
</div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
