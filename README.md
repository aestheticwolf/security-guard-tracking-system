# Sentinel Grid

Sentinel Grid is a security guard tracking system for organizations that need shift attendance, live GPS visibility, selfie proof, duty site assignment, and admin monitoring from one web dashboard.

The platform has three roles:

- `Super Admin`: manages organizations, organization admins, subscription status, guard limits, and client workspaces.
- `Admin`: manages one organization, creates guards, assigns duty sites, monitors live operations, reviews selfies, and manages roster access.
- `Guard`: starts and ends shifts with live camera selfie proof and GPS location sync.

## Live Deployment

Frontend:

```text
Cloudflare Pages
https://security-guard-tracking-system.pages.dev
```

Backend:

```text
Render Web Service
https://sentinel-grid-api.onrender.com/api
```

Face matching test tunnel:

```text
Local Docker CompreFace exposed with ngrok
```

For the exact deployment steps, see:

```text
LIVE_DEPLOYMENT_GUIDE.md
```

## Core Features

- Role-based login for super admin, organization admin, and guard users.
- Super admin organization management.
- Manual subscription plan tracking for organizations.
- Admin guard creation and editing.
- Guard suspend, reactivate, and delete workflows with confirmation.
- Duty Sites for office/site allocation such as Panjim, Margao, warehouses, gates, or client posts.
- Admin live operations map with latest guard locations.
- Admin selected-guard detail with GPS, duty site, attendance trail, and selfie review.
- Guard start-shift and end-shift flows with live camera selfie proof.
- Admin-side registered reference photo/enrollment selfie for guards.
- Optional automatic face verification through CompreFace.
- Admin-only face match score and selfie audit history.
- Android APK shell through Capacitor with a focused admin mobile console and guard shift flow.
- Mobile responsive guard and admin dashboards.
- Light/dark theme support.

## Tech Stack

Frontend:

- React
- Vite
- React Router
- Tailwind CSS
- Framer Motion
- Axios
- Leaflet
- OpenStreetMap tiles

Backend:

- Node.js
- Express
- JWT
- bcryptjs
- Multer
- SQLite local mode
- MongoDB Atlas live mode
- Cloudinary live image storage
- Optional CompreFace face verification

Mobile app:

- Capacitor
- Android SDK
- JDK 21 for local APK builds

## Local Setup

Install dependencies:

```bash
npm install
```

Create `.env`:

```powershell
copy .env.example .env
```

Initialize the database:

```bash
npm run db:init
```

Start frontend and backend:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

Local API:

```text
http://localhost:5000/api
```

Health check:

```text
http://localhost:5000/api/health
```

Expected response:

```json
{"status":"ok","service":"Sentinel Grid API"}
```

## Local Environment

Typical local `.env`:

```env
PORT=5000
JWT_SECRET=change-this-to-a-long-secure-secret
DB_FILE=./server/database/security.db
VITE_API_URL=http://localhost:5000/api
GEOCODER_USER_AGENT=SentinelGrid/1.0

COMPREFACE_BASE_URL=http://localhost:8000
COMPREFACE_API_KEY=your-local-verification-service-key
COMPREFACE_VERIFY_THRESHOLD=0.78
COMPREFACE_REVIEW_THRESHOLD=0.65
COMPREFACE_TIMEOUT_MS=8000
COMPREFACE_INLINE_TIMEOUT_MS=2500
COMPREFACE_DET_PROB_THRESHOLD=0.8
```

Do not commit `.env`.

## Production Environment Split

Render backend variables:

```env
JWT_SECRET=long-production-secret
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster-url>/sentinel_grid
MONGODB_DB_NAME=sentinel_grid
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
CLOUDINARY_FOLDER=sentinel-grid/selfies
GEOCODER_USER_AGENT=SentinelGrid/1.0

COMPREFACE_BASE_URL=https://your-public-compreface-url
COMPREFACE_API_KEY=your-verification-service-key
COMPREFACE_VERIFY_THRESHOLD=0.78
COMPREFACE_REVIEW_THRESHOLD=0.65
COMPREFACE_TIMEOUT_MS=8000
COMPREFACE_INLINE_TIMEOUT_MS=2500
COMPREFACE_DET_PROB_THRESHOLD=0.8
```

Cloudflare Pages variables:

```env
NODE_VERSION=22
VITE_API_URL=https://sentinel-grid-api.onrender.com/api
```

Only Render needs CompreFace variables. Cloudflare Pages only needs the frontend API URL.

## CompreFace Modes

Local:

```env
COMPREFACE_BASE_URL=http://localhost:8000
```

Hosted backend with ngrok testing:

```env
COMPREFACE_BASE_URL=https://your-ngrok-domain.ngrok-free.dev
```

Production:

```env
COMPREFACE_BASE_URL=https://faces.yourdomain.com
```

Render cannot use `http://localhost:8000` because that points to the Render container, not your laptop.

For free testing, keep all of these running:

- Docker Desktop
- CompreFace containers
- `ngrok http 8000`
- Render backend with `COMPREFACE_BASE_URL` set to the ngrok HTTPS URL

If ngrok restarts, the free URL can change. Update Render and redeploy.

## Demo Login Accounts

Seeded credentials may exist after database initialization:

```text
Super Admin: super@sentinel.local / Super@123
Admin: admin@sentinel.local / Admin@123
Guard: guard@sentinel.local / Guard@123
```

Production accounts should be created with real credentials and a strong `JWT_SECRET`.

## Data Storage

Local mode:

- SQLite database: `server/database/security.db` when `DB_FILE=./server/database/security.db`
- Selfies: `server/uploads/selfies`

Live mode:

- MongoDB Atlas stores users, organizations, attendance, activities, locations, duty sites, and selfie metadata.
- Cloudinary stores permanent image files.

Uploaded runtime files and database files are ignored by Git.

## Face Verification Behavior

Admins can enroll:

- Registered photo
- Enrollment selfie

Guards capture:

- Check-in live camera selfie
- Check-out live camera selfie

When CompreFace is configured, the backend compares the live guard selfie against enrolled reference images. Admins see the score and decision. Guards do not see the match percentage.

Possible admin statuses:

- `Likely registered guard`
- `Review recommended`
- `Identity mismatch requires review`
- `Retake recommended`
- `Scoring not enabled`
- `Scoring unavailable`

`Scoring unavailable` means the backend attempted automatic matching but CompreFace did not return a usable result. Check Render logs for:

```text
CompreFace verification failed
```

## Useful Commands

Run frontend and backend:

```bash
npm run dev
```

Backend only:

```bash
npm run server
```

Frontend only:

```bash
npm run client
```

Production build:

```bash
npm run build
```

Sync the Android project after frontend changes:

```bash
npm run android:sync
```

Build a local debug APK:

```powershell
$env:JAVA_HOME="C:\Program Files\Java\jdk-21"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
npm run android:apk:debug
```

Debug APK output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Start backend without watch mode:

```bash
npm start
```

Initialize database:

```bash
npm run db:init
```

Reset database:

```bash
npm run db:reset
```

Run ngrok for local CompreFace:

```bash
ngrok http 8000
```

## Troubleshooting

Live login cannot reach backend:

- Check `https://sentinel-grid-api.onrender.com/api/health`.
- Check Cloudflare Pages `VITE_API_URL`.
- Wait for Render deploy to finish.
- Redeploy Cloudflare after changing frontend environment variables.

Face match says `Scoring not enabled`:

- Render does not have `COMPREFACE_BASE_URL` or `COMPREFACE_API_KEY`.
- Render is still using `http://localhost:8000`.
- A new selfie was not captured after redeploy.

Face match says `Scoring unavailable`:

- CompreFace was contacted but failed to return a result.
- Check Render logs for `CompreFace verification failed`.
- Confirm Docker, CompreFace, and ngrok are running.
- Confirm the API key is from a `Verify` service.
- Confirm reference images are reachable from Render.

Location does not sync:

- Allow browser location permission.
- Enable phone/device location.
- Keep the guard dashboard open.
- Use `Sync now` for a manual location update.

Map does not load:

- Check internet access.
- OpenStreetMap tiles are loaded online.

## More Documentation

```text
COMPLETE_SETUP_RUNBOOK.md
LIVE_DEPLOYMENT_GUIDE.md
SRS.md
```
