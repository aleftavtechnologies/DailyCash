# DailyCash — Micro-Credit Operations System

A full-stack, deployment-ready system for a daily-collection micro-credit
business in Sri Lanka: role-based dashboards (Admin, Accountant, Loan
Officer, Recovery Officer), branch/route management, a document-backed
loan approval workflow, a daily cash-float ledger per officer, a shared
realtime customer ledger with comments, and a report builder.

```
dailycash/
├── backend/
│   ├── src/           Express routes, Prisma, realtime abstraction
│   ├── src/index.js   Entry point for Docker/VPS (Socket.io, instant push)
│   └── api/index.js   Entry point for Vercel (same Express app, no socket)
├── frontend/   React + Vite PWA that talks to the API for real
├── docker-compose.yml         Docker/VPS: db + api + web in one command
├── DEPLOYMENT.md               Docker/VPS deployment guide
└── DEPLOYMENT_SERVERLESS.md    Vercel + Neon deployment guide (fastest way
                                 to get a public URL in front of testers)
```

**Ways to run this — same codebase, pick based on what you need:**
- **Stage 0 (Railway)** (`DEPLOYMENT_STAGE0.md`) — simplest path if you're
  okay with Railway's usage-based pricing. One platform, no code changes,
  Socket.io realtime just works.
- **Stage 0 (Vercel + GitHub)** (`DEPLOYMENT_VERCEL_STAGE0.md`) — same
  idea, free tier throughout, uses Vercel's own Postgres and Blob storage
  so you don't need a separate Neon/Cloudflare account. Deploys
  automatically on every `git push`. Realtime becomes ~7s polling instead
  of instant (serverless functions can't hold a connection open).
- **Docker/VPS** (`DEPLOYMENT.md`) — a server you control, real Socket.io,
  proper backups. The path for an actual production deployment.
- **Serverless, more control** (`DEPLOYMENT_SERVERLESS.md`) — Vercel +
  Neon + Cloudflare R2 directly (rather than Vercel's own Postgres/Blob),
  for when you want to manage those pieces separately.

All four share every route, every screen, every business rule — only the
entry point (`src/index.js` vs `api/index.js`) and the realtime transport
differ.

## Quick start (Docker — the whole stack in one command)

```bash
cp .env.example .env       # edit JWT_SECRET at minimum
docker compose up -d --build
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run seed
```

- Frontend (installable PWA): **http://localhost:8080**
- API: **http://localhost:4000**

The seed script prints a `tenantId` and four phone numbers
(`0771000001`–`0771000004`, password `password123` for all of them) — use
those on the login screen (Company ID = tenantId, plus phone + password).

## What's real here

- **The frontend calls the actual API.** Every screen — dashboards, loan
  applications with document upload, the approval queue, daily collection,
  recovery, cash deposits/float, reports — reads and writes through
  `frontend/src/api/client.js`. Nothing is mock data anymore.
- **Realtime is real** — Socket.io on the Docker/VPS deployment (instant
  push), or short-interval polling on the serverless deployment (~7s
  delay, no persistent connection available in a serverless function).
  Both are driven by the same `frontend/src/contexts/DataContext.jsx`,
  switched by `VITE_REALTIME_MODE`; the backend side is abstracted behind
  `backend/src/lib/realtime.js` so every route just calls `realtime.emit(...)`
  without caring which mode is active.
- **Cash-float math and loan progress are computed server-side** (see
  `backend/src/routes/loans.js` `withProgress()` and
  `backend/src/routes/reports.js` `dashboard-summary`), not approximated
  from a capped client-side cache — this matters because a dashboard that
  quietly drifts wrong is worse than one that's slow.
- **The PWA is genuinely installable**: `vite-plugin-pwa` generates a real
  manifest and service worker. The app shell is cached for fast loads, but
  API responses are deliberately **not** cached — serving a stale loan
  balance or cash position would be actively harmful in this domain.

## Architecture notes worth knowing

- **One branch = one route = one loan officer** is enforced at the database
  level (`Branch.loanOfficerId` is a unique foreign key), re-checked by the
  API on every assignment, and the UI's officer picker only offers
  officers who don't already own another branch.
- **A loan's `overdue` status is computed, not stored.** The `status`
  column only tracks `pending → approved/rejected → active → completed`.
  Whether an *active* loan displays as "overdue" is calculated from
  `disbursedAt` + the payment ledger, every time it's requested — see
  `displayStatus` / `missedDays` on loan objects and in the dashboard
  summary endpoint. This avoids a cron job that could silently fall behind.
- **The unified payments ledger is one table, one write path.** Every money
  event — installment, bank transfer, document charge, other charge,
  office payment — is a row in `Payment`, and `POST /api/v1/payments`
  checks the caller's role against `ROLE_PAYMENT_TYPES` before allowing it.

## Known gaps (be honest with yourself before calling this "done")

- **Login requires pasting a `tenantId`.** There's no company-slug lookup
  yet (e.g. `dailycash.app/lanka-prosperity`) — fine for one company
  testing internally, not fine for self-serve signup. Add a
  `GET /auth/company?slug=` endpoint and a proper landing/signup flow
  before onboarding multiple companies.
- **No refresh tokens.** The JWT is long-lived (8h) and there's no silent
  renewal — a session simply expires and the user re-logs in.
- **No offline queue yet.** The PWA shell loads offline, but recording a
  collection with no signal will currently fail rather than queue and
  sync later. That was flagged as a next step in the original spec and
  still is — see `backend/README.md`.
- **File storage** is local disk by default (`backend/uploads/`, a Docker
  volume) — fine for the Docker/VPS path. The serverless deployment
  requires `STORAGE_DRIVER=s3` (already implemented, see
  `backend/src/lib/upload.js`) since Vercel functions have no persistent
  disk at all; `DEPLOYMENT_SERVERLESS.md` walks through wiring this up
  with Cloudflare R2.
- **No automated tests.** Everything here was manually reviewed and
  syntax/bundle-checked (see below), not covered by a test suite.
- **Prisma's own validator couldn't be run in the sandbox this was built
  in** (`prisma validate` needs to download an engine binary from a domain
  this environment blocks outbound). Every relation was checked by hand —
  run `npx prisma validate` yourself as the very first step after cloning,
  before anything else.

## Verification actually performed

- Every backend route file passes `node --check` (syntax-valid).
- Every Prisma relation is paired (both sides of every named `@relation`
  exist) — checked programmatically.
- The full frontend was bundled with `esbuild` (real JSX parse + module
  resolution against the actual installed `react`/`recharts`/
  `lucide-react`/`socket.io-client` packages), not just brace-counted.
- What was **not** possible in this sandbox: actually running
  `docker compose up` against live Postgres (no Docker daemon here),
  running `prisma migrate`/`generate` (blocked engine download), or a
  real end-to-end click-through. Please run the quick start above yourself
  as the real test — and if anything doesn't come up cleanly, that's
  useful signal to send back.
