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

---

### 015 — Clinical paper, and exactly one accent
**Accepted.** The instrument-panel palette (slate ground, amber, mint) is
replaced by warm off-white paper, ink type, and a single amber reserved for
live. Mint is gone; green survives only as the swipe-to-clear ground.

*Why:* with three accents in play, "live" competed with "new" and "cleared" for
the eye. One colour that only ever means one thing is legible across the room.

*Rule to keep:* if something needs a second accent, take it from the muted inks
(`--blue`, `--green`, a list's `accent`). Amber is spent.

---

### 016 — Live is a filled card; only one at a time is filled
**Accepted.** The design gives live reminders a filled dark card, and the study
in the handoff bundle argues it against two cheaper treatments: a rail (too
close to "slightly different") and a full-bleed ledger row (loses the card
boundary a thumb aims at).

The prototype only ever showed one live card, because it was drawing a calm
moment. Real data is not calm: a fresh import with two overdue to-dos and a
handful of matched events puts nine reminders past due, and nine filled cards
spend the difference the fill was bought with.

So: the first live item gets the filled card. The rest appear immediately under
it in an ALSO DUE NOW band, using the design's own treatment B — amber rail,
DUE NOW in amber ink. Nothing is hidden and nothing is collapsed; the NOW
counter states the true total either way.

*Rejected:* capping the live band, or collapsing the remainder behind a "show
more". Both hide work that is already late, which is the one thing this app
exists not to do.

---

### 017 — Alerts are a third task source, not a second engine
**Accepted.** The design's event sheet has an ALERTS row — at start, 15 min,
1 h, 2 h, 1 day — which the ladder model cannot express, since a rung counts
back in whole days and lands at an hour.

Rather than bolt on a parallel reminder system, `alerts: [minutes]` became a
third source inside `buildNudges`, using the existing key scheme with the
literal ruleId `alert`.

*Why there:* it inherits done-clears-the-whole-task, snooze, notification
dedupe and the fallback rule for free. A second engine would have had to
reimplement all four, and invariant 6 would have quietly stopped being true.

*Cost:* two new invariants (12, 13) and one asymmetry — quiet hours move rungs
but not alerts, because an alert shifted out of the small hours would fire after
the event it is announcing.

---

### 018 — Quiet hours transform the time, never the key
**Accepted.** `applyQuiet` is a pure function of a computed due time, called at
the end of the due calculation.

*Why not earlier:* the tempting version shifts the lead's hour before building
the key. That works until the user edits their quiet window, at which point every
snooze and every notified entry re-keys and completed reminders come back. This
is invariant 11, and it is the same failure mode as invariant 1.

---

### 019 — Features the design does not cover keep working
**Accepted.** The prototype has no place for `.ics` import, the shared-calendar
review queue, notification permission, or the to-do day-of default. All four
exist and are load-bearing.

- Import, permission, watching and the to-do default moved into the Settings
  sheet, in the design's own idiom.
- The review queue became a sixth segment in Calendar, rendered **only** when
  watching is on, so the default five-view bar is exactly as designed.

*Rejected:* dropping them to match the prototype exactly. A handoff bundle is a
picture of a surface, not a specification of scope.

---

### 020 — Controls that cannot bite say so
**Accepted.** The design's settings include a notification sound picker and a
list of connected accounts. There is no audio in the runtime and no sync, so:

- The sound picker is kept and stored, and **Silent** genuinely sets
  `silent: true` on the Notification. The row says the tone itself is the
  platform's.
- ACCOUNTS became CALENDAR SOURCES: real event counts by origin, plus the real
  import control. No invented Google and iCloud rows.

*Rule to keep:* a control that does nothing is worse than an absent one, because
it teaches the user that the settings screen lies. Either wire it, narrow it
until it is true, or leave it out.

---

### 021 — esbuild, and the app file stays host-agnostic
**Accepted.** The build is `build.mjs`: esbuild, about ninety lines, one
dependency. No framework config, no plugin chain.

`src/HeadsUp.jsx` still assumes only React 18 and an async `window.storage`.
Everything platform-specific — IndexedDB, the service worker, the manifest, icon
paths — lives in `web/`.

*Why:* the file was written for the Claude artifact runtime and may go back
there, or somewhere else. The moment it names an icon file or calls
`navigator.serviceWorker`, that stops being true. It is also the reason the app
posts a notification *request* to the worker instead of showing one itself.

*Cost:* one indirection for notifications. Cheap.

---

### 022 — IndexedDB, not localStorage
**Accepted.** The whole state is one JSON blob and the storage contract is
already async, so IndexedDB fits it exactly. localStorage would fit too, until a
real calendar import pushes the blob past 5 MB and every write starts throwing.

Where IndexedDB is unavailable — Safari private browsing, some webviews — the
shim degrades to a `Map` and logs it once. The app's own "changes stay for this
session only" warning is the user-facing half.

---

### 023 — Relative paths everywhere, so the subpath deploy just works
**Accepted.** GitHub Pages serves a project repo from `/<repo>/`. An absolute
`/main.js` in the HTML, the manifest or the worker's precache list works
perfectly on localhost and breaks only in production, which is the worst possible
place to find out.

So: every path the build emits is relative, and the service worker registers
from `./sw.js` so its scope is inferred rather than declared. Verified by serving
`dist/` under a `/HEADS-UP/` prefix and checking that the worker's cache keys
carry the prefix.

*Rule to keep:* if you add an asset, reference it relatively, and test it behind
a path prefix — not just at a root.

---

### 024 — Network-first for our own files
**Accepted.** The worker tries the network first for same-origin requests and
falls back to the cache; only the webfonts are cache-first.

*Why:* the classic PWA failure is a user staring at a build from last week with
no way to force an update. Network-first costs one round trip on a warm start and
removes that failure mode entirely. Every successful response updates the cache
on its way past, so offline still works.

*Rejected:* cache-first with an in-app "a new version is available, reload"
prompt. It is faster and it is more machinery — a version channel, a banner, a
state to test — for an app with one developer and no cold-start budget to defend.

---

### 025 — Scheduled notifications are not shipped, and are not faked
**Accepted.** The worker displays notifications. It does not fire them at 08:00
while the app is closed, because on a static host nothing can: Notification
Triggers never shipped, and Web Push needs a server.

What was rejected is the plausible-looking substitute — a `setTimeout` ladder in
the page, or a Periodic Background Sync handler — either of which would fire
sometimes, on some platforms, and teach the user that the app is unreliable
rather than that this feature is absent.

Instead: notify on open, deduped through `state.notified`, and say so in
LIMITATIONS and in the README. An absent feature the user knows about costs less
than a present one they cannot trust.

