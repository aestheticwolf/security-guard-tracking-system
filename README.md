# Sentinel Grid

Sentinel Grid is a Security Guard Tracking System for managing guards, shifts, selfies, live location updates, and admin monitoring from one local web app.

In simple words: guards log in, start or end a shift, upload a selfie, and sync their location. Admins log in separately and can see guard status, location pings, attendance, activity history, and roster details.

The project runs with a React frontend, an Express backend, and a local SQLite database.

## What This App Does

- Guards can securely sign in.
- Admins can securely sign in.
- Admins can create guard accounts.
- Guards can start a shift with selfie proof.
- Guards can end a shift with a final location sync.
- Guards can sync their current GPS location.
- Location data is shown on a Leaflet/OpenStreetMap map.
- Admins can monitor guard movement, attendance, selfies, and recent events.
- Admins can suspend/reactivate guards.
- Admins can delete guards with confirmation.
- The UI supports light mode, dark mode, desktop, tablet, and mobile.

## Main Tech Used

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
- SQLite
- JWT
- bcryptjs
- Multer
- dotenv

Local storage:

- SQLite stores users, attendance, activities, location pings, and selfie records.
- Selfie image files are saved locally in the `server/uploads/selfies` folder.

## How The App Works

There are two main user roles.

Admin:

- Logs in through the same login page.
- Opens the admin dashboard.
- Creates guard accounts.
- Watches the live operations feed.
- Views guard location on the map.
- Checks guard attendance and selfie proof.
- Manages guard status and deletion.

Guard:

- Logs in through the same login page.
- Opens the guard dashboard.
- Adds a duty label if needed.
- Uploads selfie proof.
- Starts shift.
- Syncs location manually or automatically.
- Ends shift.

The backend protects both dashboards with JWT authentication. A guard cannot open the admin dashboard, and an admin cannot accidentally use the guard shift screen as a guard.

## Local Setup

Run these commands from the project folder.

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```powershell
copy .env.example .env
```

3. Create the SQLite database:

```bash
npm run db:init
```

4. Start the app:

```bash
npm run dev
```

5. Open the frontend:

```text
http://localhost:5173
```

The backend API runs here:

```text
http://localhost:5000/api
```

## Demo Login Accounts

Admin account:

```text
Email: admin@sentinel.local
Password: Admin@123
```

Guard account:

```text
Email: guard@sentinel.local
Password: Guard@123
```

Extra seeded guard account:

```text
Email: patrol@sentinel.local
Password: Patrol@123
```

## Environment File

The `.env.example` file has the values needed for local development.

```env
PORT=5000
JWT_SECRET=change-this-secret-before-production
DB_FILE=
VITE_API_URL=http://localhost:5000/api
GEOCODER_USER_AGENT=SentinelGrid/1.0 (local security guard tracking)
```

What each value means:

- `PORT` is the backend API port.
- `JWT_SECRET` signs login tokens. Change it before using this outside local development.
- `DB_FILE` is optional. Leave it blank to use the default SQLite location.
- `VITE_API_URL` tells the React frontend where the backend API is.
- `GEOCODER_USER_AGENT` identifies the app when reverse geocoding location names.

## Where The Data Is Stored

The app uses a local SQLite file.

By default on Windows, the database is created here:

```text
C:\Users\<your-user>\AppData\Local\Temp\SentinelGrid\security.db
```

On this machine it is usually:

```text
C:\Users\richa\AppData\Local\Temp\SentinelGrid\security.db
```

You can choose your own database path by setting `DB_FILE` in `.env`:

```env
DB_FILE=C:\Users\richa\Documents\SentinelGrid\security.db
```

Then run:

```bash
npm run db:reset
```

## Database Tables

The database schema is created in `server/database/init.js`.

`users`

Stores admin and guard accounts.

Important columns:

- `full_name`
- `email`
- `password_hash`
- `role`
- `phone`
- `employee_code`
- `shift_label`
- `status`
- `last_login_at`
- `last_seen_at`

Passwords are stored as hashes, not plain text.

`attendance`

Stores guard shift records.

It records:

- check-in time
- check-out time
- shift status
- selfie path
- duty/location label
- check-in coordinates
- notes

`locations`

Stores every synced GPS point.

It records:

- guard ID
- latitude
- longitude
- accuracy
- address
- zone detail
- duty label
- battery
- tracked time

`activities`

Stores the live operations feed.

Examples:

- shift check-in verified
- shift check-out completed
- guard added to roster
- location ping synced

`selfies`

Stores selfie proof records.

It records:

- guard ID
- attendance ID
- image path
- verification result
- verification score
- capture time

## Selfie Image Storage

The actual image files are saved here:

```text
server/uploads/selfies
```

The database only stores the file path. This keeps the SQLite database smaller and easier to inspect.

Uploaded selfie files are ignored by Git so real evidence images are not pushed to GitHub.

## How To View The Database

Use DB Browser for SQLite.

1. Open DB Browser for SQLite.
2. Click `Open Database`.
3. Select:

```text
C:\Users\richa\AppData\Local\Temp\SentinelGrid\security.db
```

4. Open the `Browse Data` tab.
5. Choose a table like `users`, `attendance`, `locations`, `activities`, or `selfies`.

Helpful SQL queries:

```sql
SELECT * FROM users;
```

```sql
SELECT * FROM attendance ORDER BY check_in_at DESC;
```

```sql
SELECT * FROM locations ORDER BY tracked_at DESC;
```

```sql
SELECT * FROM activities ORDER BY created_at DESC;
```

This query shows location pings with guard names:

```sql
SELECT
  u.full_name,
  l.latitude,
  l.longitude,
  l.accuracy,
  l.address,
  l.zone_detail,
  l.duty_label,
  l.battery,
  l.tracked_at
FROM locations l
JOIN users u ON u.id = l.user_id
ORDER BY l.tracked_at DESC;
```

## Authentication Logic

Login works like this:

1. User enters email and password.
2. Frontend sends the login request to `POST /api/auth/login`.
3. Backend finds the user by email.
4. Backend checks the password using `bcryptjs`.
5. Backend creates a JWT token.
6. Frontend stores the token locally.
7. Protected routes use the token to decide what the user can open.

Public registration is disabled. Only admins can create guard accounts from the admin dashboard.

## Guard Dashboard Logic

When a guard starts a shift:

1. Guard selects a selfie.
2. Browser tries to capture the current location.
3. Guard clicks `Start Shift`.
4. Backend saves attendance data.
5. Backend saves selfie metadata.
6. Backend saves location data if coordinates are available.
7. Backend creates an activity event for the admin feed.

When a guard clicks `Sync now`:

1. Browser gets the latest location.
2. Frontend sends latitude, longitude, accuracy, battery, and duty label.
3. Backend reverse-geocodes the location into a readable zone when possible.
4. Backend stores a new row in `locations`.
5. Admin dashboard receives the update through polling and refresh signals.

When a guard ends a shift:

1. Backend finds the open attendance record.
2. Backend marks it as completed.
3. Backend stores final location if available.
4. Backend creates a check-out activity event.

## Admin Dashboard Logic

The admin dashboard reads a combined overview from the backend.

It shows:

- total guards
- guards on duty
- attendance rate
- incident/activity count
- tracked guards
- live operations feed
- live map
- selected guard detail
- guard roster
- attendance snapshot

Admin data is built by reading from:

- `users`
- `attendance`
- `activities`
- `locations`
- `selfies`

The admin dashboard refreshes regularly so new guard location pings and attendance events appear without a manual page reload.

## GPS, Location, And Maps

The app uses the browser location system.

GPS source:

```text
navigator.geolocation
```

This means the browser asks the device for location. On a phone, the device may use GPS, Wi-Fi, mobile towers, and system location services. On a laptop or desktop, location is usually less accurate.

Map library:

```text
Leaflet
```

Map tiles:

```text
OpenStreetMap
```

Reverse geocoding:

```text
OpenStreetMap Nominatim
```

Important behavior:

- The app tracks location while the guard dashboard is open.
- Manual sync uses the `Sync now` button.
- Active shift auto-sync runs every 10 minutes.
- Movement can also trigger a sync.
- If sync fails, the app can queue the location and retry.
- Browser tracking cannot continue reliably after the tab is closed.

Accuracy:

- The app stores the accuracy value reported by the device.
- If the browser says accuracy is `63 meters`, the pin is approximate within that area.
- The map shows an accuracy circle so admins and guards understand the location precision.

## Activity Priority Labels

The labels `low` and `medium` are priority labels for the activity feed.

`low`

Normal event. Example: shift check-out completed.

`medium`

More important event. Example: shift check-in verified.

They are not errors. They help admins quickly scan the event feed.

## Mobile UI

The mobile layout is built to avoid long, hard-to-read dashboards.

Mobile features:

- login form appears first
- compact cards
- smaller form spacing
- collapsible dashboard sections
- floating section shortcut rail
- bottom mobile navigation dock
- responsive maps
- light and dark mode

## Useful Commands

Run frontend and backend together:

```bash
npm run dev
```

Run frontend only:

```bash
npm run client
```

Run backend only:

```bash
npm run server
```

Initialize database:

```bash
npm run db:init
```

Reset database:

```bash
npm run db:reset
```

Build frontend:

```bash
npm run build
```

Start backend without watch mode:

```bash
npm run start
```

## GitHub Upload Notes

Do not push local secrets or runtime data.

The `.gitignore` already excludes:

```text
node_modules
dist
.env
server/database/*.db*
server/uploads/selfies/*
```

First push to GitHub:

```powershell
git init
git add .
git commit -m "Initial security guard tracking system"
git branch -M main
git remote add origin https://github.com/<owner>/<repo-name>.git
git push -u origin main
```

After cloning the project later:

```powershell
npm install
copy .env.example .env
npm run db:init
npm run dev
```

## Troubleshooting

`bcrypt is not defined`

Restart `npm run dev`. The app uses `bcryptjs`, but an old backend process may still be running old code.

`Network Error` on login

Make sure the backend is running.

```bash
npm run dev
```

Also check that `.env` has:

```env
VITE_API_URL=http://localhost:5000/api
```

Map does not load

The map uses online OpenStreetMap tiles. Check internet access and refresh the page.

Location does not sync

Check these first:

- browser location permission is allowed
- phone/device location is enabled
- dashboard tab is open
- backend is running

DB Browser shows no tables

You probably opened the wrong database file. Open the active file:

```text
C:\Users\richa\AppData\Local\Temp\SentinelGrid\security.db
```

If `DB_FILE` is set in `.env`, open that file instead.

## Production Notes

This is currently a local-first app. For a real production system, consider:

- PostgreSQL or MySQL instead of local SQLite
- HTTPS
- stronger session storage
- rate limiting
- production logging
- a paid or self-hosted map tile provider
- a paid or self-hosted geocoding provider
- native mobile app support for background tracking
- stronger selfie verification rules
- backup and audit policies
