# Threat model

A living document, not a one-off audit. Every phase that changes a trust
boundary — a new OAuth scope, a new storage location, Android release
signing — gets a new dated section below, appended, not edited into the
existing ones. Earlier sections stay as a record of what was true when they
were written.

## Trust boundaries (Phase 1)

```
Browser / Capacitor WebView (untrusted)
    │  HTTPS, bearer token in memory, refresh cookie (Path=/auth/refresh)
    ▼
Cloudflare Worker API (trusted logic, no persistent state of its own)
    │  D1 binding — not a network connection, not reachable any other way
    ▼
D1 / SQLite (trusted store, no public endpoint)

Microsoft identity platform — external trusted IdP, reached only during sign-in
```

## STRIDE — Phase 1 (accounts, CRUD API, Microsoft sign-in)

### Spoofing

| Threat | Mitigation | Where |
|---|---|---|
| Stolen/forged access token | Signed (ES256), 15 min TTL, verified server-side on every request (signature + issuer + audience) | `lib/jwt.ts`, `middleware/auth.ts` |
| Replayed refresh token | Rotation + family revocation: a replayed (already-rotated-out) token revokes the whole family | `lib/refreshTokens.ts`, ADR-006 |
| Forged Microsoft IdP response | `state` checked against the stashed cookie; ID token signature verified against Microsoft's live JWKS; `nonce`, `iss` (tenant-matched), `aud` all checked before a session is created | `lib/microsoft.ts`, `routes/auth.ts` |
| CSRF on cookie-authenticated routes | Explicit `Origin` allow-list check, independent of CORS | `middleware/trustedOrigin.ts`, ADR-014 |

**Verified, not just designed**: a replayed refresh token was tested by hand
against a running instance and confirmed to 401 and force re-authentication
rather than silently succeeding (see `docs/ROADMAP.md` — a scripted
regression test for this is still open work).

### Tampering

| Threat | Mitigation |
|---|---|
| MITM alters requests/responses | HTTPS everywhere; the Worker sends HSTS (`max-age=63072000; includeSubDomains; preload`) — GitHub Pages has no header mechanism to send one from, but is HTTPS-only regardless |
| IDOR — client passes another user's id | Every query derives `user_id` from the verified token, never from the request; every foreign-key link (`eventId`/`listId` on a task) is ownership-checked before being allowed, not just followed |
| JWT claim tampering | Signature verified server-side on every call, not just decoded |
| Malicious `color`/text fields reaching a future rendered surface | `zod` validation at the API boundary, including a narrow allow-list regex for `color` (hex or `var(--token)` only) |

**A real bug this caught during implementation**: the first draft of
`GET /tasks` fetched *all* reminders in the database (no `WHERE` clause) and
filtered client-side by matching task ids — an information-disclosure bug
(any signed-in user's reminder rows would transit the server's memory and
could easily have leaked into the response with one further mistake), caught
in code review before it shipped and fixed to scope the query by the
caller's own task ids. Left here deliberately as an example of exactly the
class of mistake this document exists to catch.

### Repudiation

| Threat | Mitigation |
|---|---|
| No record of who deleted what | `audit_log` row on every delete (user, action, entity, timestamp) |
| Need to recover from a bad write | D1 point-in-time recovery (Cloudflare platform feature) as the backstop; the audit log is for "what happened," not restoration |

### Information disclosure

| Threat | Mitigation |
|---|---|
| Secrets in source control or the client bundle | `MS_CLIENT_SECRET`, `JWT_SIGNING_KEY`, `REFRESH_TOKEN_PEPPER` exist only as Worker secrets (`wrangler secret put`) or local `.dev.vars` (gitignored); nothing server-only ships in the frontend bundle |
| Direct database access | D1 has no public network endpoint — the only path in is the Worker's own binding |
| SQL injection | Drizzle's parameterized query builder throughout; no raw string-built SQL anywhere in the codebase |
| Verbose errors leaking internals | `app.onError` returns a generic `{error: "internal error"}`; real detail goes to `console.error` (Worker logs) only. Auth failures specifically don't distinguish "expired" from "malformed" from "wrong signature" |
| Local IndexedDB cache read by another process/extension/stolen disk | AES-GCM with a non-extractable `CryptoKey` — see ADR-013. Does **not** defend against XSS running in-origin; that's CSP's job (next row) |
| XSS reading the in-memory access token or the encrypted cache | Content-Security-Policy (`default-src 'self'`, no `unsafe-inline`, no unpinned third-party scripts) via `<meta>` — see ADR-012 for why a meta tag and not a header |
| Refresh token database dump | Stored as `HMAC-SHA256(pepper, token)`; pepper is a Worker secret never co-located with the table it protects |

### Denial of service

| Threat | Mitigation |
|---|---|
| Brute-force / credential-stuffing against `/auth/*` | Per-IP fixed-window rate limit (20 requests / 5 min on start+callback, 60/5min on refresh) — see ADR-015 |
| Account enumeration via auth error messages | Generic error bodies; sign-in failures don't reveal whether an account exists |

**Verified**: 22 rapid requests to `/auth/microsoft/start` against a running
local instance returned 20× `200` then 2× `429`, confirming the limiter
actually engages rather than just existing in code.

### Elevation of privilege

Single role in Phase 1 — an authenticated user acting on their own rows.
No admin role, no shared/team data, nothing to escalate *to* yet. Deliberately
no speculative RBAC scaffolding ahead of a feature that needs it — see
`docs/DECISIONS.md` ADR-018's reasoning for the same instinct applied to
tooling.

## Known residual risk (Phase 1, accepted)

- **A shared device left signed in** can read the local IndexedDB cache
  (though not the access token, which is memory-only and gone on reload) and
  use the app while the tab stays open. Sign-out wipes the cache; there's no
  remote "sign out all devices" yet beyond revoking one refresh token family
  at a time.
- **CSP via `<meta>` can't cover `frame-ancestors` or violation reporting** —
  a GitHub Pages limitation (ADR-012), not a choice.
- **A fixed-window rate limiter allows a boundary burst** (up to ~2× the
  nominal limit right at a window edge) — accepted for this traffic scale,
  see ADR-015.

## Next dated sections (not yet written)

- **Phase 3** (live Microsoft Graph calendar sync): a new OAuth scope is a
  new trust boundary — what the Graph token can read/write, where it's
  stored (application-level AES-GCM envelope on top of D1's platform
  encryption, per the original architecture plan), what a compromised token
  costs.
- **Phase 4** (Android release, push notifications): signing key custody,
  Play Store account access, and — once push is backend-triggered rather
  than the prior build's on-device-only alarms — what a compromised push
  credential could do.
