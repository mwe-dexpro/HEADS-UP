const LIST_COLORS = [
{ id: 'clay', value: 'var(--clay-brown)', label: 'Clay' },
{ id: 'blue', value: 'var(--link-blue)', label: 'Blue' },
{ id: 'graphite', value: '#565656', label: 'Graphite' },
{ id: 'moss', value: 'oklch(47% 0.09 145)', label: 'Moss' },
{ id: 'plum', value: 'oklch(46% 0.1 322)', label: 'Plum' },
{ id: 'gold', value: 'oklch(62% 0.12 85)', label: 'Gold' }];


function ListRow({ list, count, doneCount, onOpen }) {
  return <div className="list-card" style={{ boxShadow: `inset 4px 0 0 0 ${list.color}, var(--shadow-1)` }} onClick={onOpen}>
<span className="list-color-dot" style={{ background: list.color }} />
<div className="list-card-body">
<div className="list-card-name">{list.name}</div>
<div className="list-card-count">{count} to do{doneCount > 0 ? ` · ${doneCount} done` : ''}</div>
</div>
<Icon name="chevron-right" size={18} style={{ color: 'var(--slate)' }} />
</div>;
}

function ListsScreen({ lists, tasks, onOpenList }) {
  useIcons();
  return <div className="screen">
<div className="topbar"><div><h1>Lists</h1><div className="sub">Your to-do lists, organized your way</div></div></div>
{lists.length === 0 && <div className="wiz-empty-hint">No lists yet — tap + to create your first one.</div>}
<div className="list-card-col">{lists.map((l) => {
  const lt = tasks.filter((t) => t.listId === l.id);
  const open = lt.filter((t) => !t.done).length;
  const doneCount = lt.filter((t) => t.done).length;
  return <ListRow key={l.id} list={l} count={open} doneCount={doneCount} onOpen={() => onOpenList(l)} />;
})}</div>
<div style={{ height: 100 }} />
</div>;
}

function ListSortTabs({ mode, onChange }) {
  return <div className="seg-tabs dense" style={{ width: '100%' }}>
<button type="button" className={"seg-tab" + (mode === 'order' ? ' active' : '')} onClick={() => onChange('order')}>Order</button>
<button type="button" className={"seg-tab" + (mode === 'date' ? ' active' : '')} onClick={() => onChange('date')}>Date</button>
<button type="button" className={"seg-tab" + (mode === 'priority' ? ' active' : '')} onClick={() => onChange('priority')}>Priority</button>
</div>;
}

function groupTasksForList(open, mode) {
  if (mode === 'priority') {
    const buckets = { high: [], normal: [], low: [] };
    open.forEach((t) => buckets[t.priority || 'normal'].push(t));
    return [
    buckets.high.length && { key: 'high', label: 'High', dot: 'var(--signal-orange)', items: buckets.high },
    buckets.normal.length && { key: 'normal', label: 'Normal', dot: 'var(--ink)', items: buckets.normal },
    buckets.low.length && { key: 'low', label: 'Low', dot: 'var(--slate)', items: buckets.low }].
    filter(Boolean);
  }
  const overdue = open.filter((t) => t.bucket === 'overdue');
  const dated = open.filter((t) => t.bucket !== 'overdue' && t.dueLabel).sort((a, b) => (a.dayOffset ?? 999) - (b.dayOffset ?? 999));
  const noDate = open.filter((t) => !t.dueLabel);
  return [
  overdue.length && { key: 'overdue', label: 'Overdue', dot: 'var(--signal-orange)', items: overdue },
  dated.length && { key: 'dated', label: 'Scheduled', dot: 'var(--ink)', items: dated },
  noDate.length && { key: 'nodate', label: 'No date', dot: 'var(--dust-taupe)', items: noDate }].
  filter(Boolean);
}

const LIST_ROW_SLOT = 78;
function ListOrderRow({ task, order, index, onReorder, onToggle, onOpen }) {
  const dragRef = React.useRef(null);
  const [dragY, setDragY] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  function down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { fromIndex: index, startY: e.clientY, base: order };
    setDragging(true);setDragY(0);
  }
  function move(e) {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    setDragY(dy);
    const shift = Math.round(dy / LIST_ROW_SLOT);
    const newIndex = Math.max(0, Math.min(d.base.length - 1, d.fromIndex + shift));
    const ids = [...d.base];
    const idx = ids.indexOf(task.id);
    ids.splice(idx, 1);ids.splice(newIndex, 0, task.id);
    onReorder(ids);
  }
  function up() {dragRef.current = null;setDragging(false);setDragY(0);}
  const highPriority = task.priority === 'high' && !task.done;
  const overdue = task.bucket === 'overdue' && !task.done;
  return <div className={"list-order-row" + (dragging ? ' dragging' : '') + (overdue ? ' overdue' : '') + (highPriority ? ' high-priority' : '')} style={dragging ? { transform: `translateY(${dragY}px)` } : undefined}>
<div className="list-drag-handle" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}><Icon name="grip-vertical" size={18} /></div>
<div className={"check" + (task.done ? ' done' : '')} onClick={(e) => {e.stopPropagation();onToggle(task);}}>{task.done && <Icon name="check" />}</div>
<div className="task-body" style={{ cursor: 'pointer' }} onClick={() => onOpen(task)}>
<div className={"task-title" + (task.done ? ' done' : '')}>{task.name}</div>
{(task.dueLabel || highPriority) && <div className="task-meta">
{task.dueLabel && <span className={"due" + (task.bucket === 'overdue' ? ' overdue' : '')}>{task.dueLabel}</span>}
{highPriority && <Icon name="flag" size={13} style={{ color: 'var(--clay-brown)' }} />}
</div>}
</div>
</div>;
}

function ListDetailScreen({ list, tasks, onBack, onEdit, onToggle, onOpenTask, onAddTodo, onReorder, rowProps }) {
  const [sortMode, setSortMode] = React.useState('order');
  const [quickName, setQuickName] = React.useState('');
  const [showCompleted, setShowCompleted] = React.useState(false);
  useIcons();
  if (!list) return null;
  const listTasks = tasks.filter((t) => t.listId === list.id);
  const open = listTasks.filter((t) => !t.done);
  const done = listTasks.filter((t) => t.done);
  function submitQuick() {const v = quickName.trim();if (!v) return;onAddTodo(v);setQuickName('');}
  const ordered = [...open].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const orderIds = ordered.map((t) => t.id);
  const groups = sortMode === 'order' ? null : groupTasksForList(open, sortMode);
  return <div className="screen">
<div className="detail-header">
<div style={{ display: 'flex', justifyContent: 'space-between' }}>
<div className="icon-btn back" onClick={onBack}><Icon name="chevron-left" /></div>
<div className="icon-btn" onClick={onEdit}><Icon name="pencil" /></div>
</div>
<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
<span className="list-color-dot lg" style={{ background: list.color }} />
<div className="event-title" style={{ margin: 0 }}>{list.name}</div>
</div>
<div className="detail-facts"><div className="detail-fact">{open.length} to do{done.length > 0 ? ` · ${done.length} done` : ''}</div></div>
</div>
<div className="wiz-capture-row" style={{ padding: '0 20px 14px' }}>
<input className="input-plain" placeholder="Add a to-do" value={quickName} onChange={(e) => setQuickName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitQuick()} />
<button className="wiz-add-btn" onClick={submitQuick}><Icon name="plus" size={20} /></button>
</div>
<div style={{ padding: '0 20px 4px' }}><ListSortTabs mode={sortMode} onChange={setSortMode} /></div>
{open.length === 0 && <div className="wiz-empty-hint">No to-dos yet — add your first one above.</div>}
{sortMode === 'order' && open.length > 0 && <div style={{ padding: '6px 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
{ordered.map((t, i) => <ListOrderRow key={t.id} task={t} order={orderIds} index={i} onReorder={onReorder} onToggle={onToggle} onOpen={onOpenTask} />)}
</div>}
{sortMode !== 'order' && groups.map((g) => <React.Fragment key={g.key}>
<SectionLabel dot={g.dot} count={g.items.length}>{g.label}</SectionLabel>
<div className="list">{g.items.map((t) => <TaskRow key={t.id} task={t} event={null} list={null} onToggle={onToggle} onOpen={onOpenTask} {...rowPropsFor(rowProps, t)} />)}</div>
</React.Fragment>)}
{done.length > 0 && <>
<SectionLabel dot="var(--slate)" count={done.length} collapsible expanded={showCompleted} onToggle={() => setShowCompleted((s) => !s)}>Completed</SectionLabel>
{showCompleted && <div className="list">{done.map((t) => <TaskRow key={t.id} task={t} event={null} list={null} onToggle={onToggle} onOpen={onOpenTask} {...rowPropsFor(rowProps, t)} />)}</div>}
</>}
<div style={{ height: 100 }} />
</div>;
}

function AddListSheet({ list, show, onClose, onSave, onDelete }) {
  const [name, setName] = React.useState(list ? list.name : '');
  const [color, setColor] = React.useState(list ? list.color : LIST_COLORS[0].value);
  useIcons();
  return <div className={"sheet-backdrop" + (show ? ' show' : '')} onClick={onClose}>
<div className="sheet" onClick={(e) => e.stopPropagation()}>
<div className="sheet-handle" />
<h2>{list ? 'Edit list' : 'New list'}</h2>
<div className="field" style={{ marginTop: 12 }}><label>List name</label>
<input className="input-plain" placeholder="e.g. Groceries" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
<div className="field"><label>Color</label>
<div className="color-swatch-row">{LIST_COLORS.map((c) => <button key={c.id} type="button" className={"color-swatch" + (color === c.value ? ' selected' : '')} style={{ background: c.value }} onClick={() => setColor(c.value)} title={c.label} />)}</div>
</div>
<div className="row-actions"><Button disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), color })}>{list ? 'Save changes' : 'Create list'}</Button></div>
{list && <div className="row-actions" style={{ paddingTop: 0 }}><Button variant="secondary" onClick={onDelete}>Delete list</Button></div>}
</div></div>;
}

Object.assign(window, { ListsScreen, ListDetailScreen, AddListSheet, LIST_COLORS });
