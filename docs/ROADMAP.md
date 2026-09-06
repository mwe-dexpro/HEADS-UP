# Roadmap

Each item rates **value** and **risk** — risk meaning "how much working
behavior this could break," not difficulty. Same framing the prior "Ladder"
build used.

**Shipped:** Phase 1 — Microsoft sign-in (rotating refresh tokens, short-lived
bearer access tokens), CRUD API for events/tasks/lists on D1, one live
screen (`apps/web`'s task list) proving the full pipeline end-to-end, a
Capacitor Android scaffold, CI for both deploy targets, and the STRIDE
threat model in `docs/THREAT-MODEL.md`. Tests on the security-critical pure
logic, and a CI check gate that runs them (see below).

## Suggested order

1. ~~**Tests on the security-critical pure logic**~~ **Done.** 62 tests
   across both apps (`npm test`), covering exactly the files named below the
   six real bugs from ADR-019 through ADR-024 were found in by hand:
   `lib/refreshTokens.ts` (rotation, reuse → family revocation, and the
   concurrent-rotation race specifically — reproduces ADR-021's own by-hand
   verification steps as an assertion), `lib/crypto.ts` (HMAC, PKCE
   challenge — including the RFC 7636 Appendix B known-answer vector),
   `routes/validation.ts` (zod schemas, especially the `color` regex against
   injection payloads), `lib/origins.ts` (the allow-list), the refresh
   cookie's `Path` actually reaching both `/auth/refresh` and `/auth/logout`
   (`routes/auth.test.ts`, reproducing ADR-019's own verification), and the
   client-side cache key's concurrent get-or-create (`secureCache.test.ts`,
   ADR-024). `apps/api` runs on `@cloudflare/vitest-pool-workers` against a
   real D1 instance (migrations applied in `test/apply-migrations.ts`);
   `apps/web` runs on plain `vitest` with `fake-indexeddb` — see
   `docs/DECISIONS.md` ADR-025 for why the tooling is pinned where it is,
   and `.github/workflows/ci.yml` for the CI gate that now runs both
   `npm run check` and `npm test` on every push/PR (neither deploy workflow
   gated on anything before this).
2. **Phase 2 — the full design's screens** — value 10, risk 4. Everything
   the Claude Design export specified, built against the live API instead of
   `INITIAL_EVENTS`/`INITIAL_TASKS` mock data: Home (overdue/next/upcoming
   grouping), the multi-view calendar (Day/3-Day/Week/Month/Agenda, with the
   All/Events/To-dos filter), event and task detail, the Lists tab
   (color-coded, drag-to-reorder), the Plan Wizard (bulk capture → organize →
   review), Zen/Focus mode, the radial bulk-action control, and the
   directional screen transitions. Risk is mainly in getting the sync model
   right once there's enough UI surface that optimistic updates and the
   offline cache can visibly disagree with the server.
   The export itself is archived at `design/` — `design/README.md` explains
   the bundle, `design/chats/*.md` are the 15 design-iteration transcripts
   (read these for *why* a screen ended up the way it did, not just the
   final markup), `design/project/Heads Up.html` + its `.jsx`/`.css` are the
   prototype to recreate pixel-for-pixel (in this stack's idiom, not by
   porting the prototype's own structure), and
   `design/project/uploads/event-task-app-spec.md` is the original product
   spec the whole design was built from.
   **Home is done** (against the live `/tasks`, `/events`, `/lists` API, not
   mock data): overdue/today/next-3-days/next-week/upcoming grouping, the
   empty state, per-event progress, and task creation. Narrower than the
   prototype on purpose for this first slice — no swipe gestures,
   multi-select, Zen mode, or Plan Wizard yet, and "add task" is
   standalone-only until Events/Lists exist to link against.
   **The calendar is done** too: Day/3-Day/Week/Month/Agenda, the
   All/Events/To-dos filter, and a bottom tab bar (Home/Calendar) to reach
   it, also against the live API. View-only for this slice, matching Home's
   own precedent — tapping an event or task is a no-op until Event/Task
   Detail land, and overlapping same-time items aren't laid out
   side-by-side (the prototype it ports doesn't do that either). The rest
   of Phase 2's screens — event/task detail and the Lists tab — are still
   open.
3. **Real icons and a proper PWA manifest** — value 4, risk 1. The manifest
   currently ships an empty `icons: []` and there's no favicon — placeholder
   gaps left honestly rather than faked, waiting on Phase 2's actual visual
   design rather than inventing one now.
4. **Phase 3 — live Microsoft Graph calendar sync** — value 9, risk 6.
   Add `Calendars.Read`(.Shared) to the existing Microsoft sign-in, store the
   Graph refresh token with application-level AES-GCM envelope encryption on
   top of D1's platform encryption (see `docs/DECISIONS.md` and the
   encryption-at-rest reasoning in the original architecture plan), a sync
   job, and a new dated section in `docs/THREAT-MODEL.md` for the expanded
   scope. Verify `Calendars.Read.Shared` support for the target account type
   before committing to shared-calendar sync specifically — personal
   Microsoft accounts have had gaps here historically (the prior build hit
   the same open question for its own, different, sync attempt).
5. **Phase 4 — Android release** — value 7, risk 5. Signing key generation
   and custody, real app icons, `@capacitor/local-notifications` or
   backend-triggered push (now possible, unlike the prior local-only build,
   since there's a real server to schedule from), Play Store listing. New
   `docs/THREAT-MODEL.md` section for signing-key custody and push-credential
   compromise.
6. **Everything else** — richer recurrence (real RRULE, not the freeform
   string from `docs/DECISIONS.md` ADR-005), multi-device conflict resolution
   beyond last-write-wins, a second OAuth provider if Microsoft-only turns
   out to be too narrow in practice.
