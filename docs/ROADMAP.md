# Roadmap

Each item rates **value** and **risk** — risk meaning "how much working
behavior this could break," not difficulty. Same framing the prior "Ladder"
build used.

**Shipped:** Phase 1 — Microsoft sign-in (rotating refresh tokens, short-lived
bearer access tokens), CRUD API for events/tasks/lists on D1, one live
screen (`apps/web`'s task list) proving the full pipeline end-to-end, a
Capacitor Android scaffold, CI for both deploy targets, and the STRIDE
threat model in `docs/THREAT-MODEL.md`.

## Suggested order

1. **Tests on the security-critical pure logic** — value 9, risk 1. Raised
   from 8 after three real bugs surfaced in review rather than in an
   automated suite (`docs/DECISIONS.md` ADR-019/020/021: logout not
   revoking due to a cookie-path mismatch, the OAuth redirect breaking on a
   subpath deploy, and a rotation race that could double-mint a refresh
   token) — each was only caught by hand-testing a running instance.
   `lib/refreshTokens.ts` (rotation, reuse → family revocation, and now the
   concurrent-rotation race specifically), `lib/crypto.ts` (HMAC, PKCE
   challenge), `routes/validation.ts` (zod schemas, especially the `color`
   regex), and the refresh-cookie's `Path` actually matching every route
   that needs to read it, all have no automated tests yet — only the
   by-hand verification recorded in `docs/THREAT-MODEL.md`. Do this before
   Phase 2 adds enough surface area that a regression here is easy to miss.
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
