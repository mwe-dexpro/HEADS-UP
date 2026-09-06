const { useState: useWizState, useRef: useWizRef } = React;
const WIZ_TODAY = new Date(2026, 7, 18);
let wizCounter = 0;
function wizGenId() { return 'w' + Date.now().toString(36) + (wizCounter++); }
const WIZ_DAYS = [{ v: 0, l: 'Today' }, { v: 1, l: 'Tmrw' }, { v: 2, l: '+2d' }, { v: 3, l: '+3d' }];
const WIZ_PRIORITY_ORDER = ['normal', 'high', 'low'];
const WIZ_ROW_SLOT = 96;

function wizDayInfo(offset) {
  const d = new Date(WIZ_TODAY);d.setDate(d.getDate() + offset);
  const dueLabel = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return { dueLabel, dayOffset: offset };
}
function wizDayGroupLabel(offset) {
  return offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : wizDayInfo(offset).dueLabel;
}

function WizCaptureStep({ drafts, onAdd, onAddBulk, onRemove }) {
  const [val, setVal] = useWizState('');
  const [bulk, setBulk] = useWizState(false);
  const [bulkVal, setBulkVal] = useWizState('');
  const inputRef = useWizRef(null);
  function submit() {
    const v = val.trim();
    if (!v) return;
    onAdd(v);
    setVal('');
    inputRef.current && inputRef.current.focus();
  }
  function submitBulk() {
    const lines = bulkVal.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    onAddBulk(lines);
    setBulkVal('');
  }
  return <div className="wiz-body">
{!bulk && <div className="wiz-capture-row">
<input ref={inputRef} className="input-plain" placeholder="e.g. Call the vet about refill" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />
<button className="wiz-add-btn" onClick={submit}><Icon name="plus" size={20} /></button>
</div>}
{bulk && <>
<textarea className="wiz-bulk-textarea" placeholder={"Paste or type one task per line\ne.g.\nPack kitchen boxes\nCall the vet\nBook moving truck"} value={bulkVal} onChange={(e) => setBulkVal(e.target.value)} />
<div className="row-actions" style={{ padding: '10px 0 0' }}><Button onClick={submitBulk}>Add all lines</Button></div>
</>}
<span className="wiz-toggle-link" onClick={() => setBulk((b) => !b)}>{bulk ? 'Add one at a time' : 'Paste a list instead'}</span>
{drafts.length > 0 && <div className="wiz-count">{drafts.length} task{drafts.length > 1 ? 's' : ''} added</div>}
{drafts.length === 0 && <div className="wiz-empty-hint">Nothing yet — start typing what's on your mind for today or the next few days.</div>}
<div className="wiz-capture-list">{drafts.map((d) => <div key={d.id} className="wiz-capture-item">
<Icon name="circle" size={8} style={{ color: 'var(--dust-taupe)' }} />
<input value={d.name} onChange={(e) => onRemove.edit(d.id, e.target.value)} />
<div className="wiz-remove" onClick={() => onRemove.remove(d.id)}><Icon name="x" size={15} /></div>
</div>)}</div>
</div>;
}

function WizTaskRow({ draft, index, drafts, onReorder, onEdit, onDay, onPriority, onRemove }) {
  const dragRef = useWizRef(null);
  const [dragY, setDragY] = useWizState(0);
  const [dragging, setDragging] = useWizState(false);
  function down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { fromIndex: index, startY: e.clientY, base: drafts.map((x) => x.id) };
    setDragging(true);setDragY(0);
  }
  function move(e) {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    setDragY(dy);
    const shift = Math.round(dy / WIZ_ROW_SLOT);
    const newIndex = Math.max(0, Math.min(d.base.length - 1, d.fromIndex + shift));
    const ids = [...d.base];
    const idx = ids.indexOf(draft.id);
    ids.splice(idx, 1);ids.splice(newIndex, 0, draft.id);
    const byId = Object.fromEntries(drafts.map((x) => [x.id, x]));
    onReorder(ids.map((id) => byId[id]));
  }
  function up() {dragRef.current = null;setDragging(false);setDragY(0);}
  const p = draft.priority;
  const pLabel = p === 'high' ? 'High' : p === 'low' ? 'Low' : 'Normal';
  return <div className={"wiz-task-row" + (dragging ? ' dragging' : '')} style={dragging ? { transform: `translateY(${dragY}px)` } : undefined}>
<div className="wiz-drag-handle" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}><Icon name="grip-vertical" size={18} /></div>
<div className="wiz-task-main">
<input className="wiz-task-name-input" value={draft.name} onChange={(e) => onEdit(draft.id, e.target.value)} />
<div className="wiz-day-chips">{WIZ_DAYS.map((dd) => <span key={dd.v} className={"wiz-day-chip" + (draft.day === dd.v ? ' active' : '')} onClick={() => onDay(draft.id, dd.v)}>{dd.l}</span>)}</div>
</div>
<button className={"wiz-priority-btn " + p} onClick={() => onPriority(draft.id)}><Icon name="flag" size={16} /><span className="lbl">{pLabel}</span></button>
<div className="wiz-remove-row" onClick={() => onRemove(draft.id)}><Icon name="x" size={14} /></div>
</div>;
}

function WizOrganizeStep({ drafts, setDrafts }) {
  function sortDue() {setDrafts((ds) => [...ds].sort((a, b) => a.day - b.day));}
  function sortImportance() {const rank = { high: 2, normal: 1, low: 0 };setDrafts((ds) => [...ds].sort((a, b) => rank[b.priority] - rank[a.priority]));}
  function edit(id, name) {setDrafts((ds) => ds.map((d) => d.id === id ? { ...d, name } : d));}
  function setDay(id, day) {setDrafts((ds) => ds.map((d) => d.id === id ? { ...d, day } : d));}
  function cyclePriority(id) {setDrafts((ds) => ds.map((d) => {if (d.id !== id) return d;const i = WIZ_PRIORITY_ORDER.indexOf(d.priority);return { ...d, priority: WIZ_PRIORITY_ORDER[(i + 1) % WIZ_PRIORITY_ORDER.length] };}));}
  function remove(id) {setDrafts((ds) => ds.filter((d) => d.id !== id));}
  return <div className="wiz-body">
<div className="wiz-sort-row"><span className="lbl">Sort by</span><div className="seg-tabs dense" style={{ width: 'auto' }}>
<button type="button" className="seg-tab" onClick={sortDue}>Due date</button>
<button type="button" className="seg-tab" onClick={sortImportance}>Importance</button>
</div></div>
<div style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 450, marginTop: 2 }}>Drag the handle to set your execution order — the sequence you'll actually tackle them in.</div>
<div className="wiz-org-list">{drafts.map((d, i) => <WizTaskRow key={d.id} draft={d} index={i} drafts={drafts} onReorder={setDrafts} onEdit={edit} onDay={setDay} onPriority={cyclePriority} onRemove={remove} />)}</div>
</div>;
}

function WizReviewStep({ drafts }) {
  const groups = [0, 1, 2, 3].map((offset) => ({ offset, label: wizDayGroupLabel(offset), items: drafts.filter((d) => d.day === offset) })).filter((g) => g.items.length > 0);
  return <div className="wiz-body">
<div className="wiz-summary-banner"><b>{drafts.length} task{drafts.length > 1 ? 's' : ''}</b>Ready to add to your plan, in the order you set</div>
{groups.map((g) => <div key={g.offset} className="wiz-review-group">
<div className="wiz-review-group-head"><span className="dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink)', display: 'inline-block' }} />{g.label}<span className="count">{g.items.length}</span></div>
{g.items.map((d) => <div key={d.id} className="wiz-review-item">{d.priority === 'high' && <Icon name="flag" size={14} style={{ color: 'var(--signal-orange)' }} />}<span className="wiz-review-name">{d.name}</span></div>)}
</div>)}
</div>;
}

function PlanWizard({ onClose, onCreate }) {
  const [step, setStep] = useWizState(1);
  const [stepDir, setStepDir] = useWizState('forward');
  const [drafts, setDrafts] = useWizState([]);
  useIcons();
  function goStep(n) {setStepDir(n > step ? 'forward' : 'back');setStep(n);}
  function addOne(name) {setDrafts((ds) => [...ds, { id: wizGenId(), name, day: 0, priority: 'normal' }]);}
  function addBulk(lines) {setDrafts((ds) => [...ds, ...lines.map((name) => ({ id: wizGenId(), name, day: 0, priority: 'normal' }))]);}
  function editOrRemove_edit(id, name) {setDrafts((ds) => ds.map((d) => d.id === id ? { ...d, name } : d));}
  function editOrRemove_remove(id) {setDrafts((ds) => ds.filter((d) => d.id !== id));}
  const titles = { 1: 'Plan your next few days', 2: 'Organize', 3: 'Review & create' };
  const subtitles = { 1: "Quick-fire everything on your mind — one at a time or pasted as a list.", 2: 'Assign a day, set priority, and drag to set the order you\u2019ll do them in.', 3: 'Here\u2019s your plan. Create it and it\u2019ll show up on Home, Zen, and Calendar.' };
  function finalize() {
    const tasks = drafts.map((d) => {
      const { dueLabel, dayOffset } = wizDayInfo(d.day);
      return { id: 'wt' + wizGenId(), eventId: null, name: d.name.trim() || 'Untitled task', bucket: 'next3', dueLabel, dayOffset, done: false, recurrence: null, priority: d.priority, reminders: [] };
    });
    onCreate(tasks);
  }
  return <div className="screen wizard-screen">
<div className="wiz-header">
<div className="wiz-header-top">
<div className="icon-btn" style={step > 1 ? undefined : { visibility: 'hidden' }} onClick={() => goStep(step - 1)}><Icon name="chevron-left" /></div>
<div className="wiz-dots">{[1, 2, 3].map((n) => <span key={n} className={"wiz-dot" + (n === step ? ' active' : '')} />)}</div>
<div className="icon-btn" onClick={onClose}><Icon name="x" /></div>
</div>
<div className="wiz-title">{titles[step]}</div>
<div className="wiz-subtitle">{subtitles[step]}</div>
</div>
<div key={step} className={"wiz-step-anim " + (stepDir === 'forward' ? 'fwd' : 'bck')}>
{step === 1 && <WizCaptureStep drafts={drafts} onAdd={addOne} onAddBulk={addBulk} onRemove={{ edit: editOrRemove_edit, remove: editOrRemove_remove }} />}
{step === 2 && <WizOrganizeStep drafts={drafts} setDrafts={setDrafts} />}
{step === 3 && <WizReviewStep drafts={drafts} />}
</div>
<div className="wiz-footer">
{step < 3 && <Button disabled={drafts.length === 0} onClick={() => goStep(step + 1)}>{step === 1 ? `Next \u00b7 ${drafts.length} task${drafts.length > 1 ? 's' : ''}` : 'Review plan'}</Button>}
{step === 3 && <Button onClick={finalize}>Create {drafts.length} task{drafts.length > 1 ? 's' : ''}</Button>}
</div>
</div>;
}

Object.assign(window, { PlanWizard });
