# Complete Setup Runbook

This runbook is the end-to-end setup checklist for Sentinel Grid. It covers local development, Docker, Exadel CompreFace, ngrok, Cloudinary, MongoDB Atlas, Render, Cloudflare Pages, and the commands needed to run and verify the system.

Do not paste real secrets into this file. Use placeholders in documentation and real values only in `.env`, Render environment variables, Cloudflare Pages variables, Cloudinary, MongoDB Atlas, ngrok, and CompreFace dashboards.

## 1. Architecture

```text
Local development:
React/Vite frontend -> http://localhost:5173
Express backend -> http://localhost:5000/api
Database -> SQLite
Selfies -> local uploads or Cloudinary
Face matching -> local Docker CompreFace at http://localhost:8000

Live deployment:
React/Vite frontend -> Cloudflare Pages
Express backend -> Render
Database -> MongoDB Atlas
Selfies -> Cloudinary
Face matching -> CompreFace through public HTTPS URL
Temporary public CompreFace URL -> ngrok tunnel to local Docker
```

Current live URLs:

```text
Frontend:
https://security-guard-tracking-system.pages.dev

Backend API:
https://sentinel-grid-api.onrender.com/api

Backend health:
https://sentinel-grid-api.onrender.com/api/health
```

## 2. Required Accounts And Tools

Accounts:

- GitHub
- Render
- Cloudflare
- Cloudinary
- MongoDB Atlas
- ngrok
- Optional VPS provider for production CompreFace

Local tools:

- Node.js 22
- npm
- Git
- Docker Desktop
- ngrok
- Browser with camera and location permission

Check versions:

```powershell
node -v
npm -v
git --version
docker --version
ngrok version
```

Node should be version `22.x`.

## 3. Repository Setup

Clone the repository:

```powershell
git clone https://github.com/aestheticwolf/security-guard-tracking-system.git
cd security-guard-tracking-system
```

Install dependencies:

```powershell
npm install
```

Create the local `.env` file:

```powershell
Copy-Item .env.example .env
```

Initialize local database:

```powershell
npm run db:init
```

Run the app locally:

```powershell
npm run dev
```

Open:

```text
http://localhost:5173
```

Backend health check:

```text
http://localhost:5000/api/health
```

Expected response:

```json
{"status":"ok","service":"Sentinel Grid API"}
```

## 4. Local `.env`

Use this for local development:

```env
PORT=5000
JWT_SECRET=change-this-to-a-long-secure-secret
DB_FILE=./server/database/security.db
VITE_API_URL=http://localhost:5000/api
GEOCODER_USER_AGENT=SentinelGrid/1.0

# Optional local upload fallback. Leave Cloudinary blank to store local uploads.
UPLOAD_DIR=./server/uploads/selfies
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=sentinel-grid/selfies

# Local Docker CompreFace.
COMPREFACE_BASE_URL=http://localhost:8000
COMPREFACE_API_KEY=your-local-compreface-verify-service-key
COMPREFACE_VERIFY_THRESHOLD=0.78
COMPREFACE_REVIEW_THRESHOLD=0.65
COMPREFACE_TIMEOUT_MS=8000
COMPREFACE_INLINE_TIMEOUT_MS=2500
COMPREFACE_DET_PROB_THRESHOLD=0.8
```

Do not commit `.env`.

## 5. Local Commands

Run frontend and backend together:

```powershell
npm run dev
```

Run backend only:

```powershell
npm run server
```

Run frontend only:

```powershell
npm run client
```

Run production backend locally:

```powershell
npm start
```

Build frontend:

```powershell
npm run build
```

Preview frontend build:

```powershell
npm run preview
```

Initialize database:

```powershell
npm run db:init
```

Reset local demo database:

```powershell
npm run db:reset
```

Check backend syntax example:

```powershell
node --check server/services/selfie.js
```

## 6. Docker Desktop Setup

Install Docker Desktop:

```text
https://www.docker.com/products/docker-desktop/
```

After installing:

1. Start Docker Desktop.
2. Wait until the bottom status says Docker engine is running.
3. Confirm Docker works:

```powershell
docker ps
docker compose version
```

If Docker commands fail, restart Docker Desktop.

## 7. Exadel CompreFace Setup

CompreFace is used only for optional face verification. The app still works without it, but admin face-match scores will show as not enabled or unavailable.

### 7.1 Download And Start CompreFace

Download Exadel CompreFace release zip from the official Exadel CompreFace GitHub releases page.

Extract it somewhere outside the app repository, for example:

```text
C:\Users\<your-user>\Downloads\CompreFace_1.2.0
```

Open PowerShell in that folder:

```powershell
cd "$env:USERPROFILE\Downloads\CompreFace_1.2.0"
```

Start CompreFace:

```powershell
docker compose up -d
```

If the package uses the older Compose command:

```powershell
docker-compose up -d
```

Check containers:

```powershell
docker ps
```

Open CompreFace:

```text
http://localhost:8000
```

Expected containers usually include:

- `compreface-fe`
- `compreface-api`
- `compreface-admin`
- `compreface-core`
- `compreface-postgres-db`

Stop CompreFace:

```powershell
docker compose down
```

Start again later:

```powershell
docker compose up -d
```

View logs:

```powershell
docker compose logs -f
```

### 7.2 Create CompreFace App And Verification Service

Open:

```text
http://localhost:8000
```

Steps:

1. Create or log in to your CompreFace user account.
2. Click `Create Application`.
3. Name it `Sentinel Grid`.
4. Open the `Sentinel Grid` application.
5. Click `Create Service`.
6. Choose `Verification`.
7. Name it `Shift Selfie Verification`.
8. Copy the service API key.

Use a `Verification` service key. Do not use a recognition or detection service key for this app.

Add the key locally:

```env
COMPREFACE_API_KEY=your-local-compreface-verify-service-key
```

Restart the backend after changing `.env`:

```powershell
npm run dev
```

## 8. ngrok Setup For Live CompreFace Testing

Render cannot access CompreFace at `http://localhost:8000` on your laptop. For free testing, expose local CompreFace through ngrok.

### 8.1 Install ngrok

Check if installed:

```powershell
ngrok version
```

If not installed, install using one of these:

```powershell
winget install ngrok.ngrok
```

or:

```powershell
choco install ngrok
```

or install from Microsoft Store/ngrok dashboard.

### 8.2 Add ngrok Auth Token

In the ngrok dashboard, copy your auth token command. It looks like:

```powershell
ngrok config add-authtoken <your-ngrok-auth-token>
```

Run it once in PowerShell.

### 8.3 Start Tunnel To CompreFace

Make sure Docker Desktop and CompreFace are running first.

Then run:

```powershell
ngrok http 8000
```

ngrok prints a public forwarding URL:

```text
Forwarding https://example.ngrok-free.dev -> http://localhost:8000
```

Open the forwarding URL in the browser. If ngrok shows a warning page, click `Visit Site` once. You should see the Exadel CompreFace page.

Use this ngrok URL in Render:

```env
COMPREFACE_BASE_URL=https://example.ngrok-free.dev
```

Important:

- Keep Docker Desktop running.
- Keep CompreFace containers running.
- Keep the ngrok terminal open.
- If ngrok restarts, the free URL can change.
- If the URL changes, update Render and redeploy.

## 9. Cloudinary Setup

Cloudinary stores live selfie images so Render does not lose uploads on restart.

Steps:

1. Create or log in to Cloudinary.
2. Open the Cloudinary Console.
3. Go to dashboard/settings where API credentials are shown.
4. Copy:
   - Cloud name
   - API key
   - API secret
5. Use a folder name such as:

```text
sentinel-grid/selfies
```

Render variables:

```env
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
CLOUDINARY_FOLDER=sentinel-grid/selfies
```

Do not place Cloudinary secrets in Cloudflare Pages.

## 10. MongoDB Atlas Setup

MongoDB Atlas stores live app data.

Steps:

1. Create a MongoDB Atlas account.
2. Create a free cluster.
3. Create a database user.
4. Save username and password.
5. Add network access.
6. For initial testing, allow Render to connect by using `0.0.0.0/0`.
7. Copy the connection string.
8. Replace `<password>` with the database user password.
9. Set database name to `sentinel_grid`.

Render variables:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster-url>/sentinel_grid?retryWrites=true&w=majority
MONGODB_DB_NAME=sentinel_grid
```

Do not commit the MongoDB URI.

## 11. Render Backend Setup

Render hosts the Express backend.

### 11.1 Create Web Service

Steps:

1. Open Render dashboard.
2. Click `New`.
3. Choose `Web Service`.
4. Connect GitHub repository:

```text
aestheticwolf/security-guard-tracking-system
```

5. Choose branch:

```text
main
```

6. Set environment:

```text
Node
```

7. Set build command:

```powershell
npm install
```

8. Set start command:

```powershell
npm start
```

9. Save/create the service.

### 11.2 Render Environment Variables

Add these in Render -> `sentinel-grid-api` -> `Environment`.

Required:

```env
JWT_SECRET=<long-random-production-secret>
MONGODB_URI=<mongodb-atlas-uri>
MONGODB_DB_NAME=sentinel_grid
GEOCODER_USER_AGENT=SentinelGrid/1.0
```

Cloudinary:

```env
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
CLOUDINARY_FOLDER=sentinel-grid/selfies
```

CompreFace:

```env
COMPREFACE_BASE_URL=https://example.ngrok-free.dev
COMPREFACE_API_KEY=<compreface-verification-service-key>
COMPREFACE_VERIFY_THRESHOLD=0.78
COMPREFACE_REVIEW_THRESHOLD=0.65
COMPREFACE_TIMEOUT_MS=8000
COMPREFACE_INLINE_TIMEOUT_MS=2500
COMPREFACE_DET_PROB_THRESHOLD=0.8
```

Optional:

```env
PORT=5000
```

Render usually sets its own `PORT`. Keeping `PORT=5000` is optional for this app because the server uses `process.env.PORT || 5000`.

After adding or changing variables:

1. Click `Save, rebuild, and deploy`.
2. Wait for deploy to finish.
3. Open:

```text
https://sentinel-grid-api.onrender.com/api/health
```

Expected:

```json
{"status":"ok","service":"Sentinel Grid API"}
```

### 11.3 Render Logs

Open Render -> service -> `Logs`.

Useful search terms:

```text
CompreFace verification failed
Face scoring
MongoDB
Cloudinary
```

Common CompreFace problems:

- `COMPREFACE_BASE_URL` is still `http://localhost:8000`.
- ngrok is closed.
- Docker Desktop is closed.
- CompreFace containers are stopped.
- API key is from the wrong service type.
- ngrok URL changed.
- Render was not redeployed after env update.

## 12. Cloudflare Pages Frontend Setup

Cloudflare hosts the React/Vite frontend.

Steps:

1. Open Cloudflare dashboard.
2. Go to `Workers & Pages`.
3. Create or open the Pages project:

```text
security-guard-tracking-system
```

4. Connect GitHub repository:

```text
aestheticwolf/security-guard-tracking-system
```

5. Set production branch:

```text
main
```

6. Set build command:

```powershell
npm run build
```

7. Set build output directory:

```text
dist
```

8. Leave root directory empty/default.

### 12.1 Cloudflare Environment Variables

Cloudflare Pages -> Settings -> Variables and Secrets:

```env
NODE_VERSION=22
VITE_API_URL=https://sentinel-grid-api.onrender.com/api
```

Do not add backend secrets to Cloudflare Pages.

Do not add these to Cloudflare:

```text
JWT_SECRET
MONGODB_URI
CLOUDINARY_API_SECRET
COMPREFACE_API_KEY
```

After changing `VITE_API_URL`:

1. Save the variable.
2. Redeploy Cloudflare Pages.
3. Test login again.

## 13. Git And Deployment Flow

Check status:

```powershell
git status
```

Build before pushing:

```powershell
npm run build
```

Add changes:

```powershell
git add .
```

Commit:

```powershell
git commit -m "update setup documentation"
```

Push:

```powershell
git push origin main
```

Deployment after push:

- Cloudflare Pages auto-deploys frontend from `main`.
- Render can auto-deploy backend from `main`.

If auto-deploy is disabled, manually deploy from each dashboard.

## 14. Testing Checklist

### 14.1 Local Test

Start CompreFace:

```powershell
cd "$env:USERPROFILE\Downloads\CompreFace_1.2.0"
docker compose up -d
```

Start app:

```powershell
cd A:\0\infipre\security
npm run dev
```

Open:

```text
http://localhost:5173
```

Test:

- Login as admin.
- Create or edit guard.
- Enroll reference photo/selfie.
- Login as guard.
- Capture check-in selfie.
- Start shift.
- Capture check-out selfie.
- End shift.
- Login as admin.
- Confirm admin sees latest selfie verification.
- Confirm guard does not see match percentage.

### 14.2 Live Test With ngrok

Keep these running:

```powershell
# Terminal 1
cd "$env:USERPROFILE\Downloads\CompreFace_1.2.0"
docker compose up -d
```

```powershell
# Terminal 2
ngrok http 8000
```

Render environment:

```env
COMPREFACE_BASE_URL=https://example.ngrok-free.dev
COMPREFACE_API_KEY=<compreface-verification-service-key>
```

Redeploy Render.

Open backend health:

```text
https://sentinel-grid-api.onrender.com/api/health
```

Open live frontend:

```text
https://security-guard-tracking-system.pages.dev
```

Capture a new guard selfie. Old records may still show previous statuses; always test with a new capture after Render redeploy.

## 15. Troubleshooting

### Cannot Reach Local Backend

Symptoms:

```text
Cannot reach the local backend. Please restart the app server and try again.
```

Check:

```powershell
npm run dev
```

Open:

```text
http://localhost:5000/api/health
```

For live Cloudflare, check:

```env
VITE_API_URL=https://sentinel-grid-api.onrender.com/api
```

Then redeploy Cloudflare.

### Live App Logs In But Face Score Says Not Enabled

Cause:

- Render is missing `COMPREFACE_BASE_URL` or `COMPREFACE_API_KEY`.
- Render was not redeployed after setting variables.
- The record was created before CompreFace was configured.

Fix:

1. Add Render variables.
2. Save, rebuild, and deploy.
3. Capture a new selfie.

### Face Score Says Unavailable

Cause:

- Render tried to call CompreFace but did not get a usable result.

Check:

- Docker Desktop is running.
- CompreFace containers are running.
- ngrok is running.
- Render `COMPREFACE_BASE_URL` uses the current ngrok HTTPS URL.
- CompreFace API key is from a `Verification` service.
- Reference image and live selfie are reachable.

Open Render logs and search:

```text
CompreFace verification failed
```

### Render Still Uses Old ngrok URL

Fix:

1. Copy new ngrok forwarding URL.
2. Render -> Environment.
3. Replace `COMPREFACE_BASE_URL`.
4. Click `Save, rebuild, and deploy`.
5. Capture a new selfie.

### Cloudinary Images Do Not Load

Check Render variables:

```env
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
CLOUDINARY_FOLDER=sentinel-grid/selfies
```

Then:

1. Redeploy Render.
2. Capture a new selfie.
3. Check Cloudinary Media Library.

### GPS Does Not Sync

Check:

- Browser location permission is allowed.
- Phone location is enabled.
- Browser tab is open.
- User clicked `Sync now` if auto sync did not run.
- Site is loaded over HTTPS for live mobile testing.

### Port Already In Use

If backend port `5000` is busy:

```powershell
netstat -ano | findstr :5000
```

Stop the process from Task Manager or change:

```env
PORT=5001
VITE_API_URL=http://localhost:5001/api
```

Restart:

```powershell
npm run dev
```

## 16. Production Notes

For real production:

- Do not rely on ngrok free tunnel.
- Host CompreFace on a VPS or managed public server.
- Use HTTPS domain such as:

```text
https://faces.yourdomain.com
```

- Rotate exposed API keys and secrets.
- Restrict MongoDB Atlas network access where possible.
- Use strong `JWT_SECRET`.
- Keep `.env` out of Git.
- Keep Cloudinary and MongoDB credentials only in Render.

## 17. Secret Safety Checklist

If a secret was shown in a screenshot, terminal, video, or shared chat, rotate it:

- Cloudinary API secret
- MongoDB Atlas password
- CompreFace API key
- ngrok auth token
- JWT secret

After rotating:

1. Update Render variables.
2. Update local `.env` if needed.
3. Redeploy Render.
4. Test the app.

## 18. Quick Command Reference

```powershell
# Install app dependencies
npm install

# Initialize local database
npm run db:init

# Run local app
npm run dev

# Build frontend
npm run build

# Start production backend locally
npm start

# Start CompreFace
cd "$env:USERPROFILE\Downloads\CompreFace_1.2.0"
docker compose up -d

# Stop CompreFace
docker compose down

# View CompreFace logs
docker compose logs -f

# Start ngrok tunnel to CompreFace
ngrok http 8000

# Check git status
git status

# Commit and push
git add .
git commit -m "update setup documentation"
git push origin main
```

## 19. Minimum Live Working Setup

Cloudflare Pages:

```env
NODE_VERSION=22
VITE_API_URL=https://sentinel-grid-api.onrender.com/api
```

Render:

```env
JWT_SECRET=<long-random-production-secret>
MONGODB_URI=<mongodb-atlas-uri>
MONGODB_DB_NAME=sentinel_grid
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
CLOUDINARY_FOLDER=sentinel-grid/selfies
GEOCODER_USER_AGENT=SentinelGrid/1.0
```

Render optional face scoring:

```env
COMPREFACE_BASE_URL=https://example.ngrok-free.dev
COMPREFACE_API_KEY=<compreface-verification-service-key>
COMPREFACE_VERIFY_THRESHOLD=0.78
COMPREFACE_REVIEW_THRESHOLD=0.65
COMPREFACE_TIMEOUT_MS=8000
COMPREFACE_INLINE_TIMEOUT_MS=2500
COMPREFACE_DET_PROB_THRESHOLD=0.8
```

CompreFace/ngrok live test requirements:

```text
Docker Desktop running
CompreFace containers running
ngrok http 8000 running
Render COMPREFACE_BASE_URL set to current ngrok HTTPS URL
Render redeployed after env change
New selfie captured after redeploy
```
