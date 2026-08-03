# Decisions

Short records of choices that would otherwise get quietly reversed. Each one
notes what it costs, so reversing it is a decision rather than an accident.

---

### 001 — The reminder is the primary object, not the event
**Accepted.** Upcoming sorts by reminder due time. An event with no reminders is
nearly invisible; a reminder always names its event.

*Cost:* a plain "what's on next week" calendar view doesn't exist. The Events tab
is a management surface, not a calendar.

---

### 002 — Done is recorded per task, not per reminder
**Accepted.** One tap on "Buy a present" clears all three of its lead times.

*Cost:* you cannot dismiss one reminder of a ladder and keep the rest. Snooze
covers that case instead, and snooze *is* per reminder.

*Why it matters:* the alternative was tested mentally and fails — three separate
dismissals for one errand trains the user to ignore the app.

---

### 003 — Keyword rules, not AI inference
**Accepted**, chosen by the user over "AI suggests, I approve".

*Cost:* new event types need a keyword added by hand. Nothing happens for an
event whose title doesn't match, which is why the catch-all fallback exists.

*Reconsider if:* the rule list grows past ~15 entries and still misses things.
Inference then becomes a suggestion layer *on top of* rules, never a replacement
— predictability is the point.

---

### 004 — `.ics` import in v1, not live Graph sync
**Accepted, forced.** OAuth against Microsoft Entra needs a registered redirect
URI on a stable origin, which the artifact sandbox cannot provide.

*Cost:* the New-events feature has no live source. Someone must export or
publish the calendar and import it.

---

### 005 — Public client, PKCE, no client secret
**Accepted.** Entra registers SPAs as public clients, which by definition cannot
hold secrets. The client ID ships in the bundle; it is an identifier, not a
credential, and encrypting it achieves nothing.

Token handling, when sync is built:
- authorization code flow with PKCE, authority `/common`
- prefer `sessionStorage` over `localStorage`
- if tokens are persisted, encrypt with a **non-extractable** `CryptoKey` held in
  IndexedDB — an XSS payload can then use it while the page is open but cannot
  exfiltrate it for later
- strict CSP, no third-party scripts (cheap here, everything is self-contained)
- Entra caps SPA refresh tokens at 24 hours, which bounds the blast radius

*Never:* a client secret in a static bundle.

---

### 006 — Static hosting is file delivery, not a backend
**Accepted.** A PWA installs from an origin and service workers refuse to
register on `file://`, so an HTTPS origin is required. GitHub Pages serves the
files once; from then on the service worker serves from the device cache. No user
data leaves the phone.

GitHub Pages specifics: redirect URI must match exactly, trailing slash and case
included; use relative asset paths because the site is served from a
subdirectory; free-tier Pages requires a public repo.

---

### 007 — Shared-calendar watching is opt-in and off by default
**Accepted**, per the user: valuable for a shared calendar, noise for a personal
one. The New tab does not exist in the tab bar until it is switched on.

*Open risk:* `Calendars.Read.Shared` is documented as unsupported for personal
Microsoft accounts. If the target calendar is a consumer account, this feature
may never get a live data source. Verify before building sync.

---

### 008 — Location is always on the card; badges flag only what is hidden
**Accepted.** Location earned a permanent row. The badge cluster shows recurrence
and a notes marker only.

*Rule to keep:* if a field becomes visible on the card, delete its badge. A badge
pointing at visible information is noise.

---

### 009 — One storage key for the whole state
**Accepted.** The storage API is rate limited and the state is always written
together. Debounced 400 ms.

*Cost:* concurrent writers would clobber each other. Single-user app, acceptable.

---

### 010 — Every card body is the same key/value table
**Accepted**, at the user's request over prose-style card text. Shared `<Row>`
component, fixed label column, so the eye lands in the same place on every card.

*Cost:* four rows is about the ceiling. New fields belong behind the details
toggle, not in the table.

---

### 011 — A to-do's completion lives on the item, not in `state.done`
**Accepted.** Event reminders record "I handled this nudge" in `state.done`. A
to-do records "this thing is finished" on the item itself, because that is
intrinsic data rather than reminder state.

*Cost:* two completion paths in one app. `markDone` branches on `n.kind`, and
anything new that completes a nudge must branch too.

*Consequence:* there is no per-reminder dismissal for to-dos. Ticking any
reminder of a to-do finishes the to-do. Snooze covers the "not now" case, as it
does for events (DECISIONS 002).

---

### 012 — Undo instead of confirmation dialogs
**Accepted.** Six destructive actions snapshot the whole state object and offer
a nine-second undo. No "are you sure?" anywhere.

*Why:* confirmation dialogs get dismissed reflexively, so they stop very few
mistakes while taxing every correct action. Reversibility also makes the app
safe to explore, which matters more than it sounds for a rules engine.

*Cost:* undo restores the entire snapshot, so it reverts any unrelated edit made
in the same window. Single-step, and lost on reload.

*Reconsider if:* an action becomes genuinely irreversible — a real sync that
deletes remote data, for instance. That one earns a dialog.

---

### 013 — Four destinations; configuration is not one of them
**Accepted.** The tab bar had grown to six entries and changed shape when
shared-calendar watching was toggled, which makes muscle memory impossible.

Now: Upcoming · Lists · Calendar · Rules, always four.

- New is not a destination. It is an inbox that empties, so it became a segment
  inside Calendar with a count badge, plus the existing banner on Upcoming.
- Settings sit behind a header control. They are visited rarely and were
  occupying a permanent slot.

*Rule to keep:* the bottom bar is for places you go. If something is a thing you
adjust, it belongs behind the gear or inside the surface it affects.

---

### 014 — The rule preview calls the real engine
**Accepted.** `RuleProbe` builds a synthetic event and runs `matchRules` and
`buildNudges` over it, rather than describing what would happen.

*Why:* a preview that reimplements the logic drifts from it, and a preview that
lies is worse than none — the whole point is to trust it before a real event
depends on it.

*Cost:* this is now a constraint on `buildNudges` — see ARCHITECTURE invariant
10. It must stay callable with a hand-built dataset.
