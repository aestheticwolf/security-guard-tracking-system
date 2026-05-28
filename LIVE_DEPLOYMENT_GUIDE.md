# Live Deployment Guide

This guide documents the current Sentinel Grid live setup with Cloudflare Pages, Render, MongoDB Atlas, Cloudinary, and optional CompreFace face matching through a public URL or ngrok tunnel.

## Current Architecture

```text
React/Vite frontend -> Cloudflare Pages
Express backend -> Render Web Service
Database -> MongoDB Atlas
Selfie images -> Cloudinary
Optional face matching -> CompreFace
Temporary CompreFace public access -> ngrok tunnel to local Docker
```

Frontend:

```text
https://security-guard-tracking-system.pages.dev
```

Backend:

```text
https://sentinel-grid-api.onrender.com/api
```

Backend health check:

```text
https://sentinel-grid-api.onrender.com/api/health
```

Expected response:

```json
{"status":"ok","service":"Sentinel Grid API"}
```

## Important Deployment Rule

The frontend and backend are deployed separately.

Cloudflare Pages needs only:

```env
VITE_API_URL=https://sentinel-grid-api.onrender.com/api
NODE_VERSION=22
```

Render needs backend secrets, database values, Cloudinary values, and optional CompreFace values.

Do not put backend secrets in Cloudflare Pages.

## Render Backend Environment

Required:

```env
JWT_SECRET=long-production-secret
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster-url>/sentinel_grid
MONGODB_DB_NAME=sentinel_grid
GEOCODER_USER_AGENT=SentinelGrid/1.0
```

Recommended for permanent selfies:

```env
CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>
CLOUDINARY_FOLDER=sentinel-grid/selfies
```

Optional CompreFace:

```env
COMPREFACE_BASE_URL=https://your-public-compreface-url
COMPREFACE_API_KEY=your-verification-service-api-key
COMPREFACE_VERIFY_THRESHOLD=0.78
COMPREFACE_REVIEW_THRESHOLD=0.65
COMPREFACE_TIMEOUT_MS=8000
COMPREFACE_INLINE_TIMEOUT_MS=2500
COMPREFACE_DET_PROB_THRESHOLD=0.8
```

Render should not use:

```env
COMPREFACE_BASE_URL=http://localhost:8000
```

On Render, `localhost` means the Render container, not your laptop.

## Cloudflare Pages Environment

Production variables:

```env
NODE_VERSION=22
VITE_API_URL=https://sentinel-grid-api.onrender.com/api
```

Build settings:

```text
Framework preset: React (Vite)
Build command: npm run build
Build output directory: dist
Production branch: main
```

After changing `VITE_API_URL`, redeploy Cloudflare Pages.

## Local Development Environment

Use `.env` for local only:

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

Start locally:

```powershell
npm run dev
```

Open:

```text
http://localhost:5173
```

## CompreFace Local Docker Setup

CompreFace runs locally through Docker Desktop at:

```text
http://localhost:8000
```

Inside CompreFace:

1. Create or open the `Sentinel Grid` application.
2. Create a service.
3. Choose `Verification`.
4. Name it `Shift Selfie Verification`.
5. Copy the service API key.

Use the `Verify` service key, not a recognition service key.

## Expose Local CompreFace With ngrok

Install ngrok and add the authtoken:

```powershell
ngrok config add-authtoken <your-ngrok-token>
```

Start the tunnel:

```powershell
ngrok http 8000
```

ngrok prints:

```text
Forwarding https://example.ngrok-free.dev -> http://localhost:8000
```

Use the HTTPS URL in Render:

```env
COMPREFACE_BASE_URL=https://example.ngrok-free.dev
```

Keep these running while testing live face match:

- Docker Desktop
- CompreFace containers
- ngrok terminal

If ngrok restarts, the free URL may change. Update Render and redeploy.

## Render Deploy Flow

After changing Render variables:

1. Click `Save, rebuild, and deploy`.
2. Wait until deploy is live.
3. Open:

```text
https://sentinel-grid-api.onrender.com/api/health
```

4. Capture a new selfie in the live app.
5. Check admin selected-guard detail for face score.

Old selfie records may still show old statuses. Test with a new capture after deploy.

## Git Update Flow

Before pushing:

```powershell
npm run build
```

Commit:

```powershell
git add .
git commit -m "update project"
git push
```

Cloudflare Pages and Render can auto-deploy from `main`.

## Face Match Troubleshooting

`Scoring not enabled`

- `COMPREFACE_BASE_URL` is missing in Render.
- `COMPREFACE_API_KEY` is missing in Render.
- Render is using `http://localhost:8000`.
- The record was captured before CompreFace was configured.

`Scoring unavailable`

- Render attempted CompreFace but did not get a usable result.
- Open Render logs and search:

```text
CompreFace verification failed
```

Common causes:

- Wrong API key.
- API key is not from a `Verify` service.
- Docker CompreFace is stopped.
- ngrok terminal is stopped.
- ngrok URL changed.
- Cloudinary/reference image is not reachable from Render.
- CompreFace returned HTML instead of JSON.

`401` in Render logs:

```text
Wrong COMPREFACE_API_KEY
```

`404` in Render logs:

```text
Wrong COMPREFACE_BASE_URL or service endpoint
```

`fetch failed` in Render logs:

```text
ngrok stopped, Docker stopped, or URL changed
```

## Backend Login Troubleshooting

Live login fails:

1. Open the backend health check:

```text
https://sentinel-grid-api.onrender.com/api/health
```

2. Confirm Cloudflare Pages variable:

```env
VITE_API_URL=https://sentinel-grid-api.onrender.com/api
```

3. Confirm Render deploy finished.
4. Retry after Render free instance wakes up.

## Data Storage

Local:

```text
server/database/security.db
server/uploads/selfies
```

Live:

```text
MongoDB Atlas collections
Cloudinary images
```

Runtime data should not be committed to Git.

## Current Limitations

- ngrok free URLs can change.
- ngrok requires the laptop, Docker, and terminal to stay running.
- Render free services can sleep and wake slowly.
- Browser GPS does not continue reliably after the tab closes.
- CompreFace through ngrok is for testing, not production.

## Production Recommendation

For real production face verification:

```text
Host CompreFace on a VPS with Docker Compose
Use a stable domain such as https://faces.yourdomain.com
Set Render COMPREFACE_BASE_URL to that domain
Rotate the CompreFace API key after public setup
```
