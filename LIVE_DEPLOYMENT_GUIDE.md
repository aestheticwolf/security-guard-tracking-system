# Live Deployment Guide

This guide explains exactly how Sentinel Grid was made live using Cloudflare Pages for the frontend and Cloudflare Tunnel for the local backend.

## Current Live Links

Frontend:

```text
https://security-guard-tracking-system.pages.dev
```

Backend tunnel:

```text
https://annually-antarctica-ties-cells.trycloudflare.com
```

Backend health check:

```text
https://annually-antarctica-ties-cells.trycloudflare.com/api/health
```

GitHub repository:

```text
https://github.com/aestheticwolf/security-guard-tracking-system
```

## Hosting Architecture

The app is live with this setup:

```text
React/Vite frontend -> Cloudflare Pages
Express API backend -> Local PC
Public backend access -> Cloudflare Tunnel
Database -> Local SQLite file
Selfie uploads -> Local server/uploads/selfies folder
```

This is a no-card deployment approach. It keeps SQLite and uploaded selfies on the local machine while still giving the frontend a public HTTPS URL.

## Important Rule

The live frontend depends on the local backend. These two commands must stay running on the local machine:

```powershell
npm start
```

```powershell
cloudflared tunnel --url http://127.0.0.1:5000
```

If either command stops, the live frontend may open, but login, dashboard data, selfie upload, and location sync will stop working.

## Step 1: Push Code To GitHub

The project was pushed to:

```text
https://github.com/aestheticwolf/security-guard-tracking-system
```

Typical update flow:

```powershell
git add .
git commit -m "update project"
git push
```

Cloudflare Pages automatically rebuilds the frontend after a push to `main`.

## Step 2: Configure Local Environment

The local `.env` file should contain:

```env
PORT=5000
JWT_SECRET=change-this-to-a-long-secure-secret
DB_FILE=./server/database/security.db
VITE_API_URL=https://annually-antarctica-ties-cells.trycloudflare.com/api
GEOCODER_USER_AGENT=SentinelGrid/1.0
```

For normal local-only testing without tunnel, use:

```env
VITE_API_URL=http://localhost:5000/api
```

For live Cloudflare Pages testing, use the tunnel URL:

```env
VITE_API_URL=https://annually-antarctica-ties-cells.trycloudflare.com/api
```

## Step 3: Keep The Database Safe

The active database is:

```text
A:\0\infipre\security\server\database\security.db
```

The older default temp database was:

```text
C:\Users\richa\AppData\Local\Temp\SentinelGrid\security.db
```

If old data appears missing, copy the old temp database into the active project database:

```powershell
Copy-Item "$env:TEMP\SentinelGrid\security.db" "A:\0\infipre\security\server\database\security.db" -Force
```

Before replacing the active database, make a backup:

```powershell
Copy-Item "A:\0\infipre\security\server\database\security.db" "A:\0\infipre\security\server\database\security-backup.db"
```

Do not run this unless you intentionally want to reset seeded data:

```powershell
npm run db:reset
```

## Step 4: Install Dependencies And Initialize Database

Run:

```powershell
npm install
```

Then:

```powershell
npm run db:init
```

This creates or updates the SQLite schema while keeping existing data intact.

## Step 5: Start Backend

Open a terminal and run:

```powershell
npm start
```

Expected output:

```text
Sentinel Grid API listening on http://localhost:5000
```

Local backend health check:

```text
http://localhost:5000/api/health
```

Expected response:

```json
{"status":"ok","service":"Sentinel Grid API"}
```

## Step 6: Install Cloudflare Tunnel

Install `cloudflared`:

```powershell
winget install --id Cloudflare.cloudflared -e
```

If the short command does not work immediately, refresh the current terminal path:

```powershell
$env:Path += ";C:\Program Files (x86)\cloudflared"
```

Check version:

```powershell
cloudflared --version
```

If needed, use the full path:

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" --version
```

## Step 7: Start Backend Tunnel

Open another terminal and run:

```powershell
cloudflared tunnel --url http://127.0.0.1:5000
```

If the short command fails, use:

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:5000
```

Cloudflare prints a public URL like:

```text
https://annually-antarctica-ties-cells.trycloudflare.com
```

Test it:

```text
https://annually-antarctica-ties-cells.trycloudflare.com/api/health
```

## Step 8: Run Frontend Locally For Testing

Open a third terminal and run:

```powershell
npm run client
```

Open:

```text
http://localhost:5173/auth
```

Test:

- Admin login
- Guard login
- Selfie upload
- Location sync
- Admin dashboard
- Guard history

## Step 9: Build Frontend

Before deploying, verify the production build:

```powershell
npm run build
```

The output folder is:

```text
dist
```

## Step 10: Deploy Frontend To Cloudflare Pages

In Cloudflare:

```text
Workers & Pages -> Create application -> Pages -> Connect to Git
```

Select:

```text
aestheticwolf/security-guard-tracking-system
```

Use these settings:

```text
Project name: security-guard-tracking-system
Production branch: main
Framework preset: React (Vite)
Build command: npm run build
Build output directory: dist
Root directory: leave empty
```

Add environment variables:

```env
VITE_API_URL=https://annually-antarctica-ties-cells.trycloudflare.com/api
NODE_VERSION=22
```

Then click:

```text
Save and Deploy
```

## Step 11: Live Frontend Test

Open:

```text
https://security-guard-tracking-system.pages.dev/auth
```

Test the demo accounts:

```text
admin@sentinel.local
Admin@123
```

```text
guard@sentinel.local
Guard@123
```

## Step 12: Daily Run Checklist

Every time you want the live site to work, run these:

Terminal 1:

```powershell
npm start
```

Terminal 2:

```powershell
cloudflared tunnel --url http://127.0.0.1:5000
```

Optional local frontend terminal:

```powershell
npm run client
```

## Step 13: If The Tunnel URL Changes

Quick tunnels can change after restart. If Cloudflare gives a new URL:

1. Copy the new URL.
2. Go to Cloudflare Pages.
3. Open the project settings.
4. Update:

```env
VITE_API_URL=https://NEW-TUNNEL-URL.trycloudflare.com/api
```

5. Redeploy the frontend.

## Step 14: Data Storage

SQLite data:

```text
server/database/security.db
```

Selfie images:

```text
server/uploads/selfies
```

These are local runtime files. They are not hosted inside Cloudflare Pages.

## Step 15: Common Problems

Backend not reachable:

- Check `npm start` is running.
- Check `http://localhost:5000/api/health`.
- Check tunnel is running.
- Check tunnel health URL.

Login fails on live frontend:

- Check Cloudflare Pages `VITE_API_URL`.
- Confirm the tunnel URL did not change.
- Redeploy after changing environment variables.

Data appears missing:

- Check `.env` `DB_FILE`.
- Open the active SQLite file.
- Restore from the old temp database only if needed.

Cloudflared command not recognized:

```powershell
$env:Path += ";C:\Program Files (x86)\cloudflared"
```

Or run:

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:5000
```

## Production Upgrade Path

This setup is excellent for demos and no-card hosting. For real production, move to:

- Hosted backend server or VPS
- PostgreSQL/MySQL instead of local SQLite
- Cloud object storage for selfies
- Stable Cloudflare named tunnel or real backend domain
- Automated backups
- Production logging and monitoring
