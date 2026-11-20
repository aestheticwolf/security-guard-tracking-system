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
- Organization logo and admin profile photo management from super admin.
- Manual subscription plan tracking for organizations.
- Admin guard creation and editing.
- Guard suspend, reactivate, and delete workflows with confirmation.
- Duty Sites for office/site allocation such as Panjim, Margao, warehouses, gates, or client posts.
- Admin-managed duty zone labels that guards select from a dropdown during shift verification.
- Duty site creation through place search, map pinning, current GPS, or manual coordinates as a secondary fallback.
- Admin live operations map with latest guard locations.
- Admin selected-guard detail with GPS, duty site, attendance trail, and selfie review.
- Admin guard lookup for fast search, location review, duty site context, and roster actions.
- Guard quick Start Shift / End Shift action on the first screen with selfie, GPS, duty zone, and note confirmation.
- Guard start-shift and end-shift flows with live camera selfie proof.
- Admin-side registered reference photo/enrollment selfie for guards.
- Optional automatic face verification through CompreFace.
- Admin-only face match score and selfie audit history.
- Android APK shell through Capacitor with page-based mobile navigation for super admin, admin, and guard workflows.
- Mobile responsive guard and admin dashboards.
- Styled confirmation modals for sign-out, suspend, delete, and other sensitive actions.
- Light/dark theme support.

## Current Product Snapshot

- Default experience starts in light mode, with dark mode available from account/session controls.
- Super admin manages organizations, subscriptions, admins, organization logos, and admin profile photos.
- Organization logos are shown to both admins and guards in the same workspace.
- Admins manage guards, duty sites, duty zone labels, live map, guard directory, attendance history, and selfie verification.
- Guards use a simplified flow: capture selfie, confirm duty zone and shift note, then start or end shift with current GPS.
- Guards do not see identity match scores; admins see match status, score, reference image, live selfie, and review guidance.
- Android and mobile web use compact page navigation instead of one long dashboard where practical.

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

## Project Structure

Sentinel Grid is partitioned into separate, clean `frontend` and `backend` directories:

```text
security/
│
├── frontend/                     # React + Vite client application
│   ├── src/                      # React source code (components, pages, context)
│   ├── public/                   # Static public assets
│   ├── android/                  # Capacitor Android platform & build
│   ├── index.html                # Single-page application entry HTML
│   ├── vite.config.js            # Vite configuration and backend proxy
│   ├── tailwind.config.js        # Tailwind CSS styling config
│   ├── postcss.config.js         # PostCSS plugins
│   ├── capacitor.config.json     # Mobile app metadata & webDir config
│   ├── package.json              # Frontend-only dependencies and scripts
│   ├── .env                      # Local frontend environment (VITE_API_URL)
│   └── .env.example              # Frontend environment template
│
├── backend/                      # Express API backend
│   ├── server/                   # Server codebase (controllers, models, routes)
│   │   ├── controllers/          # API route controllers
│   │   ├── database/             # SQLite / Mongo connections & initialization
│   │   ├── middleware/           # Auth, error handling, async wrappers
│   │   ├── models/               # Data access models
│   │   ├── routes/               # Express router endpoints
│   │   ├── services/             # Dashboard, geocoding, face-matching services
│   │   └── uploads/              # Local uploaded selfie images
│   ├── package.json              # Backend-only dependencies and scripts
│   ├── .env                      # Backend environment variables
│   └── .env.example              # Backend environment template
│
├── package.json                  # Root orchestration package
├── .gitignore                    # Root ignore rules for frontend and backend
└── README.md                     # Documentation
```

## Local Setup

### 1. Install Dependencies

Install dependencies for frontend and backend (or run at root):

```bash
# In frontend
cd frontend
npm install

# In backend
cd ../backend
npm install
```

### 2. Configure Environment Files

Frontend (`frontend/.env`):
```env
VITE_API_URL=http://localhost:5000/api
```

Backend (`backend/.env`):
```env
PORT=5000
JWT_SECRET=change-this-to-a-long-secure-secret
DB_FILE=./server/database/security.db
UPLOAD_DIR=./server/uploads/selfies
GEOCODER_USER_AGENT=SentinelGrid/1.0
COMPREFACE_BASE_URL=http://localhost:8000
COMPREFACE_API_KEY=your-local-verification-service-key
COMPREFACE_VERIFY_THRESHOLD=0.78
COMPREFACE_REVIEW_THRESHOLD=0.65
COMPREFACE_TIMEOUT_MS=8000
COMPREFACE_INLINE_TIMEOUT_MS=2500
COMPREFACE_DET_PROB_THRESHOLD=0.8
```

### 3. Initialize the Database

```bash
cd backend
npm run db:init
```

### 4. Start Development Servers

Run frontend and backend independently:

**Backend:**
```bash
cd backend
npm run dev
```
Runs at: `http://localhost:5000`

**Frontend:**
```bash
cd frontend
npm run dev
```
Runs at: `http://localhost:5173`

Or run both concurrently from the root directory:
```bash
npm run dev
```

### 5. Access Endpoints

- Frontend UI: `http://localhost:5173`
- Backend API: `http://localhost:5000/api`
- Health check: `http://localhost:5000/api/health`

Expected health check response:
```json
{"status":"ok","service":"Sentinel Grid API"}
```

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

### Root Orchestration

From the root directory:

```bash
# Run both frontend and backend concurrently
npm run dev

# Run frontend only
npm run dev:frontend

# Run backend only
npm run dev:backend

# Production build frontend
npm run build

# Start backend in production mode
npm run start

# Initialize or reset database
npm run db:init
npm run db:reset

# Android sync & build
npm run android:sync
npm run android:apk:debug
npm run android:apk:release
```

### Frontend Commands (`cd frontend`)

```bash
# Start Vite development server (http://localhost:5173)
npm run dev

# Build for production (outputs to frontend/dist)
npm run build

# Preview production build
npm run preview

# Sync web assets to Capacitor Android
npm run android:sync

# Build local debug APK
npm run android:apk:debug

# Build local release APK
npm run android:apk:release
```

### Backend Commands (`cd backend`)

```bash
# Start backend in watch mode (http://localhost:5000)
npm run dev

# Start backend without watch mode
npm run start

# Initialize SQLite schema
npm run db:init

# Reset SQLite schema and re-seed
npm run db:reset
```

### Local CompreFace Tunnel

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

Duty site map opens over water or blank:

- Use `Use GPS` or place search to set a point.
- Latitude/longitude are optional fallback fields and should not be the primary setup path.
- If no coordinates are set, the app uses a safe default center until GPS/search/map tap updates the point.

Live location appears stale:

- Use `My Position`, `Locate Guard`, or `Sync now` to request a fresh device position.
- Keep location permission and device GPS enabled.
- Browser and Android GPS can still return old cached positions if the operating system has not produced a fresh fix yet.

## More Documentation

```text
COMPLETE_SETUP_RUNBOOK.md
LIVE_DEPLOYMENT_GUIDE.md
SRS.md
```
