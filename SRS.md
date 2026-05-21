# Software Requirements Specification

# Sentinel Grid Security Guard Tracking System

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification describes the requirements for Sentinel Grid, a web-based Security Guard Tracking System. The system helps security teams manage guard accounts, track guard attendance, verify guards with selfie proof, monitor location updates, and provide admins with a live operations dashboard.

This document explains what the system does, who uses it, how the major features work, and what technical rules the application follows.

### 1.2 Scope

Sentinel Grid is a local-first web application with:

- React frontend
- Node.js and Express backend
- SQLite local database
- JWT authentication
- bcryptjs password hashing
- Local selfie image storage
- Browser GPS location tracking
- Leaflet and OpenStreetMap maps

The system has two main roles:

- Admin
- Guard

Admins manage guards and monitor operations. Guards use the system to start shifts, end shifts, upload selfie proof, and sync location.

### 1.3 Intended Users

- Security admins
- Field guards
- Local operations teams
- Developers maintaining the project
- Reviewers evaluating the system design

### 1.4 Definitions

- Admin: A user who manages guards and monitors all operations.
- Guard: A field user who checks in, checks out, and syncs location.
- JWT: JSON Web Token used for authenticated sessions.
- SQLite: Local file-based database.
- GPS: Device/browser geolocation data.
- Selfie proof: Image captured by the guard during check-in.
- Live zone: Human-readable location name generated from GPS coordinates.
- Duty label: Manual label entered by guard, such as `North Perimeter`.

## 2. Overall Description

### 2.1 Product Perspective

Sentinel Grid is a full-stack web application. The frontend communicates with the backend API. The backend stores and reads data from SQLite. Selfie image files are stored in the local filesystem.

The application is intended to run locally during development, but it is structured in a way that could later be upgraded for production with a stronger database, hosting, and mobile support.

### 2.2 Product Functions

The system provides:

- Secure login
- Role-based dashboards
- Admin guard account creation
- Guard attendance check-in/check-out
- Selfie upload and verification record
- GPS location sync
- Location map display
- Admin live operations feed
- Admin guard roster management
- Admin selected guard detail view
- Mobile responsive UI
- Light mode and dark mode

### 2.3 User Classes

Admin users can:

- Log in
- View overview metrics
- Create guard accounts
- View live operations feed
- View guard locations on a map
- View selected guard details
- Search guard roster
- Suspend/reactivate guards
- Delete guard accounts

Guard users can:

- Log in
- View shift state
- Upload selfie proof
- Start shift
- End shift
- Sync location manually
- Allow automatic shift location sync
- View live route map
- View recent shift events

### 2.4 Operating Environment

Frontend:

- Runs in a modern web browser
- Uses Vite development server on `http://localhost:5173`

Backend:

- Runs on Node.js
- Express API runs on `http://localhost:5000/api`

Database:

- SQLite local database file
- Default path:

```text
C:\Users\<user>\AppData\Local\Temp\SentinelGrid\security.db
```

### 2.5 Design Constraints

- The application uses local SQLite storage.
- Selfie images are stored locally, not inside the database.
- Browser location permission is required for GPS tracking.
- Location tracking works while the dashboard is open.
- Background tracking after browser close is not guaranteed.
- Public registration is disabled.
- Only admins can create guard accounts.

### 2.6 Assumptions

- Users have a modern browser.
- The backend server is running locally.
- The frontend can reach the backend API.
- Location permission is granted for tracking features.
- Internet access is available for map tiles and reverse geocoding.

## 3. System Features And Requirements

## 3.1 Authentication

### Description

The system must provide secure login for admin and guard users.

### Functional Requirements

- FR-1: The system shall allow users to log in with email and password.
- FR-2: The backend shall validate the user email and password.
- FR-3: Passwords shall be stored using bcryptjs hashing.
- FR-4: The backend shall issue a JWT after successful login.
- FR-5: The frontend shall store the authenticated session locally.
- FR-6: The system shall prevent inactive users from logging in.
- FR-7: The system shall prevent public account registration.
- FR-8: The system shall redirect admins to the admin dashboard.
- FR-9: The system shall redirect guards to the guard dashboard.
- FR-10: The system shall show readable validation messages on login failure.

### Non-Functional Requirements

- NFR-1: Login errors should not expose internal server details.
- NFR-2: JWT secrets must be configurable through environment variables.
- NFR-3: Sessions should expire based on the configured token lifetime.

## 3.2 Role-Based Access Control

### Description

The system must show different dashboards based on user role.

### Functional Requirements

- FR-11: Admin users shall access the admin dashboard.
- FR-12: Guard users shall access the guard dashboard.
- FR-13: Guard users shall not access admin-only routes.
- FR-14: Unauthenticated users shall be redirected to the login page.

## 3.3 Admin Guard Management

### Description

Admins can create and manage guard accounts.

### Functional Requirements

- FR-15: Admins shall create guard accounts from the admin dashboard.
- FR-16: Guard account creation shall require full name, email, and password.
- FR-17: The backend shall hash the guard password before storage.
- FR-18: Admins shall search the guard roster.
- FR-19: Admins shall suspend active guards.
- FR-20: Admins shall reactivate suspended guards.
- FR-21: Admins shall delete guard accounts.
- FR-22: The system shall show a confirmation dialog before deleting a guard.
- FR-23: Deleting a guard shall remove related database records through cascading deletes.
- FR-24: Deleting a guard shall remove stored selfie files for that guard.

## 3.4 Guard Attendance

### Description

Guards can start and end shifts.

### Functional Requirements

- FR-25: The guard shall upload a selfie before starting a shift.
- FR-26: The system shall require a selfie for check-in.
- FR-27: The system shall store check-in time.
- FR-28: The system shall store check-out time.
- FR-29: The system shall prevent duplicate active check-ins.
- FR-30: The system shall prevent check-out if no active shift exists.
- FR-31: The system shall store attendance notes when provided.
- FR-32: The system shall store duty label/location label when provided.
- FR-33: The system shall create activity feed entries for check-in and check-out.

## 3.5 Selfie Verification

### Description

The guard uploads selfie proof during check-in.

### Functional Requirements

- FR-34: The system shall accept selfie image upload during check-in.
- FR-35: The backend shall store selfie files locally.
- FR-36: The database shall store the selfie file path.
- FR-37: The database shall link selfie records to attendance records.
- FR-38: The dashboard shall show the latest selfie verification snapshot.

### Constraints

- The current selfie verification is a local proof record and score placeholder.
- Strong biometric identity verification is not implemented.

## 3.6 GPS Location Tracking

### Description

The system tracks guard location using browser geolocation.

### Functional Requirements

- FR-39: The guard dashboard shall request browser location permission.
- FR-40: The system shall capture latitude and longitude.
- FR-41: The system shall capture device-reported accuracy when available.
- FR-42: The system shall capture battery value when available.
- FR-43: Guards shall manually sync location using `Sync now`.
- FR-44: Active shifts shall auto-sync location every 10 minutes.
- FR-45: Movement changes may trigger a new location sync.
- FR-46: Failed location syncs shall be queued locally when possible.
- FR-47: Queued location syncs shall retry automatically.
- FR-48: The backend shall store each synced location in SQLite.
- FR-49: Admin dashboard shall show latest synced guard location.

### Limitations

- Browser tracking works best while the page is open.
- Browser tracking may stop when the tab is closed or the device sleeps.
- GPS accuracy depends on the device and environment.

## 3.7 Maps And Live Zone

### Description

The system displays guard locations on maps and converts GPS coordinates into readable zones when possible.

### Functional Requirements

- FR-50: The system shall display maps using Leaflet.
- FR-51: The system shall use OpenStreetMap tiles.
- FR-52: The guard dashboard shall show the guard's current location pin.
- FR-53: The guard dashboard shall show an accuracy radius.
- FR-54: The admin dashboard shall show guard markers on an operations map.
- FR-55: The map shall include a recenter button.
- FR-56: The backend shall reverse-geocode coordinates into live zone text when possible.
- FR-57: If reverse geocoding fails, the system shall fall back to the manual duty label.

## 3.8 Admin Live Monitoring

### Description

The admin dashboard gives a command-center view of operations.

### Functional Requirements

- FR-58: Admin dashboard shall show overview metrics.
- FR-59: Admin dashboard shall show live operations feed.
- FR-60: Admin dashboard shall show latest location pings.
- FR-61: Admin dashboard shall show selected guard detail.
- FR-62: Admin dashboard shall show recent attendance trail.
- FR-63: Admin dashboard shall show latest selfie proof when available.
- FR-64: Admin dashboard shall refresh data automatically.
- FR-65: Admin dashboard shall show only a compact number of feed items first, with an option to show more.

## 3.9 Mobile UI

### Description

The system must be usable on mobile devices.

### Functional Requirements

- FR-66: Login page shall show the login form first on mobile.
- FR-67: Admin dashboard sections shall be collapsible on mobile.
- FR-68: Guard dashboard sections shall be collapsible on mobile.
- FR-69: Mobile view shall include quick section navigation.
- FR-70: Mobile view shall include compact cards and form spacing.
- FR-71: Mobile maps shall remain usable on smaller screens.

## 3.10 Theme Support

### Description

The application supports light and dark mode.

### Functional Requirements

- FR-72: The user shall switch between light mode and dark mode.
- FR-73: The selected theme shall apply across admin and guard screens.
- FR-74: Buttons, cards, maps, forms, and error states shall remain readable in both themes.

## 4. External Interface Requirements

## 4.1 User Interface

The system includes:

- Landing page
- Login page
- Guard dashboard
- Admin dashboard
- Map views
- Add Guard form
- Delete confirmation dialog
- Mobile navigation dock
- Mobile section shortcut rail

The UI should be modern, professional, compact on mobile, and readable in light and dark mode.

## 4.2 API Interface

Main API groups:

Authentication:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

Guard:

- `GET /api/guard/overview`
- `GET /api/guard/activities`
- `POST /api/guard/check-in`
- `POST /api/guard/check-out`
- `POST /api/guard/location`

Admin:

- `GET /api/admin/overview`
- `GET /api/admin/guards`
- `GET /api/admin/live-feed`
- `POST /api/admin/guards`
- `PATCH /api/admin/guards/:id`
- `DELETE /api/admin/guards/:id`

## 4.3 Database Interface

The backend accesses SQLite through model files.

Main model files:

- `server/models/userModel.js`
- `server/models/attendanceModel.js`
- `server/models/activityModel.js`
- `server/models/locationModel.js`
- `server/models/selfieModel.js`

Database initialization is handled by:

- `server/database/init.js`
- `server/database/connection.js`

## 4.4 Hardware And Device Interface

The application uses:

- Browser geolocation
- Camera/file input for selfie upload
- Optional battery information if available through the browser/device

## 5. Data Requirements

## 5.1 Users

The system shall store:

- user ID
- full name
- email
- hashed password
- role
- phone
- employee code
- shift label
- account status
- session version
- last login time
- last seen time
- created time

## 5.2 Attendance

The system shall store:

- attendance ID
- guard ID
- check-in time
- check-out time
- attendance status
- selfie path
- location label
- latitude
- longitude
- accuracy
- note

## 5.3 Locations

The system shall store:

- location ID
- guard ID
- latitude
- longitude
- accuracy
- address
- zone detail
- duty label
- battery
- tracked time

## 5.4 Activities

The system shall store:

- activity ID
- guard/admin ID
- type
- title
- description
- priority
- status
- created time
- updated time

## 5.5 Selfies

The system shall store:

- selfie ID
- guard ID
- attendance ID
- image path
- verification status
- verification score
- captured time

## 6. Non-Functional Requirements

## 6.1 Security

- NFR-4: Passwords shall be hashed using `bcryptjs`.
- NFR-5: JWT shall protect private API routes.
- NFR-6: Users shall only access pages allowed by their role.
- NFR-7: `.env` shall not be committed to Git.
- NFR-8: Uploaded selfie files shall not be committed to Git.
- NFR-9: Internal server errors shall not expose technical stack details to users.

## 6.2 Performance

- NFR-10: Dashboard pages should load quickly after authentication.
- NFR-11: Admin dashboard should refresh automatically without full page reload.
- NFR-12: Location sync should avoid duplicate unnecessary writes when possible.
- NFR-13: Maps should not fully rebuild on every admin refresh.

## 6.3 Usability

- NFR-14: The login form should be easy to use on mobile.
- NFR-15: Dashboard cards should be compact and readable.
- NFR-16: Mobile users should be able to collapse sections.
- NFR-17: Error messages should be clear and human-readable.
- NFR-18: Map location accuracy should be visually communicated with a radius.

## 6.4 Reliability

- NFR-19: Failed location syncs should be retried when possible.
- NFR-20: The app should not lose the latest guard location silently.
- NFR-21: The database should initialize automatically when the server starts.
- NFR-22: The app should handle missing geocoding data gracefully.

## 6.5 Maintainability

- NFR-23: Frontend API calls should go through service files.
- NFR-24: Backend SQL should stay inside model files.
- NFR-25: Request handling should stay inside controllers.
- NFR-26: Reusable UI should stay inside `src/components`.
- NFR-27: Environment-specific values should stay in `.env`.

## 7. System Workflows

## 7.1 Login Workflow

1. User opens `/auth`.
2. User enters email and password.
3. Frontend validates required fields.
4. Frontend sends login request.
5. Backend checks user and password hash.
6. Backend returns JWT.
7. Frontend stores session.
8. User is redirected based on role.

## 7.2 Guard Check-In Workflow

1. Guard opens dashboard.
2. Guard adds duty label if needed.
3. Guard selects selfie.
4. Browser captures or prepares location.
5. Guard clicks `Start Shift`.
6. Backend creates attendance record.
7. Backend saves selfie record.
8. Backend saves location record if coordinates exist.
9. Backend creates activity feed record.
10. Dashboard updates.

## 7.3 Guard Location Sync Workflow

1. Guard clicks `Sync now` or auto-sync triggers.
2. Browser gets current location.
3. Frontend sends location to backend.
4. Backend reverse-geocodes the coordinates.
5. Backend inserts a `locations` row.
6. Admin dashboard refreshes and shows the new position.

## 7.4 Guard Check-Out Workflow

1. Guard clicks `End Shift`.
2. Backend finds the open attendance record.
3. Backend updates check-out time and status.
4. Backend stores final location if available.
5. Backend creates activity feed record.
6. Dashboard updates.

## 7.5 Admin Create Guard Workflow

1. Admin opens Add Guard section.
2. Admin enters guard details.
3. Frontend sends create request.
4. Backend validates required fields.
5. Backend hashes password.
6. Backend inserts guard in `users`.
7. Backend creates activity feed record.
8. Admin dashboard refreshes.

## 8. Constraints And Limitations

- This app is local-first.
- SQLite is good for local/demo usage, but not ideal for many remote users writing at the same time.
- Browser location tracking is not the same as native mobile background tracking.
- OpenStreetMap tiles require internet access.
- Reverse geocoding requires internet access.
- Browser GPS accuracy depends on device, permission, signal, and environment.
- Selfie verification is proof capture, not advanced biometric verification.

## 9. Acceptance Criteria

The system is acceptable when:

- Admin can log in.
- Guard can log in.
- Admin can create a guard.
- Public registration is unavailable.
- Guard can start a shift with selfie proof.
- Guard can sync location.
- Guard can end a shift.
- Admin can see guard location and activity updates.
- Admin can manage guard status.
- Admin can delete a guard after confirmation.
- Data is stored in SQLite.
- Selfie files are stored locally.
- Mobile layout is usable and compact.
- Light and dark mode both remain readable.
- `npm run build` completes successfully.

## 10. Future Improvements

Possible future upgrades:

- PostgreSQL or MySQL for production.
- Hosted backend deployment.
- HTTPS and secure cookie sessions.
- Native mobile app for background tracking.
- Stronger selfie identity verification.
- Better admin reporting and exports.
- Role permissions beyond admin/guard.
- Audit logs for all admin actions.
- Production-ready map/geocoding provider.
- Offline-first mobile sync.
