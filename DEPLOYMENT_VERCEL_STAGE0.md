# DailyCash — Stage 0: Vercel + GitHub

Everything in one place (Vercel dashboard), your database and file storage
both provided by Vercel itself (no separate Neon or Cloudflare account),
deploys automatically every time you push to GitHub. About 20 minutes,
mostly clicking in a browser.

**The one trade-off**: Vercel runs your backend as serverless functions,
not an always-on server, so realtime updates poll every ~7 seconds
instead of pushing instantly. Nobody testing the app will notice a
7-second delay.

---

## 1. Get the code onto GitHub

If it isn't already:
```bash
cd dailycash
git init
git add .
git commit -m "Initial commit"
```
Go to [github.com/new](https://github.com/new), create a repository
(public or private, either is fine), then follow the "push an existing
repository" instructions it shows you — something like:
```bash
git remote add origin https://github.com/<your-username>/dailycash.git
git branch -M main
git push -u origin main
```

## 2. Create a Vercel account

Go to [vercel.com](https://vercel.com) → **Sign Up** → choose **Continue
with GitHub**. This also lets Vercel see your repositories in step 3.

## 3. Import the backend

- Vercel dashboard → **Add New** → **Project**.
- Find your `dailycash` repo → **Import**.
- It'll ask for a **Root Directory** — click **Edit** and set it to
  `backend`.
- Under **Build and Output Settings**, leave everything on its defaults
  (the `vercel.json` file already in the `backend` folder tells Vercel
  what to do).
- **Don't click Deploy yet** — first add the database in step 4, so the
  environment variables exist before the first build runs.

## 4. Add a database (Vercel Postgres)

- Still in this project → **Storage** tab → **Create Database** →
  **Postgres** → follow the prompts (it's powered by Neon, but you never
  need to leave the Vercel dashboard).
- Once created, click **Connect** to attach it to your backend project.
  This automatically adds several environment variables to your project
  — you'll see them under **Settings → Environment Variables**, named
  things like `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, and
  `POSTGRES_URL_NON_POOLING`.
- The app expects two specific variable names, so add these two more
  (Settings → Environment Variables → Add New), **copying the values**
  from the ones Vercel just created:
  - `DATABASE_URL` = same value as `POSTGRES_PRISMA_URL`
  - `DIRECT_URL` = same value as `POSTGRES_URL_NON_POOLING`

## 5. Add file storage (Vercel Blob)

- Same **Storage** tab → **Create Database** → **Blob** → create it →
  **Connect** to this project.
- This automatically adds a `BLOB_READ_WRITE_TOKEN` variable — nothing
  else to do here.

## 6. Add the remaining environment variables

Settings → Environment Variables → add each of these:
```
JWT_SECRET=<run `openssl rand -base64 48` in a terminal and paste the result>
JWT_EXPIRES_IN=8h
CORS_ORIGIN=*
STORAGE_DRIVER=vercel-blob
```
(`CORS_ORIGIN=*` is a placeholder — you'll lock it down in step 9 once
the frontend exists.)

## 7. Deploy the backend

Go to the **Deployments** tab → your project should already be building
(or click **Deploy** if it's waiting). Wait for it to finish, then open
the URL it gives you, e.g. `https://dailycash-backend.vercel.app`, and
add `/health` to the end. You should see:
```json
{"ok":true,"storageDriver":"vercel-blob"}
```
If you see that, the backend is live. Copy this base URL — you need it
next.

## 8. Run the database migration (one-time, one command)

The database exists but is still empty — it needs its tables created.
From your own computer:
```bash
cd backend
npm install
DATABASE_URL="<paste the POSTGRES_URL_NON_POOLING value from step 4>" \
DIRECT_URL="<paste the same value again>" \
npx prisma migrate deploy
```
This is the one genuinely technical step in this guide — it just needs
Node installed and the direct (non-pooled) connection string from step 4.
You only do this once (and again later only if the database schema
changes).

## 9. Import the frontend

- Vercel dashboard → **Add New** → **Project** → same `dailycash` repo
  again → **Import**.
- Root Directory → set to `frontend`.
- Before deploying, add environment variables:
  ```
  VITE_API_URL=<the backend URL from step 7>
  VITE_REALTIME_MODE=poll
  ```
- Click **Deploy**. When it finishes, you'll get a second URL — this one
  is the actual link you send to testers.

## 10. Lock the backend down to your real frontend

Go back to the **backend** project → Settings → Environment Variables →
edit `CORS_ORIGIN` to the frontend URL from step 9 instead of `*`. Then
go to Deployments → click the **⋯** menu on the latest deployment →
**Redeploy** (changing an environment variable doesn't redeploy
automatically).

## 11. Create your first company + Admin login

No terminal needed for this part — the app has a one-time setup endpoint
built for exactly this. Run this once (replace the values, and use the
backend URL from step 7):
```bash
curl -X POST https://<your-backend-url>/api/v1/setup/init-tenant \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Test Company","adminName":"Your Name","adminPhone":"0771234567","adminPassword":"choose-a-real-password"}'
```
It replies with a `tenantId` — save it. This endpoint automatically
refuses to run a second time once a company exists, so it's safe to leave
in place.

## 12. Log in

Open the frontend URL from step 9. Enter the `tenantId` from step 11, the
phone number and password you chose — you're in as Admin. Create
branches and staff from Admin → Setup, or send this same link + a staff
login you create to your testers.

---

## Updating after the first deploy

Just `git push` — both Vercel projects rebuild and redeploy automatically
on every push to `main`. If you changed `prisma/schema.prisma`, repeat
step 8 (the migration command) once after pushing.

## If something doesn't come up clean

Vercel's dashboard → your project → **Deployments** → click the failing
deployment → **Build Logs** shows exactly what broke. The most common
snags: a typo in one of the environment variable names (they're
case-sensitive and must match exactly), or forgetting the redeploy in
step 10 after changing `CORS_ORIGIN`. Send me what the logs say and I'll
help you sort it out.
