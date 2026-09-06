const { useState: useCalState } = React;

function CalendarPicker({ value, onChange, anchorDate }) {
  const TODAY = anchorDate || new Date(2026, 7, 18);
  const [viewDate, setViewDate] = useCalState(value || TODAY);
  const year = viewDate.getFullYear(),month = viewDate.getMonth();
  const startDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const isSame = (d) => value && value.getFullYear() === year && value.getMonth() === month && value.getDate() === d;
  const isToday = (d) => TODAY.getFullYear() === year && TODAY.getMonth() === month && TODAY.getDate() === d;
  function pick(d) {
    const dt = new Date(year, month, d);
    const label = dt.toLocaleDateString();
    onChange(dt, label);
  }
  return <div className="cal-picker" data-comment-anchor="e5627ea641-div-20-10">
<div className="cal-head">
<div className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setViewDate(new Date(year, month - 1, 1))}><i data-lucide="chevron-left" style={{ width: 16, height: 16 }} /></div>
<span>{monthLabel}</span>
<div className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setViewDate(new Date(year, month + 1, 1))}><i data-lucide="chevron-right" style={{ width: 16, height: 16 }} /></div>
</div>
<div className="cal-weekdays">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => <span key={i}>{w}</span>)}</div>
<div className="cal-grid">{cells.map((d, i) => d ? <button key={i} type="button" className={"cal-day" + (isSame(d) ? ' selected' : '') + (isToday(d) ? ' today' : '')} onClick={() => pick(d)}>{d}</button> : <span key={i} />)}</div>
</div>;
}

Object.assign(window, { CalendarPicker });