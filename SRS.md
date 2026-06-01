# Software Requirements Specification

# Sentinel Grid Security Guard Tracking System

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification describes Sentinel Grid, a web-based security guard operations platform. The system helps a software/platform owner manage client organizations, helps organization admins manage guards and duty sites, and helps guards record verified shift attendance with GPS and selfie proof.

### 1.2 Scope

Sentinel Grid includes:

- React/Vite frontend
- Node.js/Express backend
- JWT authentication
- bcrypt password hashing
- SQLite for local development
- MongoDB Atlas for live deployment
- Local upload storage for development selfies
- Cloudinary for live selfie image storage
- Leaflet/OpenStreetMap live map views
- Browser GPS location sync
- Duty site assignment and coverage tracking
- Optional CompreFace face verification

The application supports three roles:

- `Super Admin`: platform owner who manages organizations, organization admins, subscription status, and guard limits.
- `Admin`: organization operator who manages guards, duty sites, attendance, live location, and selfie verification.
- `Guard`: field user who starts and ends shifts with live camera selfie proof and location sync.

Current live deployment:

```text
Frontend: Cloudflare Pages
https://security-guard-tracking-system.pages.dev

Backend: Render Web Service
https://sentinel-grid-api.onrender.com/api

Database: MongoDB Atlas
Image storage: Cloudinary
Optional face matching: CompreFace
```

### 1.3 Intended Users

- Platform owner / super admin
- Organization admin
- Security guards
- Operations supervisors
- Developers maintaining the application

### 1.4 Definitions

- `Organization`: A client workspace using Sentinel Grid.
- `Subscription`: Manual internal tracking of an organization's plan/status.
- `Duty Site`: A physical office, gate, warehouse, post, or client location assigned to guards.
- `Identity Reference`: Registered guard photo or enrollment selfie used for comparison.
- `Selfie Proof`: Live camera image captured during check-in or check-out.
- `CompreFace`: Optional self-hosted face verification service.
- `Live Zone`: Human-readable location derived from GPS coordinates.
- `Location Ping`: Saved GPS sync record.

## 2. Overall Description

### 2.1 Product Perspective

Sentinel Grid is a full-stack web application. The frontend calls the backend API. The backend chooses the storage layer based on environment configuration:

- If `MONGODB_URI` is not set, local SQLite is used.
- If `MONGODB_URI` is set, MongoDB Atlas is used.
- If Cloudinary credentials are not set, selfies are stored locally.
- If Cloudinary credentials are set, selfies are uploaded to Cloudinary.

CompreFace is optional. When configured, the backend compares the guard's live selfie against enrolled reference images and stores a score and identity decision for admin review.

### 2.2 Product Functions

The system provides:

- Secure role-based login
- Super admin organization management
- Manual subscription tracking
- Organization admin management
- Guard account creation and editing
- Guard suspend/reactivate/delete workflows with confirmation
- Duty site creation and assignment
- Live operations overview
- Guard live map and selected guard detail
- Guard check-in and check-out
- Live camera selfie proof for start and end shift
- GPS location sync and history
- Admin-only face verification score
- Today check-in/check-out selfie review
- Older selfie history behind show-more controls
- Mobile responsive guard and admin dashboards
- Light and dark theme support

### 2.3 User Classes

Super admins can:

- Create organizations
- Edit organization details
- Manage organization admins
- Track subscription plan/status
- Track guard limits and organization usage
- Suspend or activate organizations

Admins can:

- Create and edit guards
- Enroll registered photo and enrollment selfie
- Assign guards to duty sites
- Monitor live guard locations
- Review check-in/check-out selfie proof
- View face verification score and status
- View previous selfie history
- Suspend, reactivate, or delete guards
- View duty site coverage

Guards can:

- Log in to the guard dashboard
- Capture live camera selfie for check-in
- Start a shift
- Sync GPS location
- Capture live camera selfie for check-out
- End a shift
- View their current shift state and map

Guards must not see the automatic identity match percentage. That score is admin-only.

### 2.4 Operating Environment

Local frontend:

```text
http://localhost:5173
```

Local backend:

```text
http://localhost:5000/api
```

Live frontend:

```text
https://security-guard-tracking-system.pages.dev
```

Live backend:

```text
https://sentinel-grid-api.onrender.com/api
```

Backend health check:

```text
https://sentinel-grid-api.onrender.com/api/health
```

### 2.5 Design Constraints

- Browser location permission is required for GPS tracking.
- Browser GPS works best while the dashboard tab is open.
- Public registration is disabled.
- Admins create guard users.
- Super admins create organizations and organization admins.
- Render cannot connect to `http://localhost:8000` on the developer laptop.
- Hosted CompreFace access requires a public URL such as a VPS domain or ngrok tunnel.
- ngrok free URLs are temporary and can change.

## 3. Functional Requirements

### 3.1 Authentication And Authorization

- The system shall allow users to log in with email and password.
- The backend shall hash passwords with bcrypt.
- The backend shall issue JWTs after successful login.
- The frontend shall route users based on role.
- Unauthenticated users shall be redirected to login.
- Super admins shall access only the super admin dashboard.
- Organization admins shall manage only their organization data.
- Guards shall not access admin or super admin routes.
- Sign-out shall use a styled confirmation modal, not a browser-native confirmation prompt.

### 3.2 Super Admin Organization Management

- Super admins shall create organizations.
- Super admins shall edit organization details.
- Super admins shall upload and replace organization logos.
- Super admins shall create organization admin credentials.
- Super admins shall view organization admin details.
- Super admins shall upload and replace organization admin profile photos.
- Super admins shall track subscription plan/status manually.
- Super admins shall set guard limits.
- Super admins shall suspend and activate organizations.
- Suspension actions shall show a confirmation/warning.

### 3.3 Admin Guard Management

- Admins shall create guards with name, email, password, phone, shift label, employee code, and duty site.
- Admins shall edit guard details.
- Admins shall optionally update the guard password.
- Admins shall enroll registered photo and enrollment selfie.
- Admins shall view existing enrolled images before replacing them.
- Guard profile avatars shall use enrolled/registered guard images where available.
- Admins shall suspend/reactivate guards with a warning confirmation.
- Admins shall delete guards with a warning confirmation.
- Admins shall search and filter the guard roster.
- Admins shall use a focused guard lookup to find guard profile, duty site, location, status, and latest selfie review quickly.

### 3.4 Duty Sites

- Admins shall create duty sites for organization locations.
- Duty sites shall include name, area/city, address/duty details, optional coordinates, and guard capacity where available.
- Duty site setup shall prefer place search, map tap, or current GPS before manual latitude/longitude entry.
- Manual latitude/longitude shall remain available as a secondary fallback.
- Admins shall assign guards to duty sites.
- Admins shall manage organization-level duty zone labels used by guard shift forms.
- Admins shall be able to use quick-select duty zone suggestions, highlight the selected suggestion, edit existing labels, and save up to five quick labels.
- The admin overview shall show assigned, unassigned, on-duty, and tracked guard counts by duty site.
- Duty site metrics shall use real guard and attendance data, not static values.

### 3.5 Guard Attendance

- Guards shall see a quick Start Shift or End Shift action on the first guard screen.
- Guards shall capture a live camera selfie before check-in.
- Guards shall capture a live camera selfie before check-out.
- Guards shall select a duty zone label from admin-managed options instead of typing unrestricted free text.
- Guards shall confirm duty zone and shift note after selfie capture and before starting or ending shift.
- The system shall prevent duplicate active shifts.
- The system shall prevent check-out when no active shift exists.
- Attendance records shall store check-in time, check-out time, duty label, notes, GPS data, and selfie references.
- Check-in and check-out selfies shall be stored as separate proof records.

### 3.6 Selfie Verification

- Admins shall enroll identity reference images.
- Guards shall capture selfies using live camera, not file upload, during shift verification.
- Desktop shall use the laptop/webcam camera where available.
- Mobile shall support front camera and back camera switching.
- The backend shall store selfie metadata and image URLs.
- If CompreFace is configured, the backend shall request automatic face verification.
- The backend shall store score, status, provider response summary, and review note.
- Admins shall see match score and status.
- Guards shall not see match score or identity percentage.
- Admin selected-guard detail shall show today's check-in and check-out selfies by default.
- Older selfie history shall be available through a show-more action without stretching the main admin layout.

Expected admin statuses:

- `Likely registered guard`
- `Review recommended`
- `Identity mismatch requires review`
- `Retake recommended`
- `Scoring not enabled`
- `Scoring unavailable`

### 3.7 GPS Location Tracking

- The guard dashboard shall request browser location permission.
- The system shall capture latitude, longitude, and accuracy.
- The guard shall be able to manually sync location.
- The app shall request a fresh/current device position when the user taps `My Position`, `Locate Guard`, `Use GPS`, or `Sync now`.
- Active shifts may auto-sync location while the dashboard is open.
- Failed syncs should retry where possible.
- The admin live map shall show latest saved guard locations.
- Selected guard detail shall show exact sync point, live zone, assigned duty site, assigned area, and position freshness.
- Map views shall open with a safe default center or stored/current GPS instead of a blank or invalid coordinate state.

### 3.8 Admin Live Monitoring

- Admin dashboard shall show overview metrics based on live data.
- Guard count shall equal registered active field users.
- On-duty count shall equal active open shifts.
- Attendance coverage shall be calculated from today's checked-in guards versus registered/expected guards and must not exceed 100%.
- Incidents shall use recorded alert/incident events where available.
- Tracked count shall use latest guard location pings.
- Duty site counts shall use actual duty site assignment data.
- The operations map shall show guard markers and selected guard detail.
- Admins shall be able to recenter to their own device position where browser permission is granted.

### 3.9 Responsive UI

- Mobile guard dashboard shall remain usable on phone screens.
- Camera preview height shall be large enough for passport-style selfie framing.
- Admin selected-guard detail shall avoid long blank columns on desktop.
- Admin selfie history shall be compact and responsive.
- Sidebar shall avoid duplicate `Guard History` entries.
- Android and mobile web views shall use role-specific page navigation rather than one long screen where practical.
- Default theme shall be light mode with dark mode available as an option.
- Dashboard copy shall be concise and action-oriented to reduce scanning effort.
- Light and dark themes shall keep text readable.

## 4. External Interface Requirements

### 4.1 User Interface

The system includes:

- Login page
- Super admin dashboard
- Admin dashboard
- Guard dashboard
- Live maps
- Add/edit guard forms
- Duty site management
- Selfie capture controls
- Confirmation dialogs
- Mobile bottom navigation

### 4.2 API Interface

Main API groups:

```text
/api/auth
/api/super-admin
/api/admin
/api/guard
```

Required health endpoint:

```text
GET /api/health
```

Expected response:

```json
{"status":"ok","service":"Sentinel Grid API"}
```

### 4.3 Database Interface

Main data groups:

- Users
- Organizations
- Duty sites
- Attendance
- Locations
- Activities
- Selfies

The backend shall use model/service layers for database operations.

### 4.4 External Services

Cloudflare Pages:

- Hosts the frontend build.
- Requires `VITE_API_URL`.

Render:

- Hosts the Express backend.
- Requires backend environment variables and secrets.

MongoDB Atlas:

- Stores live database records.

Cloudinary:

- Stores live selfie image assets.

CompreFace:

- Optional verification service.
- Must be reachable by the backend.
- For hosted Render backend, this must be a public HTTPS URL.

ngrok:

- Temporary testing tunnel for local CompreFace.
- Not recommended as permanent production infrastructure.

## 5. Environment Requirements

### 5.1 Local `.env`

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

### 5.2 Render Backend Environment

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
COMPREFACE_API_KEY=your-verification-service-api-key
COMPREFACE_VERIFY_THRESHOLD=0.78
COMPREFACE_REVIEW_THRESHOLD=0.65
COMPREFACE_TIMEOUT_MS=8000
COMPREFACE_INLINE_TIMEOUT_MS=2500
COMPREFACE_DET_PROB_THRESHOLD=0.8
```

Render must not use:

```env
COMPREFACE_BASE_URL=http://localhost:8000
```

### 5.3 Cloudflare Pages Environment

```env
NODE_VERSION=22
VITE_API_URL=https://sentinel-grid-api.onrender.com/api
```

Cloudflare Pages must not store backend secrets.

## 6. Non-Functional Requirements

### 6.1 Security

- Secrets shall not be committed to Git.
- Passwords shall be hashed.
- JWTs shall protect private API routes.
- Users shall only access data allowed by their role and organization.
- Admin-only identity scores shall not be visible to guards.
- Error messages shown to users shall avoid leaking internal stack details.

### 6.2 Reliability

- The app shall handle missing location, missing selfie score, and failed geocoding gracefully.
- Render free instance wake-up delay shall not corrupt user sessions.
- Old records captured before matcher configuration may continue showing previous statuses.
- New selfie records after configuration should attempt automatic scoring.

### 6.3 Performance

- Dashboards should avoid unnecessary full page reloads.
- Admin map rendering should avoid excessive redraws.
- Face matching should return quickly when CompreFace is reachable.
- Long selfie history should be collapsed by default.

### 6.4 Usability

- Error messages shall be readable in light and dark mode.
- Mobile controls shall be large enough for touch.
- Admin pages shall avoid long blank space and duplicated navigation.
- Selfie proof cards shall show today's important proof first.

## 7. Key Workflows

### 7.1 Login

1. User opens `/auth`.
2. User enters credentials.
3. Backend validates credentials.
4. Backend returns JWT and role.
5. Frontend redirects to the correct dashboard.

### 7.2 Guard Check-In

1. Guard opens dashboard.
2. Guard uses quick shift action or shift page.
3. Guard captures live camera selfie.
4. Guard confirms duty zone and shift note.
5. Browser captures GPS where available.
6. Guard starts shift.
7. Backend stores attendance, selfie, location, and activity.
8. CompreFace score is requested if configured.
9. Admin can review result.

### 7.3 Guard Check-Out

1. Guard uses quick shift action or shift page.
2. Guard captures check-out selfie.
3. Guard confirms final duty zone and note.
4. Browser captures final GPS where available.
5. Guard ends shift.
6. Backend closes attendance record.
7. Backend stores check-out selfie, location, and activity.
8. Admin can review in/out proof for the day.

### 7.4 Duty Site And Duty Zone Setup

1. Admin opens Add & Sites / Duty Site Management.
2. Admin manages organization duty zone labels.
3. Admin can quick-select, edit, add, remove, and save labels.
4. Admin creates duty sites by searching a place, tapping the map, or using GPS.
5. Manual latitude/longitude remains available only as a fallback.
6. Guards see saved duty zone labels in the shift dropdown.

### 7.5 Admin Selfie Review

1. Admin opens selected guard detail.
2. Latest verification summary is shown.
3. Today's check-in and check-out selfies are shown compactly.
4. Older records remain available through show-more.
5. Admin sees match score, score status, image source, and review guidance.

### 7.6 CompreFace Through ngrok For Testing

1. Docker Desktop runs CompreFace locally.
2. ngrok exposes port `8000`.
3. Render `COMPREFACE_BASE_URL` is set to the ngrok HTTPS URL.
4. Render is redeployed.
5. A new selfie capture triggers backend verification.

## 8. Deployment Requirements

### 8.1 Build

Before pushing code changes:

```powershell
npm run build
```

### 8.2 Cloudflare Pages

```text
Repository: aestheticwolf/security-guard-tracking-system
Production branch: main
Build command: npm run build
Build output: dist
```

Required variable:

```env
VITE_API_URL=https://sentinel-grid-api.onrender.com/api
```

### 8.3 Render

Render shall run the backend web service and contain:

- `JWT_SECRET`
- `MONGODB_URI`
- `MONGODB_DB_NAME`
- Cloudinary variables
- Optional CompreFace variables

After changing Render variables:

1. Save variables.
2. Rebuild and deploy.
3. Confirm `/api/health`.
4. Capture a new selfie for verification testing.

### 8.4 Production Face Verification

For production, CompreFace should run on a stable public host:

```text
https://faces.yourdomain.com
```

Recommended approach:

- VPS
- Docker Compose
- HTTPS reverse proxy
- Stable domain
- Rotated CompreFace API key

ngrok is acceptable for testing only because free URLs can change and depend on the local computer staying online.

## 9. Data Safety

Local runtime data:

```text
server/database/security.db
server/uploads/selfies
```

These files must not be committed to Git.

Live runtime data:

```text
MongoDB Atlas
Cloudinary
```

Before resetting local demo data, create a database backup.

## 10. Acceptance Criteria

The system is acceptable when:

- Super admin can create and manage organizations.
- Admin can create and manage guards.
- Admin can create and assign duty sites.
- Guard can check in with live camera selfie.
- Guard can check out with live camera selfie.
- Guard GPS sync works when permission is granted.
- Admin can see guard location and duty assignment.
- Admin can see today's check-in/check-out selfies.
- Admin can access older selfie history without breaking layout.
- Admin can see face match score when CompreFace is configured.
- Guard cannot see face match score.
- Live frontend reaches Render backend.
- Render backend stores live data in MongoDB Atlas.
- Live selfies are stored in Cloudinary.
- Build completes successfully.

## 11. Future Improvements

- Stable VPS-hosted CompreFace for production.
- Payment gateway integration for subscriptions.
- Native mobile app for background GPS.
- Advanced liveness checks.
- Incident reporting workflow.
- Exportable attendance reports.
- Fine-grained role permissions.
- Audit logs for all admin and super admin actions.

## 12. Source Architecture Reference

This section documents the main source folders, runtime flow, and important files used by Sentinel Grid.

### 12.1 Project Layout

```text
src/
  components/
  context/
  hooks/
  layouts/
  pages/
  services/
  styles/
  utils/

server/
  controllers/
  database/
  middleware/
  models/
  routes/
  services/
  uploads/
```

### 12.2 Frontend Entry Points

`src/main.jsx`

- Mounts the React app.
- Loads global CSS.

`src/App.jsx`

- Defines client routes.
- Protects routes based on authenticated role.

`src/context/AuthContext.jsx`

- Stores logged-in user/session.
- Calls auth service.
- Controls role-aware navigation.

### 12.3 Main Pages

`src/pages/AuthPage.jsx`

- Login screen.
- Demo credential cards.
- Role-aware redirect after login.

`src/pages/SuperAdminDashboard.jsx`

- Super admin platform view.
- Organization management.
- Manual subscription status and plan tracking.
- Organization admin visibility.

`src/pages/AdminDashboard.jsx`

- Organization admin mission control.
- Operations overview.
- Duty site coverage.
- Live map.
- Selected guard detail.
- Add/edit guard.
- Guard roster.
- Duty site management.
- Suspend/reactivate/delete guard actions.

`src/pages/AdminHistoryPage.jsx`

- Admin history view.
- Guard-specific previous data and selfie records.

`src/pages/GuardDashboard.jsx`

- Guard shift hub.
- Live camera selfie capture.
- Check-in and check-out.
- GPS location sync.
- Mobile camera mode switching.
- Guard-side status without exposing face match score.

### 12.4 Admin Components

`src/components/admin/GuardDetailPanel.jsx`

- Selected guard live detail.
- Location and duty site detail.
- Latest selfie verification.
- Today check-in/check-out selfie proof.
- Older selfie history behind show-more controls.
- Admin-only match score display.

`src/components/admin/GuardPositionMap.jsx`

- Operations live map.
- Guard markers.
- Admin/operator position comparison.
- Recenter/my-position controls.

`src/components/admin/GuardHistoryPanel.jsx`

- Previous guard activity and selfie history.

### 12.5 Shared Components

`src/components/SelfieImageFrame.jsx`

- Consistent selfie image display.
- Handles portrait/landscape images.

`src/components/MobileCollapseSection.jsx`

- Mobile-friendly dashboard section collapse behavior.

`src/components/StatusBadge.jsx`

- Shared status styling for shift, identity, duty site, and activity labels.

`src/layouts/AppShell.jsx`

- Shared dashboard layout.
- Sidebar.
- Mobile quick links.
- Theme controls.

### 12.6 Frontend Services

`src/services/apiClient.js`

- Axios client.
- Reads `VITE_API_URL`.
- Adds JWT bearer token.
- Builds image asset URLs.

`src/services/authService.js`

- Login/current-user/logout API calls.

`src/services/adminService.js`

- Admin dashboard and roster API calls.

`src/services/guardService.js`

- Guard dashboard, check-in, check-out, and location sync API calls.

`src/services/superAdminService.js`

- Super admin organization API calls.

### 12.7 Frontend Utilities

`src/utils/cameraCapture.js`

- Camera device selection.
- Front/back camera mode.
- Virtual camera detection.
- Capture constraints.

`src/utils/device.js`

- Browser/device location helpers.
- Fresh GPS behavior and fallback handling.

`src/utils/geo.js`

- Coordinate checks.
- Distance calculations.

`src/utils/format.js`

- Dates, distances, coordinates, relative time, initials, location display.

`src/utils/selfieVerification.js`

- Converts backend identity statuses into admin UI labels, guidance, scores, and tone.

### 12.8 Backend Entry Point

`server/index.js`

- Loads environment.
- Initializes database.
- Registers Express middleware.
- Registers routes.
- Serves uploaded files in local mode.
- Starts the API server.

### 12.9 Backend Routes

`server/routes/auth.js`

- Login, logout, current user.

`server/routes/guard.js`

- Guard overview.
- Check-in.
- Check-out.
- Location sync.
- Selfie verification polling.

`server/routes/admin.js`

- Admin overview.
- Guard create/update/delete.
- Duty site create/update.
- Guard access status.

`server/routes/superAdmin.js`

- Organization and subscription management.

### 12.10 Backend Controllers

`server/controllers/authController.js`

- Auth request handling.

`server/controllers/guardController.js`

- Shift and location workflows.
- Selfie upload/verification flow.

`server/controllers/adminController.js`

- Admin roster, duty site, and guard profile workflows.

`server/controllers/superAdminController.js`

- Super admin organization workflows.

### 12.11 Backend Services

`server/services/selfie.js`

- Selfie upload storage.
- Cloudinary integration.
- Local upload fallback.
- CompreFace verification.
- ngrok skip-warning header for test tunnels.
- Safe matcher diagnostics in logs.

`server/services/adminDashboardService.js`

- Builds admin overview data.
- Computes dashboard metrics.
- Builds duty site coverage.
- Builds selected guard detail data.
- Pairs today's check-in/check-out selfie proof.

`server/services/guardDashboardService.js`

- Builds guard dashboard overview.
- Computes current shift state.
- Builds guard selfie and location status.

`server/services/geocoding.js`

- Reverse geocoding through OpenStreetMap Nominatim.

`server/services/auth.js`

- JWT and user session helpers.

### 12.12 Backend Models

`server/models/userModel.js`

- Users, roles, guard profile fields, identity enrollment fields.

`server/models/attendanceModel.js`

- Shift check-in/check-out records.

`server/models/locationModel.js`

- GPS pings and live location history.

`server/models/activityModel.js`

- Operations feed events.

`server/models/selfieModel.js`

- Selfie metadata, verification score, identity status, and notes.

`server/models/organizationModel.js`

- Super admin organization/client workspace records.

`server/models/dutySiteModel.js`

- Organization duty sites and assigned areas.

### 12.13 Database Layer

`server/database/init.js`

- Creates and migrates schema.
- Seeds demo data.

`server/database/connection.js`

- SQLite connection path handling.

`server/database/mongo.js`

- MongoDB Atlas implementation when `MONGODB_URI` is set.

The backend chooses MongoDB when:

```env
MONGODB_URI=...
```

Otherwise it uses SQLite.

### 12.14 Source Development Rules

- Keep frontend API calls inside `src/services`.
- Keep backend database writes inside models/services/controllers.
- Keep reusable UI inside `src/components`.
- Use Render environment variables for backend secrets.
- Use Cloudflare Pages variables only for frontend build-time values.
- Do not commit `.env`.
- Do not commit uploaded selfies.
- Do not commit local SQLite database files.

## 13. Android APK Requirements

The Android APK shall be built with Capacitor from the same React/Vite codebase.

Admin APK requirements:

- The admin Android view shall show a focused mobile console instead of the full desktop dashboard.
- The admin Android view shall include overview metrics, live map, guard lookup/directory, selected guard detail, latest selfie verification, add guard, duty site management, and account controls.
- The admin Android view shall show identity match score and review status when face scoring is available.
- The admin Android view shall keep long audit sections collapsed or hidden unless needed.

Guard APK requirements:

- The guard Android home shall show the current shift state and quick Start Shift / End Shift action.
- The guard Android view shall support start-shift and end-shift selfie capture.
- The guard Android view shall support GPS sync and live route status.
- The guard Android view shall support front camera selfie and back camera context capture.
- The guard Android view shall use admin-managed duty zone labels.
- The guard Android view shall not show admin-only identity match score.

Super admin APK requirements:

- The super admin Android view shall use separate focused pages for overview, organizations, add organization, admins, and account controls.
- The super admin Android view shall support organization logo and admin profile photo management.

Android platform requirements:

- The APK shall use the live Render API URL for production builds.
- The APK shall request camera and location permissions.
- The APK shall remain usable on common Android phone screen sizes.
- The debug APK shall be generated through `npm run android:apk:debug`.
- The release APK for internal testing shall be generated through `npm run android:apk:release`.

## 14. Document Control

Document:

```text
Software Requirements Specification - Sentinel Grid
```

Related documents:

```text
README.md
LIVE_DEPLOYMENT_GUIDE.md
COMPLETE_SETUP_RUNBOOK.md
```

Status:

```text
Updated for current Cloudflare Pages frontend, Render backend, MongoDB Atlas, Cloudinary, organization branding, admin-managed duty zones, duty site map/search/GPS setup, live camera selfie proof, admin-only face scoring, optional CompreFace deployment, styled confirmations, and Capacitor Android APK support.
```
