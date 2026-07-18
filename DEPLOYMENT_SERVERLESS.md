# DailyCash — Serverless Deployment (Vercel + Neon)

For getting a real, public URL in front of remote testers and clients
fast, with nothing to keep running or patch. Three free-tier services,
all sign-up-and-go:

- **Neon** — serverless Postgres (the database)
- **Cloudflare R2** — S3-compatible file storage (uploaded documents)
- **Vercel** — hosts both the API (as serverless functions) and the
  frontend (as a static PWA)

**Trade-off you're accepting**: serverless functions can't hold a
WebSocket open, so realtime updates switch from instant push (Socket.io,
what the Docker deployment uses) to polling every ~7 seconds
(`VITE_REALTIME_MODE=poll`, already built into the frontend — see
`frontend/src/contexts/DataContext.jsx`). For remote testers clicking
around, a 7-second delay before someone else's action shows up is
unlikely to be noticed. If instant push turns out to matter for your
demo, that's what `DEPLOYMENT.md` (the Docker/VPS path) is for instead.

Total time if you're not blocked on anything: 20–30 minutes.

---

## 1. Database — Neon

1. Sign up at [neon.tech](https://neon.tech), create a project.
2. On the project dashboard, copy **two** connection strings:
   - The **pooled** connection string (has `-pooler` in the hostname) →
     this is `DATABASE_URL`.
   - The **direct** connection string (no `-pooler`) → this is
     `DIRECT_URL`. Prisma needs the direct one specifically for running
     migrations; the pooled one is what the app uses at runtime.

Keep both handy for step 4.

## 2. File storage — Cloudflare R2

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) → R2.
2. Create a bucket, e.g. `dailycash-documents`.
3. Bucket Settings → enable **public access** (or set up a custom domain
   for it) and note the public URL base it gives you
   (`https://pub-xxxxxxxx.r2.dev` or your custom domain).
4. R2 → **Manage API tokens** → create a token with read/write access to
   this bucket. Note the **Access Key ID**, **Secret Access Key**, and
   your **Account ID** (the endpoint is
   `https://<account-id>.r2.cloudflarestorage.com`).

## 3. Backend — Vercel

From the `backend/` folder:
```bash
npm install -g vercel      # if you don't have it
cd backend
vercel link                # creates/links a Vercel project, follow the prompts
```

Set environment variables (Vercel dashboard → your project → Settings →
Environment Variables, or via CLI):
```bash
vercel env add DATABASE_URL         # paste Neon's pooled connection string
vercel env add DIRECT_URL           # paste Neon's direct connection string
vercel env add JWT_SECRET           # generate with: openssl rand -base64 48
vercel env add CORS_ORIGIN          # your frontend URL — fill in after step 4, or use * for now to unblock
vercel env add STORAGE_DRIVER       # value: s3
vercel env add S3_BUCKET            # value: dailycash-documents
vercel env add S3_REGION            # value: auto
vercel env add S3_ENDPOINT          # https://<account-id>.r2.cloudflarestorage.com
vercel env add S3_ACCESS_KEY_ID
vercel env add S3_SECRET_ACCESS_KEY
vercel env add S3_PUBLIC_URL_BASE   # https://pub-xxxxxxxx.r2.dev (from step 2)
```

Run migrations against Neon **before** the first deploy (from your own
machine, using the direct URL):
```bash
DATABASE_URL="<neon direct url>" DIRECT_URL="<neon direct url>" npx prisma migrate deploy
```

Deploy:
```bash
vercel --prod
```
Note the URL it gives you (e.g. `https://dailycash-api.vercel.app`) —
that's your `VITE_API_URL` for the next step. Confirm it's alive:
```bash
curl https://dailycash-api.vercel.app/health
# {"ok":true,"storageDriver":"s3"}
```

## 4. Frontend — Vercel

From the `frontend/` folder:
```bash
cd ../frontend
vercel link
vercel env add VITE_API_URL         # the backend URL from step 3
vercel env add VITE_REALTIME_MODE   # value: poll
vercel --prod
```
This gives you a second URL, e.g. `https://dailycash-app.vercel.app` —
**that's the link you send to testers.**

Go back and update the backend's `CORS_ORIGIN` env var to this exact
frontend URL (not `*`) and redeploy the backend (`vercel --prod` again
from `backend/`), so the browser doesn't block requests.

## 5. Create a real first Admin

Same idea as the Docker guide — don't hand testers the seed script's
`password123`. Run this once from your own machine, pointed at Neon:
```bash
cd backend
DATABASE_URL="<neon direct url>" node -e "
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
Send testers the frontend URL plus that `tenantId` + phone + password —
they log in and create their own branches/officers from there (Admin →
Setup), or you create a couple of test accounts for each role yourself
before sharing the link, whichever is easier for the demo you're running.

Alternatively, for the fastest possible "let people click around" demo,
just run `npm run seed` against the Neon direct URL instead — that gives
you the four demo logins from `DEPLOYMENT.md` instantly, with realistic
sample data already in place. Fine for a first look; switch to real
accounts before anyone treats it as more than a demo.

---

## Updating after the first deploy

```bash
cd backend && vercel --prod     # after any backend change
cd frontend && vercel --prod    # after any frontend change
```
If you changed `prisma/schema.prisma`, run
`DATABASE_URL="<neon direct url>" DIRECT_URL="<neon direct url>" npx prisma migrate deploy`
again before redeploying the backend.

## If you outgrow this

Cold starts (a function waking up after being idle) add a second or two
of latency to the first request after a quiet period — a minor
annoyance for a demo, worth knowing about before a live client call.
When you're ready for instant realtime and no cold starts, `DEPLOYMENT.md`
covers the same project running on a small VPS with Socket.io fully
working — nothing in the codebase needs to change to move between them,
just which entry point runs (`src/index.js` there vs `api/index.js`
here) and a couple of environment variables.
