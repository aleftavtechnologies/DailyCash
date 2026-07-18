# DailyCash — Deployment Guide

This covers taking the project from "runs on my machine" to a real server
with a domain and HTTPS. Two paths are given: a single VPS with Docker
(recommended — everything in one place, easiest to reason about for a
business this size), and a split managed-hosting option (less to
administer yourself, costs a bit more).

---

## 0. Before you deploy anywhere

**Do not use the seed script's accounts in production.** `npm run seed`
creates demo users with the password `password123` — that's for local
testing only. Production setup is step 4 below: create one real Admin
account, then have that Admin create every other user through the app.

Generate a real `JWT_SECRET` now — don't reuse the placeholder:
```bash
openssl rand -base64 48
```

---

## Option A — Single VPS with Docker (recommended)

Works well on a $6–12/month box: DigitalOcean Droplet, Hetzner CX22,
AWS Lightsail, or similar. 1 vCPU / 2GB RAM is enough to start.

### 1. Provision the server

- Spin up Ubuntu 22.04 (or later).
- Point your domain's DNS at the server: an `A` record for
  `app.yourcompany.com` → the server's IP. (Two subdomains is also fine —
  `app.yourcompany.com` for the frontend, `api.yourcompany.com` for the
  API — pick one approach and stay consistent with `CORS_ORIGIN` /
  `VITE_API_URL` below.)
- SSH in and install Docker:
  ```bash
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER
  # log out and back in for the group change to apply
  ```

### 2. Get the project onto the server

```bash
# from your own machine, upload the project (or push it to a git remote
# and clone it on the server instead — either works)
scp -r dailycash your-user@your-server-ip:~/dailycash
ssh your-user@your-server-ip
cd dailycash
```

### 3. Configure environment variables for production

```bash
cp .env.example .env
nano .env
```
Set:
```
JWT_SECRET=<the value you generated with openssl above>
CORS_ORIGIN=https://app.yourcompany.com
VITE_API_URL=https://api.yourcompany.com
```
`VITE_API_URL` gets **baked into the frontend at build time** (it's a
static site once built) — if you change it later you must rebuild:
`docker compose build web`.

### 4. Put a reverse proxy in front for HTTPS

The simplest option is **Caddy** — it gets you automatic, auto-renewing
HTTPS certificates with almost no configuration. Install it directly on
the host (outside Docker) so it can bind ports 80/443:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Edit `/etc/caddy/Caddyfile`:
```
app.yourcompany.com {
    reverse_proxy localhost:8080
}

api.yourcompany.com {
    reverse_proxy localhost:4000
}
```
```bash
sudo systemctl restart caddy
```
That's it — Caddy handles the certificate automatically the first time it
receives traffic on that domain. (If you'd rather use Nginx + Certbot,
that works too; Caddy is just less to configure.)

### 5. Bring the stack up

```bash
docker compose up -d --build
docker compose exec api npx prisma migrate deploy
```

### 6. Create your first real Admin (not the demo seed)

Open a shell into the API container and use Prisma's console, or run a
small one-off script. The quickest way:

```bash
docker compose exec api node -e "
const bcrypt = require('bcryptjs');
const prisma = require('./src/lib/prisma');
(async () => {
  const tenant = await prisma.tenant.create({ data: { companyName: 'YOUR COMPANY NAME' } });
  const hash = await bcrypt.hash('CHOOSE-A-REAL-PASSWORD', 10);
  const admin = await prisma.user.create({ data: {
    tenantId: tenant.id, name: 'YOUR NAME', phone: 'YOUR PHONE', role: 'admin', passwordHash: hash,
  }});
  console.log('tenantId:', tenant.id);
  console.log('login phone:', admin.phone);
})().finally(() => prisma.\$disconnect());
"
```
Save the printed `tenantId` — that's what goes in the login screen's
"Company ID" field, along with the phone/password you chose. From there,
log in as Admin and create branches, loan officers, accountants, and
recovery officers through the app itself (Admin → Setup).

### 7. Verify

- `https://app.yourcompany.com` loads the login screen (and offers to
  install as an app on mobile — that's the PWA manifest working).
  `https://api.yourcompany.com/health` returns `{"ok":true}`.
- Log in with the Admin account from step 6.

---

## Option B — Split managed hosting (less to administer)

If you'd rather not manage a server at all:

- **Database**: a managed Postgres — Neon, Supabase, or Railway's Postgres
  add-on all have free/cheap tiers that work fine here.
- **Backend**: Railway or Render — point either at the `backend/` folder,
  set the same environment variables as in `.env.example` (using the
  managed Postgres's connection string for `DATABASE_URL`), and use the
  existing `Dockerfile` — both platforms build from it directly. **Note**:
  uploaded documents live on local disk (`backend/uploads`) — on Railway/
  Render that disk is ephemeral unless you attach a persistent volume, so
  either attach one or switch `src/lib/upload.js` to S3-compatible storage
  before relying on this in production (Cloudflare R2 and Backblaze B2 are
  both cheap S3-compatible options).
- **Frontend**: Vercel or Netlify — point at `frontend/`, build command
  `npm run build`, output directory `dist`, and set `VITE_API_URL` to your
  backend's URL as a build-time environment variable.

This path needs no server maintenance or SSL setup (the platforms handle
both) but costs a little more once you're past free tiers, and you're
coordinating three separate dashboards instead of one `docker compose`.

---

## Ongoing operations

### Deploying an update
```bash
git pull                      # or re-upload the changed files
docker compose up -d --build
docker compose exec api npx prisma migrate deploy   # only if the schema changed
```

### Backups
Automate a daily Postgres dump — cron this on the host:
```bash
docker compose exec -T db pg_dump -U dailycash dailycash | gzip > backup-$(date +%F).sql.gz
```
Keep at least 7–14 days of backups off the server itself (sync to S3/R2 or
download them somewhere else) — a backup that lives only on the same
machine doesn't protect you if that machine is lost.

### Logs
```bash
docker compose logs -f api      # backend
docker compose logs -f web      # frontend (nginx access/error logs)
docker compose logs -f db       # database
```

### Rotating the JWT secret
Changing `JWT_SECRET` immediately logs everyone out (existing tokens stop
validating) — plan that for a quiet moment, not mid-collection-day.

---

## Production checklist

- [ ] Real `JWT_SECRET` generated, not the placeholder
- [ ] `CORS_ORIGIN` set to your actual frontend domain (not `*`)
- [ ] HTTPS working on both the frontend and API domains
- [ ] Demo seed data **not** used — first Admin created manually (step 6)
- [ ] Automated daily database backup, stored off-server
- [ ] Uploaded documents on persistent storage (a real volume, or S3/R2 —
      not ephemeral container disk)
- [ ] `docker compose exec api npx prisma validate` run at least once
      from a machine with normal internet access (this couldn't be
      verified in the sandbox this project was built in — see the root
      README's "Known gaps")
