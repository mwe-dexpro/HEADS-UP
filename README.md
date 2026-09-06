# Heads Up

Events and tasks, planned and reminded in advance. You create tasks by hand
and link them to an event or to a to-do list (or leave them standalone);
Heads Up keeps track of what's overdue, what's next, and what's coming, and
helps you plan a run of days at once.

This is a from-scratch rebuild against a new design (see `docs/DECISIONS.md`
ADR-001) — a prior implementation ("Ladder") lives on the `claude/*` branches
in this repo's history for reference, but the two do not share code.

## Structure

```
apps/
  web/       Vite + React + TypeScript + React Router — the installable PWA
  android/   Capacitor project wrapping apps/web's build, for a real Android app
  api/       Cloudflare Worker (Hono) — auth, REST API, D1 database
packages/
  shared/    TypeScript types and API contracts shared by web and api
docs/
  ARCHITECTURE.md   data model, sync model, auth flow, invariants
  THREAT-MODEL.md   STRIDE analysis — living document, one section per phase
  DECISIONS.md      numbered ADRs
  ROADMAP.md        what's built, what's next, ordered by value/risk
```

## Running it

```sh
npm install

npm run dev:api    # wrangler dev, local D1, http://localhost:8787
npm run dev:web    # vite dev, http://localhost:5173
```

Node 20+. See `docs/ARCHITECTURE.md` for the one-time Cloudflare/Microsoft
Entra setup needed before sign-in works, and `apps/api/.env.example` /
`apps/web/.env.example` for the environment variables each app expects.

## Status

Phase 1 (accounts + CRUD API + one live screen, deployed end-to-end). See
`docs/ROADMAP.md` for what's next — the full design's screens, live calendar
sync, and the Android release build.
