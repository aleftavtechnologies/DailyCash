# DailyCash — Stage 0: Simplest Possible Deployment

Goal: a public link you can send a tester, in about 15 minutes, using
**one platform** (Railway), with **no code changes** and **no CLI
gymnastics**. This is the "just get it in front of people" path.

This is not true serverless — Railway runs your app in a small always-on
container, not a function that spins up per-request. That's exactly why
it's simpler: Socket.io (instant realtime updates) just works, file
uploads just work, and you don't need Neon, R2, or any "pooled vs direct
database URL" concepts. If you specifically need true serverless
functions later, `DEPLOYMENT_SERVERLESS.md` covers Vercel — treat that as
the advanced path once this one has done its job.

You'll end up with 3 things on Railway: a database, the backend, and the
frontend, all in one project, all on one dashboard.

---

## 1. Create a Railway account

Go to [railway.app](https://railway.app) → sign up with GitHub (easiest —
also lets you deploy straight from a repo later if you want).

## 2. Create a new project with a database

- **New Project** → **Empty Project**.
- Inside it, click **+ New** → **Database** → **Add PostgreSQL**.
  That's your database done — Railway just gave it a `DATABASE_URL`
  automatically, you don't need to configure anything.

## 3. Deploy the backend

- Click **+ New** → **GitHub Repo** (if your code is on GitHub) or
  **Empty Service** if you'd rather upload via the CLI (`railway up` from
  inside the `backend/` folder — install the CLI first with
  `npm install -g @railway/cli`, then `railway login`).
- If it asks for a **root directory**, set it to `backend`. Railway will
  see the `Dockerfile` there and build from it automatically — same
  Dockerfile the Docker guide uses, nothing to change.
- Open the new service → **Variables** tab → add these one at a time
  (or paste as a block using the "Raw Editor"):
  ```
  JWT_SECRET=<generate one: run `openssl rand -base64 48` locally and paste the result>
  JWT_EXPIRES_IN=8h
  PORT=4000
  CORS_ORIGIN=*
  STORAGE_DRIVER=local
  DATABASE_URL=${{Postgres.DATABASE_URL}}
  DIRECT_URL=${{Postgres.DATABASE_URL}}
  ```
  The `${{Postgres.DATABASE_URL}}` syntax tells Railway "use the database
  I just created" — it fills in the real value automatically, you type it
  exactly like that.
- Still on the backend service → **Settings** → **Volumes** → add a
  volume, mount path `/app/uploads`. (This is what makes uploaded loan
  documents survive a redeploy — without it they'd vanish next time the
  container restarts.)
- **Settings** → **Networking** → **Generate Domain**. Copy this URL —
  it looks like `dailycash-backend-production.up.railway.app`. This is
  your API address.
- Check it worked: open `https://<that-url>/health` in a browser — you
  should see `{"ok":true,"storageDriver":"local"}`.

## 4. Deploy the frontend

- Back in the project, **+ New** → same source as before, but set root
  directory to `frontend` this time.
- **Variables** tab, add:
  ```
  VITE_API_URL=https://<the backend URL from step 3>
  VITE_REALTIME_MODE=socket
  ```
- **Settings** → **Networking** → **Generate Domain**. This one's the
  link you'll actually send people —
  `dailycash-frontend-production.up.railway.app`.

## 5. Tighten CORS

Go back to the **backend** service's Variables and change:
```
CORS_ORIGIN=https://<the frontend URL from step 4>
```
This makes the backend only accept requests from your real frontend
instead of anywhere (`*` was just a placeholder to get step 3 working).
Railway redeploys automatically when you change a variable.

## 6. Put some data in it

Easiest option for a first look — just use the demo seed data. From your
own machine, with the Railway CLI:
```bash
cd backend
railway link                # pick the project you just made
railway run npm run seed
```
This prints a `tenantId` and four ready-made logins (phone
`0771000001`–`0771000004`, password `password123`) — send those to your
tester along with the frontend URL from step 4.

**For an actual client demo** (not just internal poking around), skip the
seed and create one real Admin instead:
```bash
railway run node -e "
const bcrypt = require('bcryptjs');
const prisma = require('./src/lib/prisma');
(async () => {
  const tenant = await prisma.tenant.create({ data: { companyName: 'Test Company' } });
  const hash = await bcrypt.hash('CHOOSE-A-PASSWORD', 10);
  const admin = await prisma.user.create({ data: {
    tenantId: tenant.id, name: 'Your Name', phone: '0771234567', role: 'admin', passwordHash: hash,
  }});
  console.log('tenantId:', tenant.id, '| phone:', admin.phone);
})().finally(() => prisma.\$disconnect());
"
```
Log in as that Admin and create branches/officers through the app itself.

---

## That's it

Send the frontend URL + tenantId + phone + password to whoever's testing.
Realtime works exactly like the Docker version — no 7-second polling
delay, because Railway keeps the backend running continuously rather than
spinning it up per-request.

## When you outgrow this

- **Costs**: Railway's free trial credit runs out; after that it's
  usage-based (roughly $5–10/month for something this size idling most of
  the time). Fine for testing, worth knowing before you forget about it.
- **Need true serverless / pay-nothing-when-idle** → `DEPLOYMENT_SERVERLESS.md`
  (Vercel + Neon), more setup, realtime becomes polling instead of instant.
- **Need a real production deployment on your own infrastructure** →
  `DEPLOYMENT.md` (a VPS you control, Caddy for HTTPS, proper backups).

Same codebase runs all three ways — nothing here is a dead end.
