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

---

### 019 — Refresh cookie scoped to `/auth`, not `/auth/refresh`
**Accepted, fixing a real bug found in review.** The cookie was originally
`Path=/auth/refresh`, on the reasoning that it should reach nothing but the
one route that reads it. That reasoning was too narrow: a cookie's `Path`
attribute governs which requests the *browser* attaches it to, and
`/auth/logout` is not "at or under" `/auth/refresh` — so the cookie was
never sent to logout, `getCookie` there always returned `undefined`, and
`/auth/logout` could set `Set-Cookie: ...Max-Age=0` (clearing the browser's
copy) while never calling `revokeFamilyForToken` at all. A stolen refresh
token remained valid for its full 30-day life regardless of the user
signing out.

Fixed by widening the `Path` to `/auth`, which still excludes every data
route (`/events`, `/tasks`, `/lists`) — the actual security goal — while
covering both `/auth/refresh` and `/auth/logout`.

*Verified*: seeded a known refresh token directly in D1, called
`POST /auth/logout` with it as the cookie, and confirmed the row's
`revoked_at` was set afterward — not just that the response looked right.

---

### 020 — OAuth callback redirect path comes from `FRONTEND_APP_PATH`, not a hardcoded root path
**Accepted, fixing a real bug found in review.** The callback built its
post-sign-in redirect as `new URL(FRONTEND_ORIGINS[0])` with
`pathname = "/auth/complete"` — a root-relative path. `FRONTEND_ORIGINS` is
(and must stay) origin-only, because it's also compared against the
browser's `Origin` header for CORS/CSRF checks, and that header never
carries a path. But GitHub Pages serves a project site from `/HEADS-UP/`,
not the domain root (see ADR-010), so the hardcoded path pointed at
`https://mwe-dexpro.github.io/auth/complete` — outside the deployed app
entirely — while the real route lives at
`https://mwe-dexpro.github.io/HEADS-UP/auth/complete`. Sign-in would
complete on Microsoft's side and then redirect into a 404, or onto whatever
(if anything) happens to be served from that org's account root.

Fixed by adding a separate `FRONTEND_APP_PATH` var (`wrangler.toml`, kept in
sync with `VITE_BASE_PATH` in `pages.yml`) used only to build this one
redirect's path — `FRONTEND_ORIGINS` is untouched and stays origin-only.

*Cost:* one more piece of config to keep in sync with the frontend's actual
deploy path if it ever changes. Cheap, and the alternative (deriving it from
something else) would have to hardcode the same assumption somewhere else.

---

### 021 — Refresh-token rotation is a compare-and-swap, not a read-then-write
**Accepted, fixing a real bug found in review.** The original rotation read
the token row, checked `revokedAt`, and — in a *separate* statement —
updated it to revoked and minted a replacement. Two requests presenting the
same still-valid token at nearly the same instant could both pass the
`revokedAt` check before either write landed, and both mint a new token from
the same rotation: exactly the double-use the whole family/rotation scheme
(ADR-006) exists to catch, arriving via a race instead of a deliberate
replay, and silently defeating the reuse detection rather than triggering
it.

Fixed with a single atomic statement: `UPDATE ... SET revoked_at = ... WHERE
id = ? AND revoked_at IS NULL RETURNING *`. D1/SQLite serializes writes to a
database, so of two concurrent attempts exactly one claims the row (gets a
row back) and the other gets none — and getting none is now treated the
same as an explicit replay: the whole family is revoked.

*Cost, deliberately accepted:* this also punishes the *innocent* double-use
case — two tabs of the same legitimate session refreshing within the same
race window — by killing that session's family too, forcing a fresh
sign-in. That is the standard trade-off industry rotation-with-detection
implementations make (a grace-period exception for near-simultaneous
legitimate retries is the usual refinement, and is real added complexity of
its own); not built here — see `docs/ROADMAP.md` if this proves to bite in
practice.

*Verified*: seeded a fresh refresh token and fired two truly concurrent
`POST /auth/refresh` requests presenting it. One received a new access
token, the other got `401 invalid refresh token`, and a direct D1 query
afterward showed *both* rows in that family — the loser's original token and
the winner's freshly-minted replacement — with `revoked_at` set on both,
confirming no live token survived the race on either side.

---

### 022 — OAuth callback redirects to the origin sign-in started from, not `FRONTEND_ORIGINS[0]`
**Accepted, fixing a real bug found in a second review pass.** `FRONTEND_ORIGINS` is documented and designed as a list — CORS and the CSRF check
both already iterate it — but the callback's redirect picked
`.split(",")[0]` unconditionally. With only one origin configured this was
invisible; the moment a second one exists (a local-dev origin, or a
Capacitor/Android WebView origin once Phase 4 wraps the app), anyone who
started sign-in from any origin but the first would be silently redirected
to the wrong one after Microsoft's callback, with no way to receive their
access token.

Fixed by having `/auth/microsoft/start` read and validate the caller's
`Origin` header (the same allow-list check as `requireTrustedOrigin`,
factored out to `lib/origins.ts` so the two can't drift) and stash it in the
existing state/nonce/codeVerifier cookie. The callback redirects to
`txn.origin`, not a fixed index into the config list.

*Verified*: `POST /auth/microsoft/start` with an allow-listed `Origin`
returns a `Set-Cookie` whose value, decoded, includes that exact origin;
with a missing or disallowed `Origin` it 403s before a transaction cookie is
ever issued.

---

### 023 — Rate-limit buckets are cleaned up opportunistically, not by a Cron Trigger
**Accepted, fixing a real bug found in a second review pass.** `rate_limit_buckets` had a row inserted per `(ip, route, 5-minute window)` with
nothing ever deleting old ones — unbounded growth over the life of a
deployed instance, for a table that only needs to remember the current and
immediately-preceding window.

Fixed with one extra `DELETE ... WHERE window_start < :currentWindowStart`
inside `checkRateLimit` itself — every call trims everything older than its
own current window, for every key, not just the caller's own. A dedicated
Cloudflare Cron Trigger would be the more "proper" fix, but that's
additional deploy-time configuration for a table whose growth is bounded by
`/auth/*` traffic specifically (already rate-limited, i.e. already
low-volume by construction).

*Reconsider if:* `/auth/*` traffic ever grows enough that an extra DELETE on
every call becomes a measurable cost — a Cron Trigger sweep is the next
step, not a bigger in-request cleanup.

*Verified*: rows from a rate-limit test run the previous day were gone from
the table after the fixed code ran once in a new window — confirmed by
direct query, not inferred from the absence of an error.

---

### 024 — The client-side cache key's get-or-create is also atomic, not read-then-write
**Accepted, fixing a real bug found in a second review pass — the client-side
counterpart to ADR-021.** `secureCache.ts`'s `getOrCreateKey` checked for an
existing `CryptoKey` in a *readonly* IndexedDB transaction, then wrote a
newly generated one in a *separate* readwrite transaction. Two calls racing
between those two transactions (two tabs of the same origin loading at
once, or a future feature reading multiple cache entries in parallel) could
each see no key and each generate and store a different one — the second
write wins silently, and anything already encrypted under the first key
becomes permanently undecryptable (`getCached` just returns `null` for it,
indistinguishable from an empty cache).

Fixed by doing the get and the conditional put inside one IndexedDB
transaction, which the browser serializes against other transactions
touching the same object store — the same "make it one atomic operation,
not two" fix as ADR-021, just enforced by IndexedDB's transaction semantics
instead of a SQL `WHERE ... RETURNING`. The AES-GCM key itself still has to
be generated *before* opening that transaction: `crypto.subtle.generateKey`
is real async work, and awaiting it from inside an open IndexedDB
transaction risks the transaction auto-committing out from under the
subsequent write (a well-known IndexedDB gotcha — transactions survive
microtask gaps but not real async ones).

*Cost:* a losing caller generates a throwaway AES-GCM key it never uses.
Cheap (~1ms, WebCrypto-native) and only ever happens on the very first use
per browser profile, once a key is stored every later call finds it on the
first `get` and returns immediately.

---

### 025 — Test tooling pinned to vitest 3 / `@cloudflare/vitest-pool-workers` 0.12.x, not latest
**Accepted.** `@cloudflare/vitest-pool-workers@0.22.0` (latest at the time
these tests were added) requires `vitest@^4.1.0` and depends on
`miniflare@5.20260815.0-alpha` — an alpha build — and its `0.16`+ line has
also dropped the documented `defineWorkersConfig`/`readD1Migrations` config
API from the `/config` subpath entirely in favor of an undocumented
`cloudflareTest`/`cloudflarePool` plugin API with no bundled README or
examples. `@cloudflare/vitest-pool-workers@0.12.21` is the newest release
still on the documented `/config` API, peer-depending on `vitest` `2.0.x -
3.2.x` — installed as `vitest@^3.2.7`.

*Cost:* both packages will eventually need a coordinated bump (vitest 3→4
and vitest-pool-workers 0.12→0.16+ together) once the newer config API is
documented and out of alpha. Until then, `npm install`ing either package to
"latest" independently breaks the other — don't bump one without the other.

*Also:* `apps/api`'s test files live inside `src/` (so imports like
`./crypto.js` resolve the same way in tests as in the app) but are excluded
from the main `tsconfig.json` used by `npm run check`, because typing
`cloudflare:test`'s `env` correctly needs `@cloudflare/vitest-pool-workers`'s
ambient types (`test/env.d.ts` augments `ProvidedEnv` with the real `Env`
plus a `TEST_MIGRATIONS` binding), which would otherwise leak into
production route type-checking for no benefit. A separate `test/tsconfig.json`
type-checks `src/**/*.test.ts` with those types instead; `check` runs both.
`apps/web`'s tests use plain `vitest` (no Workers runtime needed) with
`fake-indexeddb` polyfilling `indexedDB` for `secureCache.ts` — Node 20+'s
own `globalThis.crypto.subtle` is used as-is, no WebCrypto polyfill needed.

---

### 026 — CI's `npm audit` gate is scoped to `--omit=dev`, dev-tooling audit is report-only
**Accepted.** At the time this was added, `npm audit` on the full tree
reported 10 vulnerabilities (4 moderate, 6 high) — all of them in
`esbuild`, `miniflare`, `undici`, `ws`, and `sharp`, pulled in transitively
by `wrangler` / `@cloudflare/vitest-pool-workers` / `drizzle-kit` (the
esbuild finding is specifically about its local dev server; the rest are
inside miniflare's local Workers-runtime simulator used only by the test
pool from ADR-025). None of them touch a dependency that ships: `npm audit
--omit=dev` on the same tree reports zero. Gating the merge-blocking check
on the full tree would make CI permanently red over dev-only tooling with
no fix available yet — the pin in ADR-025 already means neither `wrangler`
nor `@cloudflare/vitest-pool-workers` can simply be bumped to clear it — and
a check nobody can make pass is worse than no check (same reasoning ADR-007
used for not requesting a permission before there's a feature to use it).

Two steps instead of one: `npm audit --omit=dev --audit-level=high` blocks
the job on anything in the deployed Worker or the built SPA bundle. A
second, plain `npm audit` (npm's `--omit` only accepts `dev`/`optional`/
`peer` — there's no flag for "dev-only", so this covers the full tree
again) runs with `continue-on-error: true`; since the first step already
proves prod is clean, whatever this one reports is exactly the dev-only
tooling findings, surfaced in the CI log for a human to notice without
blocking merges over something unfixable by this repo.

*Reconsider if:* ADR-025's pin is ever lifted (vitest 4 /
`@cloudflare/vitest-pool-workers` 0.16+ once that config API is documented
and out of alpha) — re-run a full audit then, since the newer `wrangler`/
`miniflare` versions may have already picked up fixes for some of these.

---

### 027 — Copilot code review requested via the repo ruleset, not a workflow step
**Accepted, reversing an earlier draft.** GitHub offers two ways to get an
automatic Copilot review on every pull request: a repository ruleset rule
("Automatically request Copilot code review", under Settings → Rules →
Rulesets), or `gh pr edit --add-reviewer @copilot` in a workflow (GitHub
CLI ≥2.88, shipped 2026-03-11). A first pass used the workflow — versioned
alongside the rest of CI — but the ruleset is what GitHub itself treats as
the supported mechanism: it also covers `synchronize` (re-review on every
push) and draft-PR handling as first-class options, and it's where the
review effort level (see below) actually lives — the workflow step could
only request a review with whatever the org/repo default happened to be.

Configured by hand (Settings → Code and automation → Rules → Rulesets →
New branch ruleset → target the branches that receive PRs → enable
"Automatically request Copilot code review"), not by this repo's code —
rulesets need repo-admin credentials no session here carries, and there's
no `create_repository_ruleset`-shaped tool available to script it.

*Cost, accepted:* the ruleset is invisible in a diff — a contributor
reading this repo's source won't see that Copilot review is on, unlike the
workflow file it replaced. `docs/DECISIONS.md` (this entry) is the record
of that setting instead.

*Also:* there's no per-review "which model" knob (GPT-5 vs. Claude, etc.)
— GitHub picks the model internally. The closest available control is the
**review effort level** — Lite (routine changes) vs. Balanced (routes to a
higher-reasoning model for complex, security-sensitive, or cross-service
changes) — settable per-request in the PR's Reviewers section, or as an
org/repo default alongside the ruleset. (Model *choice* does exist for a
different feature — `@copilot` mentioned in a PR *comment*, which invokes
the Copilot coding agent, not code review — and is unrelated to this ADR.)
