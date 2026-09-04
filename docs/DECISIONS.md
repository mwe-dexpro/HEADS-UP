# Decisions

Short records of choices that would otherwise get quietly reversed. Format
and numbering continue the prior "Ladder" build's `docs/DECISIONS.md`
(branches `claude/*`) in spirit, though this is a separate codebase — see
ADR-001.

---

### 001 — A from-scratch rebuild, not a reskin
**Accepted.** The prior implementation ("Ladder": keyword-rule nudge engine,
esbuild, no backend) is a different domain model from the new Claude Design
export, which has users create tasks by hand and link them to an event or a
list — no rule engine. `main` was reset to an empty "Redesign" commit for
this reason. Ladder's code stays on its `claude/*` branches for reference;
nothing here imports or extends it.

*Cost:* none of Ladder's ~7,600 lines carry forward directly, though its
`docs/ARCHITECTURE.md`/`DECISIONS.md` informed several choices below (D1's
network isolation, relative-path subpath deploys, Capacitor over a TWA).

---

### 002 — GitHub Pages (web) and Cloudflare Workers (API) as two separate hosts
**Accepted.** GitHub Pages serves static files only — no server-side code,
no custom response headers. The backend (auth, database) needs somewhere
that can run code and hold secrets, so it lives on Cloudflare Workers
instead, called cross-origin from the Pages-hosted SPA.

*Cost:* CORS and a cross-site cookie strategy become load-bearing (see
ADR-003, ADR-014) where a same-origin deploy wouldn't need them. GitHub
Pages publishing from Actions needs a public repo on the Free plan, or a
paid plan for a private one.

---

### 003 — Access token: short-lived, in-memory, bearer header — never a cookie
**Accepted.** A first draft of this architecture used a cross-site session
cookie (`SameSite=None`) as the API credential. That's a CSRF corridor: any
page can trigger a cross-origin request riding an ambient cookie, and for a
state-changing route the attacker doesn't need to read the response, only
trigger the action.

Instead: sign-in mints a short-lived (15 minute) ES256 JWT, handed to the
client once and held only in a module-level JS variable — never
`localStorage`, `sessionStorage`, or a cookie. Every API call sends it as
`Authorization: Bearer`. A cross-site request forged by another page cannot
attach a header it has no way to read.

*Cost:* the token doesn't survive a page reload (by design) — every fresh
load does one silent-refresh round trip before the app can do anything (see
ADR-006). An XSS payload running *inside* this origin could still read the
token from memory while the page is open; that threat is CSP's job (ADR-012),
not this one's — the two are deliberately not the same mitigation.

---

### 004 — Sign in with Microsoft only, tenant `common`
**Accepted.** Dropped Google from an earlier draft — one OAuth provider is a
smaller surface, and it lines up with Microsoft Graph as the eventual
calendar-sync target (ADR-007). `common` accepts personal, work, and school
Microsoft accounts; since the issuer isn't a single fixed string for a
multi-tenant app, the callback verifies the ID token's `iss` matches
`https://login.microsoftonline.com/{tid}/v2.0` for the *same* `tid` the
token itself claims, rather than a hardcoded issuer.

*Cost:* a user without a Microsoft account can't use the app. Acceptable —
there's no anonymous/local-only mode in this rebuild (unlike Ladder, which
had no accounts at all).

---

### 005 — `recurrenceRule` stays a freeform string in Phase 1
**Accepted.** Both `events` and `tasks` carry a `recurrence_rule TEXT`
column with no parsing, validation, or expansion logic behind it yet.

*Cost:* nothing recurs automatically yet; "repeats quarterly" is just a label
until real RRULE semantics land (see `docs/ROADMAP.md`). Documented as a
known simplification rather than a half-built recurrence engine — the
column exists so the schema doesn't need a breaking migration when the real
thing is built.

---

### 006 — Refresh tokens: rotating, peppered-hash storage, reuse detection
**Accepted.** Every refresh token belongs to a `family_id` created at
sign-in. `/auth/refresh` always issues a new token and revokes the one just
presented; presenting an already-revoked token revokes the *entire* family
instead of just failing — a legitimate client only ever holds the newest
token, so a stale replay is the standard tell that someone else has a copy.

Tokens are stored as `HMAC-SHA256(pepper, token)`, not raw — a full
`refresh_tokens` table dump can't be replayed without the pepper (a Worker
secret, never in the database it protects).

*Cost:* one extra DB write per refresh (rotate-and-reissue instead of just
validating). Cheap at this app's scale, and it's the mechanism that makes
theft detectable instead of just "eventually expires."

---

### 007 — No calendar scope in Phase 1
**Accepted.** Sign-in requests `openid profile email` only — no
`Calendars.Read`. Asking for calendar permission before there's a sync
feature to use it would be a control that does nothing, which Ladder's own
ADR-020 already named as worse than not having the control at all. Calendar
scope, token storage, and a sync job are Phase 3 (`docs/ROADMAP.md`), and get
their own dated section in `docs/THREAT-MODEL.md` when they land — a new
scope is a new trust boundary.

---

### 008 — Database: Cloudflare D1 (SQLite), chosen for its network isolation
**Accepted.** D1 has no public network endpoint at all — the only way to
reach it is the Worker's own binding. A network-accessible Postgres
(Neon/Supabase) would add a publicly-routable database and a
connection-string secret to protect, for no relational need this app
actually has (single-user-owned rows, no complex joins, no need for
read replicas).

*Reconsider if:* a real need for something D1 can't do shows up — heavier
analytics, geo-replication. Not a concern at this app's scale.

---

### 009 — Vite + React + React Router, not Next.js
**Accepted**, reversing an earlier draft. Next's actual value — SSR, API
routes, image optimization — is moot once the only web host is static
GitHub Pages and the backend is a separate Worker; a framework whose
features go unused is complexity with nothing to show for it. Vite is
lighter, has no static-export-specific edge cases to fight, and is the same
shape of tooling the prior "Ladder" build used successfully (esbuild there,
Vite — also esbuild-based — here).

---

### 010 — Relative asset paths, configurable base, for the GitHub Pages subpath
**Accepted.** GitHub Pages serves a project site from `/<repo>/`, not the
domain root. `vite.config.ts` reads `VITE_BASE_PATH` (set to `/HEADS-UP/` in
CI, unset — i.e. `/` — for local dev) and every build-emitted path, the
manifest's `start_url`/`scope`, and the service worker's registration path
are all relative to it. An absolute `/main.js` anywhere works on localhost
and breaks only in production, which is the worst place to find out — the
same reasoning the prior build's ADR-023 used.

---

### 011 — Capacitor for Android, not a TWA
**Accepted**, carried forward from the prior build's ADR-027 reasoning. A
Trusted Web Activity is the site in a shell — same web notification
limitations as the browser. Capacitor is that plus a bridge to native code;
`@capacitor/local-notifications` (Phase 4) is a thin wrapper over Android's
own `AlarmManager`. The Android project lives in `apps/android/`, pointed at
`apps/web`'s build via a relative `webDir`.

*Cost:* a Gradle project in the repo (~850 KB, mostly the Gradle wrapper) and
eventually a signing key to look after. Generated now, unmodified, so it's
`cap add android`'s stock template rather than something carrying real
edits yet — Phase 4 is where notification permissions and icons make it
worth diffing by hand (see the prior build's own reasoning for *why* it
committed a modified copy, which doesn't apply until there's a modification).

---

### 012 — Content-Security-Policy via `<meta>`, not a header
**Accepted, forced.** GitHub Pages cannot send custom HTTP response headers
at all — there's no server to configure. The CSP rides as a
`<meta http-equiv="Content-Security-Policy">` tag instead, injected at build
time only (Vite's dev server needs inline/eval'd HMR code the policy would
break). This covers `script-src`/`style-src`/`connect-src`/etc. but not
`frame-ancestors` or reporting, which meta tags don't support — GitHub
Pages being HTTPS-only covers transport security separately, with no HSTS
header needed on that host (the Worker API does send one; see
`docs/THREAT-MODEL.md`).

---

### 013 — Local cache: AES-GCM with a non-extractable `CryptoKey`
**Accepted.** The offline read cache (IndexedDB) is encrypted with a key
generated via the Web Crypto API as non-extractable — in-origin code can
still ask it to encrypt/decrypt (offline reload keeps working), but the raw
key bytes can never be exported, including by devtools or a malicious
browser extension with storage access. Sign-out deletes the whole database.

*What this does not defend against, on purpose:* an XSS payload running
inside the app's own origin can call the same `decrypt()` the app does.
That's CSP's job (ADR-012), not this one's.

---

### 014 — CSRF: Origin allow-list, path-scoped refresh cookie
**Accepted.** The refresh cookie is the one credential still carried
ambiently (it has to be — it's how a reload restores a session without
re-running the whole OAuth flow). Three layers, not one: `Path=/auth/refresh`
so it's never attached to a data route even if something there mishandled
it; `SameSite=None;Secure` because the SPA and API are different origins;
and an explicit `Origin` header check on `/auth/refresh` and `/auth/logout`
that CORS alone doesn't provide — CORS blocks a page from *reading* a
cross-site response, not from *sending* a simple cross-site request in the
first place, which is exactly the gap CSRF lives in.

---

### 015 — Rate limiting: a D1 fixed-window counter, not a Durable Object
**Accepted.** `/auth/*` is limited per-IP via one `INSERT ... ON CONFLICT DO
UPDATE ... RETURNING` upsert against a `rate_limit_buckets` table — one
round trip, atomic increment-and-read, no separate coordination primitive.

*Cost:* a fixed window can allow a burst right at the window boundary
(twice the nominal limit in the worst case), unlike a sliding-window or
token-bucket scheme. Acceptable for blunting brute-force/credential abuse at
this app's traffic scale; reconsider only if `/auth/*` ever sees real
adversarial load a boundary burst would matter for.

---

### 016 — Audit log on destructive actions
**Accepted.** Every `DELETE` writes one row to `audit_log` (user, action,
entity type/id, timestamp) before returning. D1's own point-in-time recovery
is the backstop for actually restoring data; this is the human-readable
trail for "what happened and when."

---

### 017 — Input validation with `zod` at the API boundary
**Accepted.** TypeScript types from `packages/shared` describe the shape
requests *should* have; they vanish at runtime and prove nothing about what
a client actually sent. Every mutating route parses its body with a `zod`
schema (`apps/api/src/routes/validation.ts`) before touching the database —
including a narrow regex on list `color` (hex or `var(--token)` only) so a
future screen can't be handed a CSS/HTML injection payload through a field
that looks like plain data.

---

### 018 — npm workspaces, no Turborepo
**Accepted.** Three apps and one shared package, one developer. A build
orchestrator earns its keep when there are enough packages that rebuilding
everything on every change gets slow, or enough people that caching CI runs
across them matters. Neither is true yet.

*Reconsider if:* the number of workspaces or the team grows enough that
`npm run build:web` cascading to type-check `packages/shared` on every
invocation actually costs noticeable time.
