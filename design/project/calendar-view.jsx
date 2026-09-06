const { useState: useCalViewState } = React;
const CAL_TODAY_DATE = new Date(2026, 7, 18);
const CAL_HOUR_START = 8, CAL_HOUR_END = 20, CAL_HOUR_H = 40;

function calAddDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function calIsSameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function calStartOfWeek(d) { const r = new Date(d); r.setHours(0, 0, 0, 0); r.setDate(r.getDate() - r.getDay()); return r; }
function calStartOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function calParseTimeMin(t) {
  if (!t || /all day/i.test(t)) return null;
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);const min = parseInt(m[2], 10);const ap = m[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}
function calWithDates(events) {
  return events.map((ev) => {
    const date = calAddDays(CAL_TODAY_DATE, ev.dayOffset == null ? 999 : ev.dayOffset);
    const startMin = calParseTimeMin(ev.time);
    return { ...ev, _date: date, _startMin: startMin, _allDay: startMin == null, _kind: 'event' };
  });
}
function calDatedTasks(tasks) {
  return tasks.filter((t) => t.dayOffset != null).map((t) => {
    const date = calAddDays(CAL_TODAY_DATE, t.dayOffset);
    const startMin = calParseTimeMin(t.time);
    return { ...t, _date: date, _startMin: startMin, _allDay: startMin == null, _kind: 'task' };
  });
}
function calFmtRange(start, end) {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = end.toLocaleDateString('en-US', sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
  return `${s}\u2013${e}, ${end.getFullYear()}`;
}

const CAL_SUBTABS = [{ key: 'day', label: 'Day' }, { key: 'day3', label: '3 Day' }, { key: 'week', label: 'Week' }, { key: 'month', label: 'Month' }, { key: 'agenda', label: 'Agenda' }];
const CAL_FILTERS = [{ key: 'all', label: 'All' }, { key: 'events', label: 'Events' }, { key: 'tasks', label: 'To-dos' }];
function calGroupLabel(d) {
  const full = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  if (calIsSameDay(d, CAL_TODAY_DATE)) return 'Today \u00b7 ' + full;
  if (calIsSameDay(d, calAddDays(CAL_TODAY_DATE, 1))) return 'Tomorrow \u00b7 ' + full;
  if (calIsSameDay(d, calAddDays(CAL_TODAY_DATE, -1))) return 'Yesterday \u00b7 ' + full;
  return full;
}

function SegTabs({ items, active, onChange, dense }) {
  return <div className={"seg-tabs" + (dense ? ' dense' : '')}>{items.map((it) => {
    const key = it.key || it,label = it.label || it;
    return <button key={key} type="button" className={"seg-tab" + (active === key ? ' active' : '')} onClick={() => onChange(key)}>{label}</button>;
  })}</div>;
}

function CalHeader({ label, onPrev, onNext, onToday }) {
  return <div className="cal-nav">
<div className="icon-btn" style={{ width: 32, height: 32 }} onClick={onPrev}><i data-lucide="chevron-left" style={{ width: 16, height: 16 }} /></div>
<span className="cal-nav-label">{label}</span>
<div className="icon-btn" style={{ width: 32, height: 32 }} onClick={onNext}><i data-lucide="chevron-right" style={{ width: 16, height: 16 }} /></div>
<button type="button" className="today-btn" onClick={onToday}>Today</button>
</div>;
}

function MonthGrid({ anchorDate, items, listsById, selectedDate, onSelect }) {
  const monthStart = calStartOfMonth(anchorDate);
  const gridStart = calStartOfWeek(monthStart);
  const cells = Array.from({ length: 42 }, (_, i) => calAddDays(gridStart, i));
  return <div className="month-view">
<div className="cal-weekdays">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => <span key={i}>{w}</span>)}</div>
<div className="month-grid">{cells.map((d, i) => {
      const inMonth = d.getMonth() === anchorDate.getMonth();
      const today = calIsSameDay(d, CAL_TODAY_DATE);
      const sel = selectedDate && calIsSameDay(d, selectedDate);
      const dayItems = items.filter((e) => calIsSameDay(e._date, d));
      return <div key={i} className={"month-cell" + (inMonth ? '' : ' outside') + (sel ? ' selected' : '')} onClick={() => onSelect(d)}>
<span className={"month-daynum" + (today ? ' today' : '')}>{d.getDate()}</span>
{dayItems.length > 0 && <span className="month-dots">{dayItems.slice(0, 3).map((e) => <span key={e._kind + e.id} className="month-dot" style={{ background: e._kind === 'task' ? (listsById[e.listId] && listsById[e.listId].color || 'var(--ink)') : e.source === 'device' ? 'var(--link-blue)' : 'var(--signal-orange-light)' }} />)}</span>}
</div>;
    })}</div>
</div>;
}

function AgendaItemCard({ it, listsById, onOpenEvent, onOpenTask }) {
  const list = listsById[it.listId];
  const dotColor = it._kind === 'task' ? (list ? list.color : 'var(--ink)') : it.source === 'device' ? 'var(--link-blue)' : 'var(--signal-orange-light)';
  const isEvent = it._kind === 'event';
  return <div className="agenda-card" onClick={() => isEvent ? onOpenEvent(it) : onOpenTask(it)}>
<div className="agenda-row-time"><span className="t">{it._allDay ? '' : it.time}</span>{it._allDay && <span className="d">All day</span>}</div>
<span className="agenda-row-dot" style={{ background: dotColor }} />
<div className="agenda-row-body">
<div className={"agenda-row-name" + (!isEvent && it.done ? ' done' : '')}>{it.name}</div>
{isEvent && it.location && <div className="agenda-row-loc"><i data-lucide="map-pin" /><span>{it.location}</span></div>}
{!isEvent && list && <div className="agenda-row-loc">{list.name}</div>}
</div>
</div>;
}

function AgendaList({ date, items, listsById, onOpenEvent, onOpenTask }) {
  const dayItems = items.filter((e) => calIsSameDay(e._date, date)).sort((a, b) => (a._startMin ?? -1) - (b._startMin ?? -1));
  return <div className="agenda">
<div className="agenda-label">{calGroupLabel(date)}</div>
{dayItems.length === 0 && <div className="agenda-empty">Nothing scheduled</div>}
{dayItems.map((it) => <AgendaItemCard key={it._kind + it.id} it={it} listsById={listsById} onOpenEvent={onOpenEvent} onOpenTask={onOpenTask} />)}
</div>;
}

function TimeGrid({ days, items, listsById, onOpenEvent, onOpenTask }) {
  const hours = Array.from({ length: CAL_HOUR_END - CAL_HOUR_START }, (_, i) => CAL_HOUR_START + i);
  const colW = Math.max(50, Math.floor(310 / days.length));
  const nowMin = 9 * 60 + 30;
  const cols = `40px repeat(${days.length}, ${colW}px)`;
  const gridRef = React.useRef(null);
  React.useEffect(() => {
    if (!gridRef.current) return;
    const nowEl = gridRef.current.querySelector('.tg-now');
    const scrollParent = gridRef.current.closest('.screen');
    if (!nowEl || !scrollParent) return;
    const nowRect = nowEl.getBoundingClientRect();
    const parentRect = scrollParent.getBoundingClientRect();
    scrollParent.scrollTop += nowRect.top - parentRect.top - 140;
  }, [days[0] && days[0].getTime(), days.length]);
  function taskStyle(e) {
    const c = listsById[e.listId] && listsById[e.listId].color;
    return c ? { borderColor: c, color: c } : undefined;
  }
  return <div className="tg" ref={gridRef}><div className="tg-hscroll"><div style={{ minWidth: 40 + days.length * colW }}>
<div className="tg-header" style={{ gridTemplateColumns: cols }}>
<div />
{days.map((d, i) => <div key={i} className={"tg-daylabel" + (calIsSameDay(d, CAL_TODAY_DATE) ? ' today' : '')}><span className="dow">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span><span className="dnum">{d.getDate()}</span></div>)}
</div>
<div className="tg-allday" style={{ gridTemplateColumns: cols }}>
<div className="tg-allday-label">All-day</div>
{days.map((d, i) => {
        const dayItems = items.filter((e) => e._allDay && calIsSameDay(e._date, d));
        return <div key={i} className="tg-allday-col">{dayItems.map((e) => <div key={e._kind + e.id} className={"tg-allday-chip" + (e._kind === 'task' ? ' task' : '')} style={e._kind === 'task' ? taskStyle(e) : undefined} onClick={() => e._kind === 'task' ? onOpenTask(e) : onOpenEvent(e)}>{e.name}</div>)}</div>;
      })}
</div>
<div className="tg-grid" style={{ gridTemplateColumns: cols, height: hours.length * CAL_HOUR_H }}>
<div className="tg-gutter">{hours.map((h) => <div key={h} className="tg-hour" style={{ height: CAL_HOUR_H }}>{h % 12 === 0 ? 12 : h % 12}{h < 12 ? 'AM' : 'PM'}</div>)}</div>
{days.map((d, ci) => {
        const dayToday = calIsSameDay(d, CAL_TODAY_DATE);
        const dayItems = items.filter((e) => !e._allDay && calIsSameDay(e._date, d));
        return <div key={ci} className="tg-col">
{hours.map((h, hi) => <div key={hi} className="tg-hourline" style={{ top: hi * CAL_HOUR_H }} />)}
{dayToday && nowMin >= CAL_HOUR_START * 60 && nowMin <= CAL_HOUR_END * 60 && <div className="tg-now" style={{ top: (nowMin - CAL_HOUR_START * 60) / 60 * CAL_HOUR_H }} />}
{dayItems.map((e) => <div key={e._kind + e.id} className={"tg-event" + (e._kind === 'task' ? ' task' : '')} style={{ top: (e._startMin - CAL_HOUR_START * 60) / 60 * CAL_HOUR_H, height: CAL_HOUR_H - 4, ...(e._kind === 'task' ? taskStyle(e) : null) }} onClick={() => e._kind === 'task' ? onOpenTask(e) : onOpenEvent(e)}>
<span className="tg-event-name">{e.name}</span><span className="tg-event-time">{e.time}</span>
</div>)}
</div>;
      })}
</div>
</div></div></div>;
}

function AgendaView({ items, listsById, onOpenEvent, onOpenTask }) {
  const byDate = {};
  items.forEach((it) => { const k = it._date.toDateString(); (byDate[k] = byDate[k] || []).push(it); });
  const groups = Object.keys(byDate).sort((a, b) => new Date(a) - new Date(b)).map((k) => ({ date: new Date(k), items: byDate[k].sort((a, b) => (a._startMin ?? -1) - (b._startMin ?? -1)) }));
  return <div className="agenda-list" style={{ padding: '4px 20px 24px' }}>
{groups.length === 0 && <div className="agenda-empty">Nothing to show</div>}
{groups.map((g) => <div key={g.date.toDateString()} className="agenda-group">
<div className="agenda-label">{calGroupLabel(g.date)}</div>
{g.items.map((it) => <AgendaItemCard key={it._kind + it.id} it={it} listsById={listsById} onOpenEvent={onOpenEvent} onOpenTask={onOpenTask} />)}
</div>)}</div>;
}

function CalendarView({ events, tasks, listsById, onOpenEvent, onOpenTask, onToggle }) {
  const [subView, setSubView] = useCalViewState('week');
  const [anchor, setAnchor] = useCalViewState(CAL_TODAY_DATE);
  const [selectedDate, setSelectedDate] = useCalViewState(CAL_TODAY_DATE);
  const [itemFilter, setItemFilter] = useCalViewState('all');
  const showEvents = itemFilter !== 'tasks';
  const showTasks = itemFilter !== 'events';
  const combined = [...(showEvents ? calWithDates(events) : []), ...(showTasks ? calDatedTasks(tasks) : [])];

  function shift(dir) {
    if (subView === 'month') setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));else
    if (subView === 'day3') setAnchor(calAddDays(anchor, 3 * dir));else
    if (subView === 'day') setAnchor(calAddDays(anchor, dir));else
    setAnchor(calAddDays(anchor, 7 * dir));
  }
  function goToday() {setAnchor(CAL_TODAY_DATE);setSelectedDate(CAL_TODAY_DATE);}

  const tabsRow = <div className="cal-subtabs-row"><SegTabs dense items={CAL_SUBTABS} active={subView} onChange={setSubView} /></div>;
  const filterRow = <div className="cal-filter-row"><SegTabs dense items={CAL_FILTERS} active={itemFilter} onChange={setItemFilter} /></div>;

  if (subView === 'agenda') {
    return <div className="cal-view">
{tabsRow}{filterRow}
<AgendaView items={combined} listsById={listsById} onOpenEvent={onOpenEvent} onOpenTask={onOpenTask} />
</div>;
  }

  let days = null,label = '';
  if (subView === 'month') {
    label = anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } else if (subView === 'day') {
    days = [anchor];
    label = anchor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  } else if (subView === 'day3') {
    days = [0, 1, 2].map((i) => calAddDays(anchor, i));
    label = calFmtRange(days[0], days[2]);
  } else {
    const ws = calStartOfWeek(anchor);
    days = [0, 1, 2, 3, 4, 5, 6].map((i) => calAddDays(ws, i));
    label = calFmtRange(days[0], days[6]);
  }

  return <div className="cal-view">
{tabsRow}{filterRow}
<CalHeader label={label} onPrev={() => shift(-1)} onNext={() => shift(1)} onToday={goToday} />
{subView === 'month' ?
  <>
<MonthGrid anchorDate={anchor} items={combined} listsById={listsById} selectedDate={selectedDate} onSelect={setSelectedDate} />
<AgendaList date={selectedDate} items={combined} listsById={listsById} onOpenEvent={onOpenEvent} onOpenTask={onOpenTask} />
</> :

  <TimeGrid days={days} items={combined} listsById={listsById} onOpenEvent={onOpenEvent} onOpenTask={onOpenTask} />}
</div>;
}

Object.assign(window, { CalendarView });
