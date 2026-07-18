# DailyCash Backend

Express + Prisma + PostgreSQL + Socket.io. Deployment-ready via Docker Compose.
Implements the architecture in `DailyCash_System_Specification.docx`, plus:

- **Branches** (admin CRUD), with **one branch = one collection route = exactly
  one loan officer**, enforced at the database level (`Branch.loanOfficerId`
  is a unique FK) and re-checked in the API before assignment.
- **Full loan application workflow**: loan officer fills in customer + loan
  details and uploads documents (NIC photo, business photo, signature, etc.)
  → application sits as `pending` → **Admin approves or rejects** → if
  approved, the **loan officer disburses** (separate, deliberate step).
- **Loan officer cash float**: each officer disburses new loans out of cash
  they are physically holding — built up from the installments they collect
  each day — and deposits the surplus to the company bank account (typically
  month-end). The running balance is computed live and exposed to the Loan
  Officer's own dashboard, the Accountant, and the Admin (per branch).

## Quick start (Docker — recommended for deployment)

```bash
cp .env.example .env              # edit JWT_SECRET at minimum
docker compose up -d --build
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run seed
```

API is now live at `http://localhost:4000`. Postgres data and uploaded files
persist in named Docker volumes (`dailycash_db_data`, `dailycash_uploads`)
across restarts. For a real deployment, put this behind a reverse proxy
(Caddy/Nginx) with TLS, and point `CORS_ORIGIN` at your frontend's domain.

## Quick start (local Node, no Docker)

```bash
cp .env.example .env              # point DATABASE_URL at your own Postgres
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev                       # http://localhost:4000
```

Seeded login: phone `0771000001` (admin) through `0771000004` (recovery
officer), password `password123`, with the `tenantId` printed by the seed
script. The seed creates one branch ("Maharagama") with K. Silva as its
sole route officer, an opening cash float, one fully active loan, and one
loan still sitting in the Admin approval queue.

## The loan lifecycle, end to end

```
Loan Officer fills application + uploads documents
        │  POST /api/v1/loans            (status: pending)
        │  POST /api/v1/loans/:id/documents  (repeat per file)
        ▼
Admin reviews the application + documents
        │  PUT /api/v1/loans/:id/approve   → status: approved
        │  PUT /api/v1/loans/:id/reject    → status: rejected (with reason)
        ▼
Loan Officer disburses (only if approved)
        │  PUT /api/v1/loans/:id/disburse
        │    - checks officer's cash-in-hand ≥ principal, else 400
        │    - generates the full installment schedule
        │    - logs a CashMovement(type=disbursement)
        │    - status → active
        ▼
Daily collection via POST /api/v1/payments (type: installment)
  → adds to the officer's cash-in-hand automatically (see below)
        ▼
Month-end: POST /api/v1/cash/deposit
  → officer (or accountant on their behalf) deposits the surplus,
    cash-in-hand balance drops accordingly
```

## Cash float endpoints

- `GET /api/v1/cash/balance/:officerId` — one officer's current balance,
  today's collected vs disbursed, last deposit date. Loan officers can only
  fetch their own; Admin/Accountant can fetch any officer in the tenant.
- `GET /api/v1/cash/balances` — every officer's balance in one call (Admin,
  Accountant) — this is what powers the "cash positions by branch" table.
- `POST /api/v1/cash/float` — Admin issues a starting or top-up float to an
  officer so they have something to disburse loans from.
- `POST /api/v1/cash/deposit` — records a deposit to the company account,
  reducing the officer's cash-in-hand.

Balance formula (see `getOfficerCashBalance` in `src/routes/cash.js`):

```
current = Σ(installment + document_charge + other_charge payments they recorded)
        + Σ(float_in)
        − Σ(disbursement)
        − Σ(deposit_out)
        ± Σ(adjustment)
```

Bank transfers are deliberately excluded — those go straight to the company
account via the Accountant and never touch the officer's physical cash.

## Branches

- `GET /api/v1/branches` — list, with each branch's route officer and
  customer/loan counts.
- `POST /api/v1/branches` / `PUT /api/v1/branches/:id` — Admin only. Assigning
  `loanOfficerId` is validated: the user must be a `loan_officer` in this
  tenant, and must not already own another branch's route.

## Documents

- `POST /api/v1/loans/:id/documents` — multipart upload (`file` field, plus
  a `type` field: `nic_photo` | `business_photo` | `signature` |
  `guarantor_nic` | `other`). Stored on local disk under `/uploads` and
  served statically in dev.
  **For production**, swap the storage engine in `src/lib/upload.js` for
  `multer-s3` (or upload the buffer to your bucket in the route handler) and
  set `STORAGE_DRIVER=s3` — nothing else in the app needs to change, since
  every caller only ever sees the resulting `fileUrl`.
- `GET /api/v1/loans/:id/documents` — list documents for a loan.

## Everything else

Auth, customers (incl. the Customer 360 `/ledger` endpoint), the unified
payments ledger, comments, and the report builder are unchanged from the
previous version — see inline comments in each route file. Realtime
(Socket.io) fan-out now also covers `loan.submitted`, `loan.approved`,
`loan.rejected`, `loan.disbursed`, `cash.float`, and `cash.deposit`, on top
of the existing `payment.created` / `comment.created`.

## Known gap in this build

Prisma's schema validator and client generator need to download a query
engine binary from `binaries.prisma.sh` — that's blocked in the sandbox this
was built in, so `prisma generate` / `prisma validate` couldn't be run here.
Every relation in `schema.prisma` was manually checked (both sides of every
named relation are paired, foreign keys line up), but run `npx prisma
validate` yourself as a first step after cloning — it needs an outbound
connection that a real dev machine or CI runner will have.

## Next steps

- Refresh tokens + PIN-based quick login for field devices
- Offline sync batch endpoint (`POST /payments/sync-batch`) for the PWA's
  IndexedDB queue
- Recovery visit-log endpoints, cash-book day-close, audit log writes on
  every mutation
- Wire the frontend prototype to call this API instead of its mock data
- OpenAPI spec + automated tests
