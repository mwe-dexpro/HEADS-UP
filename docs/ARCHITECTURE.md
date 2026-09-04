# Architecture

## The one idea

A task links to an event, a list, or neither — never more than one — and
every task is created by hand. There is no rule engine deriving tasks from
events (that was the prior "Ladder" build's model; see `docs/DECISIONS.md`
ADR-001). The server is the source of truth; the client's IndexedDB copy is
a cache for offline reads, not a second store to reconcile with.

## Data model

D1 (SQLite), schema in `apps/api/src/db/schema.ts`, managed with Drizzle.

```
users           (id, email, name, ms_account_id, created_at)
refresh_tokens  (id, user_id, token_hash, family_id, expires_at, revoked_at, created_at)
lists           (id, user_id, name, color, created_at, updated_at)
events          (id, user_id, title, start, end, all_day, location, description,
                 recurrence_rule, source, created_at, updated_at)
tasks           (id, user_id, event_id?, list_id?, name, done, done_at, priority,
                 due_at, order, recurrence_rule, created_at, updated_at)
reminders       (id, task_id, kind ['before_due'|'absolute'], minutes_before?, at?)
audit_log       (id, user_id, action, entity_type, entity_id, at)
rate_limit_buckets (key, window_start, count)
```

Wire shapes (what the API actually returns/accepts) live in
`packages/shared/src/entities.ts` and `api.ts`, imported by both `apps/web`
and `apps/api` so client and server can't silently drift. Timestamps are
ISO 8601 strings end to end — SQLite has no native date type either way, and
this matches the wire format exactly with no conversion at the boundary.

### Invariants

1. **A task's `eventId`/`listId` are mutually exclusive.** Enforced in
   `routes/tasks.ts` (`assertLinkOwnership`), not a CHECK constraint — kept
   in one reviewable place alongside the ownership check below rather than
   split across a migration file and the route.
2. **A task can only link to an event or list the same user owns.**
   `assertLinkOwnership` looks up the referenced row scoped by `user_id`
   before allowing the link — otherwise a guessed UUID from another user's
   data would silently attach (an IDOR variant specific to foreign keys,
   distinct from — and in addition to — every route also scoping its own
   row lookups by `user_id`).
3. **Every query derives `user_id` from the verified access token, never
   from client input.** No route accepts a `userId` field in a request body.
4. **Deleting an event or list cascades to its tasks** (`ON DELETE CASCADE`
   in the schema). A task's due-in-advance timeline only makes sense
   relative to the event or list it's for.
5. **Refresh tokens are never stored raw.** Only `HMAC-SHA256(pepper,
   token)`. See `docs/DECISIONS.md` ADR-006.
6. **`packages/shared` types are the only description of the wire format.**
   A route handler and a frontend API call importing different ad hoc shapes
   for the same resource is exactly the drift this package exists to
   prevent — new fields go there first, both sides after.

## Auth flow

```
1. Browser → POST /auth/microsoft/start
   API generates state/nonce/PKCE verifier, stashes them in a short-lived
   httpOnly cookie (Path=/auth), returns the Microsoft authorize URL.
2. Browser → Microsoft (full-page redirect, not a fetch)
3. Microsoft → GET /auth/microsoft/callback?code=...&state=...
   API reads back the stashed cookie, checks state matches, exchanges the
   code (+ PKCE verifier) for an ID token, verifies it (signature via
   Microsoft's JWKS, issuer/audience/nonce), finds-or-creates the user,
   issues a refresh token family, sets the refresh cookie
   (Path=/auth/refresh), and redirects the browser to
   <frontend>/auth/complete#access_token=...&expires_at=...
4. Browser lands on /auth/complete, reads the fragment (never sent to any
   server, never logged), stores the access token in memory, strips the
   fragment from the URL.
5. Every API call after that: Authorization: Bearer <access token>.
6. On a 401, or proactively ~60s before expiry: POST /auth/refresh
   (credentials: include — the browser attaches the Path-scoped cookie
   automatically) → rotates the refresh token, returns a new access token.
7. Sign-out: POST /auth/logout revokes the refresh token's whole family;
   the client drops its in-memory token and wipes the local cache.
```

See `docs/DECISIONS.md` ADR-003/004/006/007/014 for why each piece of this
is shaped the way it is, and `docs/THREAT-MODEL.md` for the STRIDE analysis
this flow is answering.

## Where things live

```
apps/api/src/
  index.ts            Hono app: security headers, CORS, route mounting, error handling
  types.ts            Env bindings (D1, secrets, config) and auth context variables
  db/
    schema.ts          Drizzle schema — the tables above
    client.ts           drizzle(d1, { schema }) factory
  lib/
    jwt.ts               access token sign/verify (ES256, via `jose`)
    microsoft.ts          OAuth authorize URL, token exchange, ID token verification
    oauthTxn.ts            the short-lived state/nonce/PKCE cookie
    refreshTokens.ts        issue/rotate/revoke, family-based reuse detection
    crypto.ts                random tokens, HMAC pepper hashing, PKCE challenge
    rateLimit.ts              the D1-backed fixed-window counter
    audit.ts                   one-line audit_log writer
    ids.ts                      crypto.randomUUID() wrapper
  middleware/
    auth.ts              verifies the bearer token, sets userId/userEmail in context
    cors.ts                origin allow-list, credentials: true
    trustedOrigin.ts        the explicit CSRF Origin check for cookie-authenticated routes
    securityHeaders.ts       HSTS, CSP (default-src 'none' — this is a pure JSON API), etc.
  routes/
    auth.ts, me.ts, events.ts, tasks.ts, lists.ts
    validation.ts          zod schemas for every mutating route's input

apps/web/src/
  auth/
    tokenStore.ts        the in-memory access token + subscriber list
    AuthContext.tsx        silent refresh on load, sign-in/sign-out
    AuthCallback.tsx         reads the /auth/complete fragment
  api/client.ts          fetch wrapper: attaches the bearer token, retries once on 401
  cache/secureCache.ts   the encrypted IndexedDB offline cache
  pages/
    SignIn.tsx, TasksPage.tsx   the one live Phase-1 screen (see docs/ROADMAP.md)

apps/android/            Capacitor project, webDir → ../web/dist
packages/shared/src/     entities.ts, api.ts — the wire format both sides import
```

## Deploying the API (one-time setup)

Cannot be done from an agent session — needs a human with Cloudflare/Entra
account access:

1. `cd apps/api && npx wrangler d1 create heads-up` — paste the returned
   `database_id` into `wrangler.toml`.
2. Register an Entra app (Azure Portal → App registrations): platform
   "Web", redirect URI `https://<worker-url>/auth/microsoft/callback`,
   supported account types "any org directory and personal Microsoft
   accounts". Note the client ID (→ `wrangler.toml` `MS_CLIENT_ID`, not
   secret) and create a client secret (→ Worker secret, below).
3. `npm run keys:generate` (in `apps/api`) — paste the printed private JWK
   into a Worker secret.
4. Set Worker secrets (never in `wrangler.toml` or `.dev.vars` beyond local
   dev):
   ```
   wrangler secret put MS_CLIENT_SECRET
   wrangler secret put JWT_SIGNING_KEY
   wrangler secret put REFRESH_TOKEN_PEPPER   # any 32+ random bytes, base64
   ```
5. Update `wrangler.toml`'s `API_BASE_URL` and `FRONTEND_ORIGINS` to the
   real deployed values, and the repository variable `API_BASE_URL` (used
   by `pages.yml`) to match.
6. Add the repo secret `CLOUDFLARE_API_TOKEN` (Workers Scripts:Edit,
   D1:Edit) so `api-deploy.yml` can deploy.
7. Enable GitHub Pages: Settings → Pages → Source: GitHub Actions (the
   workflow can also self-enable this on a public repo).

After that, pushing to `main` deploys both sides automatically — see
`.github/workflows/pages.yml` and `api-deploy.yml`.
